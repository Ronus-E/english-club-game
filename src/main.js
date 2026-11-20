/**
 * Entry point: builds the store, audio engine, UI, activity runner and quiz
 * controller, then wires every navigation path. No third-party dependencies.
 */
import { ProfileStore } from './core/storage.js';
import { AudioEngine } from './core/audio.js';
import { UI } from './ui/screens.js';
import { AmbientField, drawLogo, drawShareCard } from './ui/decor.js';
import { ActivityRunner } from './ui/activities.js';
import { Quiz } from './game/quiz.js';
import {
  getExercises, getPlacementQuestions, getExerciseById, getExercisesByTag,
  dailySeed, countExercises, stageQuestionCount, normalizeStage,
  LEVELS, SKILLS, SKILL_INFO, QUIZ_STAGES,
} from './content/index.js';
import { shuffle, todayIso } from './core/util.js';

function boot() {
  const store = new ProfileStore();
  const audio = new AudioEngine(store.getSettings());
  const ui = new UI({ store, audio });

  const ambient = new AmbientField(document.getElementById('ambientCanvas'));
  ambient.setReduced(store.getSettings().reduceMotion || store.getSettings().reducedGraphics);
  ambient.start();

  const logoCanvas = document.getElementById('logoCanvas');
  let logoTime = 0;
  let logoRaf = null;
  const animateLogo = () => {
    logoTime += 0.016;
    drawLogo(logoCanvas, logoTime);
    logoRaf = requestAnimationFrame(animateLogo);
  };
  animateLogo();

  const activities = new ActivityRunner({
    overlay: ui.el['overlay-activity'],
    elements: {
      panel: document.querySelector('#overlay-activity .activity-panel'),
      body: ui.el.activityBody,
      foot: ui.el.activityFoot,
      title: ui.el.activityTitle,
      kicker: ui.el.activityKicker,
      counter: ui.el.activityCounter,
      skill: ui.el.activitySkill,
      icon: ui.el.activityIcon,
      quit: ui.el.activityQuit,
    },
    audio,
    getSettings: () => store.getSettings(),
    syncRoot: () => ui.syncOverlayRoot(),
  });

  let lastResult = null;
  let placementCorrect = 0;
  let muted = false;
  let deferredPrompt = null;
  let swRegistration = null;
  let updateRequested = false;
  let reloadedForUpdate = false;

  const quiz = new Quiz({
    store,
    activities,
    onEnd: ({ result, unlocked, review }) => {
      lastResult = result;
      ui.renderResults(result, { unlocked, review });
      ui.renderProgress();
      ui.renderTagSelect();
      ui.showScreen('results');
      if (result.levelCompleted) {
        audio.playLevelSong(result.level);
        ui.toast(`All ${QUIZ_STAGES} stages cleared at ${result.level}! Level complete.`, { ms: 5200 });
      } else if (result.stagePassed) {
        audio.playStageClear(result.stage);
        ui.toast(result.stageUnlocked
          ? `Stage ${result.stage} cleared — stage ${result.stageUnlocked} unlocked.`
          : `Stage ${result.stage} cleared at ${result.percent}%.`, { ms: 4200 });
      }
    },
  });
  quiz.onProgress = (session) => {
    const total = quiz.total || session.answers.length || 1;
    ui.setQuizStatus(Math.min(session.answers.length + 1, total), total);
    ui.renderQuizPips(session.skills);
    audio.setMusicProgress(Math.min(1, session.answers.length / total));
  };
  quiz.onQuit = () => {
    ui.showScreen('menu');
    ui.updateProfile();
    ui.toast('Quiz left. Your progress in this run was not saved.', { warn: true });
  };

  /* ------------------------------------------------------------- helpers */
  const applyGraphicsSettings = (settings) => {
    ui.applyA11yClasses();
    const reduced = Boolean(settings.reduceMotion || settings.reducedGraphics);
    ambient.setReduced(reduced);
    if (logoRaf) {
      cancelAnimationFrame(logoRaf);
      logoRaf = null;
    }
    if (!reduced) animateLogo();
  };

  const openLevelSelect = () => {
    ui.renderLevelGrid({ selected: store.get().level });
    ui.updateProfile();
    ui.showScreen('level');
  };

  let pendingStage = null;

  const launchStage = (level, seed, stage, label) => {
    const chosenStage = normalizeStage(stage);
    const total = stageQuestionCount(chosenStage);
    ui.closeAllOverlays();
    ui.setQuizHeader(level, total, chosenStage);
    if (label && ui.el.quizKicker) {
      ui.el.quizKicker.textContent = `${label} · ${level} · Stage ${chosenStage}`;
    }
    ui.showScreen('quiz');
    lastResult = null;
    pendingStage = null;
    audio.setMusicStage(chosenStage);
    quiz.start(level, seed ?? Date.now(), chosenStage);
  };

  const startQuiz = (level, seed = null, stage = null, label = null) => {
    const name = ui.el.playerNameInput?.value || store.get().name;
    store.setName(name);
    store.setLevel(level);
    const chosenStage = normalizeStage(stage ?? store.stageState(level).current);
    const total = stageQuestionCount(chosenStage);
    pendingStage = { level, seed, stage: chosenStage, label };
    ui.closeAllOverlays();
    ui.renderStageWelcome({ level, stage: chosenStage, total, label });
    ui.openOverlay('stage');
  };

  const openStageSelect = () => {
    const level = store.get().level;
    ui.renderStageGrid(level, {
      onPick: (stage) => startQuiz(level, null, stage),
    });
    ui.updateProfile();
    ui.showScreen('stages');
  };

  const runItems = ({ title, kicker, icon, skill, items, finishLabel, onAnswer, onQuit, onFinish }) => {
    if (!items.length) {
      ui.toast('No exercises available for this selection.', { warn: true });
      return false;
    }
    activities.open({
      title, kicker, icon, skill, items, finishLabel,
      onAnswer: onAnswer || (() => {}),
      onQuit: onQuit || (() => { activities.close(); ui.showScreen('menu'); }),
      onFinish: onFinish || ((summary) => {
        ui.toast(`Session complete: ${summary.correct}/${summary.total} correct.`, { ms: 3600 });
        ui.showScreen('menu');
      }),
    });
    return true;
  };

  const runPractice = (skill, level) => {
    const items = shuffle(getExercises(skill, level));
    runItems({
      title: `${SKILL_INFO[skill]?.name || skill} practice`,
      kicker: `Practice · level ${level}`,
      icon: SKILL_INFO[skill]?.icon || '★',
      skill,
      items,
      finishLabel: 'Finish practice',
      onFinish: (summary) => {
        const line = summary.total
          ? `${summary.correct}/${summary.total} correct (${summary.percent}%)`
          : 'Practice session completed.';
        ui.toast(`${line} · no timer, no score pressure.`, { ms: 4200 });
        ui.showScreen('practice');
      },
      onQuit: () => { activities.close(); ui.showScreen('practice'); },
    });
  };

  const startPlacement = () => {
    placementCorrect = 0;
    const items = getPlacementQuestions();
    activities.open({
      title: 'Placement check',
      kicker: 'Six questions · about one minute',
      icon: '🧭',
      skill: 'grammar',
      items,
      finishLabel: 'See my recommended level',
      onAnswer: ({ correct }) => { if (correct === true) placementCorrect += 1; },
      onQuit: () => {
        activities.close();
        openLevelSelect();
      },
      onFinish: () => {
        const recommended = placementCorrect >= 5 ? 'B1' : placementCorrect >= 3 ? 'A2' : 'A1';
        store.setLevel(recommended);
        ui.toast(`Recommended level: ${recommended} (${placementCorrect}/6). You can change it any time.`, { ms: 5000 });
        openLevelSelect();
      },
    });
  };

  const closeTopOverlay = () => {
    for (const id of ['confirm', 'help', 'about', 'settings']) {
      if (ui.isOverlayOpen(id)) {
        ui.closeOverlay(id);
        return true;
      }
    }
    if (ui.isOverlayOpen('activity')) {
      activities.requestQuit();
      return true;
    }
    return false;
  };

  /* -------------------------------------------------------------- screens */
  const quickBoot = () => {
    audio.ensure();
    audio.play('fanfare');
    try { localStorage.setItem('ec.visited', '1'); } catch { /* private mode */ }
    if (logoRaf) { cancelAnimationFrame(logoRaf); logoRaf = null; }
    audio.startMusic();
  };

  const openCurrentStage = (fresh = false) => {
    quickBoot();
    const level = store.get().level;
    const stage = fresh ? 1 : store.stageState(level).current;
    ui.showScreen('menu');
    ui.updateProfile();
    startQuiz(level, null, stage, fresh ? 'Fresh run' : 'Continue run');
  };

  ui.el.bootBtn?.addEventListener('click', () => openCurrentStage(false));

  ui.el.playBtn?.addEventListener('click', () => { audio.play('click'); openLevelSelect(); });
  ui.el.levelContinueBtn?.addEventListener('click', () => {
    audio.play('fanfare');
    openStageSelect();
  });
  ui.el.practiceBtn?.addEventListener('click', () => {
    audio.play('click');
    ui.el.practiceLevel.value = store.get().level;
    ui.renderPractice();
    ui.renderTagSelect();
    ui.showScreen('practice');
  });
  ui.el.progressBtn?.addEventListener('click', () => {
    audio.play('click');
    ui.renderProgress();
    ui.updateProfile();
    ui.showScreen('progress');
  });
  ui.el.dailyBtn?.addEventListener('click', () => {
    audio.play('click');
    const level = store.get().level;
    const iso = todayIso();
    const stage = store.stageState(level).current;
    startQuiz(level, dailySeed(iso), stage, `Daily challenge · ${iso}`);
    ui.toast(`Daily challenge for ${iso} — stage ${stage} uses the same questions for everyone today.`, { ms: 4200 });
  });
  const shareGame = async () => {
    const title = 'English Club Quiz';
    const text = 'Practice English with the English Club Quiz — 150 exercises, 10 stages, offline and free.';
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        ui.toast('Shared!', { ms: 2200 });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      ui.toast('Link copied to clipboard.', { ms: 2600 });
    } catch {
      ui.toast('Sharing is unavailable here. Copy the link from the address bar.', { warn: true, ms: 4200 });
    }
  };

  ui.el.shareBtn?.addEventListener('click', () => {
    audio.play('click');
    shareGame();
  });
  ui.el.achievementsBtn?.addEventListener('click', () => {
    audio.play('click');
    ui.renderAchievements();
    ui.updateProfile();
    ui.showScreen('achievements');
  });
  ui.el.settingsBtn?.addEventListener('click', () => { audio.play('open'); ui.syncSettingsInputs(); ui.openOverlay('settings'); });
  ui.el.aboutBtn?.addEventListener('click', () => { audio.play('open'); ui.openOverlay('about'); });
  ui.el.howBtn?.addEventListener('click', () => { audio.play('open'); ui.openOverlay('help'); });
  ui.el.placementBtn?.addEventListener('click', () => { audio.play('click'); startPlacement(); });

  ui.el.practiceLevel?.addEventListener('change', () => ui.renderPractice());
  ui.onPracticeSkill = (skill, level) => {
    audio.play('select');
    runPractice(skill, level);
  };
  ui.el.practiceTagBtn?.addEventListener('click', () => {
    audio.play('click');
    const tag = ui.el.practiceTag?.value || '';
    if (!tag) {
      ui.toast('Choose a revision topic first.', { warn: true });
      return;
    }
    const level = ui.el.practiceLevel?.value || store.get().level;
    const items = shuffle(getExercisesByTag(tag, level));
    if (!items.length) {
      ui.toast(`No ${level} exercises found for “${tag}”.`, { warn: true });
      return;
    }
    runItems({
      title: `${tag} revision`,
      kicker: `Topic · ${level}`,
      icon: '🔎',
      skill: items[0]?.skill || null,
      items,
      finishLabel: 'Finish topic',
      onQuit: () => { activities.close(); ui.showScreen('practice'); },
      onFinish: (summary) => {
        ui.toast(`${tag}: ${summary.correct}/${summary.total} correct.`, { ms: 3600 });
        ui.showScreen('practice');
      },
    });
  });

  for (const btn of document.querySelectorAll('[data-back]')) {
    btn.addEventListener('click', () => {
      ui.showScreen(btn.getAttribute('data-back'));
      audio.play('close');
    });
  }
  for (const btn of document.querySelectorAll('[data-close-overlay]')) {
    btn.addEventListener('click', () => {
      const overlay = btn.closest('.overlay');
      if (overlay) {
        overlay.hidden = true;
        ui.syncOverlayRoot();
      }
      audio.play('close');
    });
  }

  ui.el.playerNameInput?.addEventListener('input', (event) => {
    store.setName(event.target.value);
    ui.updateProfile();
  });

  /* ----------------------------------------------------------------- quiz */
  ui.el.quizQuitBtn?.addEventListener('click', () => {
    audio.play('close');
    ui.confirm({
      title: 'Leave this quiz?',
      text: 'Answers already given in this run will not be saved.',
      yes: 'Leave quiz',
    }, () => quiz.abandon());
  });
  ui.el.quizOpenBtn?.addEventListener('click', () => {
    if (quiz.session) ui.openOverlay('activity');
  });

  /* ------------------------------------------------------- stage welcome */
  ui.el.stageContinueBtn?.addEventListener('click', () => {
    if (!pendingStage) { ui.closeOverlay('stage'); return; }
    audio.play('fanfare');
    const { level, seed, stage, label } = pendingStage;
    launchStage(level, seed, stage, label);
  });
  ui.el.stageRestartBtn?.addEventListener('click', () => openCurrentStage(true));
  ui.el.stageBackBtn?.addEventListener('click', () => {
    audio.play('close');
    pendingStage = null;
    ui.closeOverlay('stage');
  });

  /* ------------------------------------------------------------- results */
  ui.el.nextStageBtn?.addEventListener('click', () => {
    audio.play('click');
    const level = lastResult?.level || store.get().level;
    const next = Number(ui.el.nextStageBtn.dataset.stage) || ((lastResult?.stage || 1) + 1);
    startQuiz(level, null, next);
  });
  ui.el.replayBtn?.addEventListener('click', () => {
    audio.play('click');
    startQuiz(lastResult?.level || store.get().level, null, lastResult?.stage ?? null);
  });
  ui.el.reviewMistakesBtn?.addEventListener('click', () => {
    audio.play('click');
    const saved = store.getMistakes();
    const items = saved.slice(0, 10).map((entry) => getExerciseById(entry.id)).filter(Boolean);
    if (!items.length) {
      ui.toast('No saved mistakes to review yet.', { warn: true });
      return;
    }
    const reviewed = [];
    runItems({
      title: 'Review my mistakes',
      kicker: `${items.length} of ${saved.length} saved item${saved.length === 1 ? '' : 's'}`,
      icon: '📌',
      skill: null,
      items,
      finishLabel: 'Finish review',
      onAnswer: ({ item, correct }) => reviewed.push({ id: item.id, correct }),
      onQuit: () => { activities.close(); ui.showScreen('results'); },
      onFinish: (summary) => {
        const cleared = reviewed.filter((entry) => entry.correct === true)
          .reduce((count, entry) => count + (store.clearMistake(entry.id) ? 1 : 0), 0);
        const remaining = store.getMistakes().length;
        ui.renderProgress();
        ui.toast(`Review complete: ${summary.correct}/${summary.total} correct. ${cleared} cleared, ${remaining} still saved.`, { ms: 4200 });
        ui.showScreen('results');
      },
    });
  });
  ui.el.comebackBtn?.addEventListener('click', () => {
    audio.play('click');
    const queue = store.getComeback(3);
    const items = queue.map((entry) => getExerciseById(entry.id)).filter(Boolean);
    if (!items.length) {
      ui.toast('Your comeback queue is empty.', { warn: true });
      return;
    }
    const fixed = [];
    runItems({
      title: 'Comeback queue',
      kicker: `${items.length} saved item${items.length === 1 ? '' : 's'}`,
      icon: '📌',
      skill: null,
      items,
      finishLabel: 'Finish comeback',
      onAnswer: ({ item, correct }) => { if (correct === true) fixed.push(item.id); },
      onQuit: () => { activities.close(); ui.showScreen('menu'); ui.updateProfile(); },
      onFinish: (summary) => {
        const cleared = fixed.reduce((count, id) => count + (store.clearMistake(id) ? 1 : 0), 0);
        const remaining = store.getMistakes().length;
        ui.updateProfile();
        ui.toast(`Comeback complete: ${summary.correct}/${summary.total} correct. ${cleared} fixed, ${remaining} still saved.`, { ms: 4200 });
        ui.showScreen('menu');
      },
    });
  });
  ui.el.shareCardBtn?.addEventListener('click', () => {
    if (!lastResult) return;
    audio.play('click');
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    drawShareCard(canvas, { result: lastResult, name: store.get().name });
    try {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `english-club-${lastResult.level}-stage-${lastResult.stage || 1}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      ui.toast('Result card saved as a PNG on this device.', { ms: 3600 });
    } catch {
      ui.toast('This browser cannot save the result card.', { warn: true, ms: 3600 });
    }
  });
  ui.el.resultsMenuBtn?.addEventListener('click', () => {
    audio.play('close');
    ui.showScreen('menu');
    ui.updateProfile();
  });
  ui.el.practiceWeakBtn?.addEventListener('click', () => {
    const result = lastResult;
    if (!result) { ui.showScreen('practice'); return; }
    const scored = Object.entries(result.skills)
      .filter(([, stat]) => stat.total > 0 && stat.percent !== null)
      .sort((a, b) => a[1].percent - b[1].percent);
    const weakest = scored[0]?.[0] || 'vocabulary';
    ui.el.practiceLevel.value = result.level;
    ui.renderPractice();
    ui.showScreen('practice');
    ui.toast(`Weakest skill: ${SKILL_INFO[weakest]?.name || weakest}. Starting focused practice.`, { ms: 3000 });
    runPractice(weakest, result.level);
  });

  /* ------------------------------------------------------------ settings */
  ui.bindSettings({
    onChange: (key, value, settings) => {
      audio.applySettings(settings);
      applyGraphicsSettings(settings);
      if (key === 'musicOn' && value) audio.startMusic();
      if (key === 'musicOn' && !value) audio.stopMusic();
      if (key === 'music' || key === 'sfx') audio.play('select');
    },
  });
  ui.syncSettingsInputs();
  applyGraphicsSettings(store.getSettings());

  ui.el.resetProgressBtn?.addEventListener('click', () => {
    ui.confirm({
      title: 'Reset local progress?',
      text: 'XP, badges, best scores and settings on this device will be deleted. This cannot be undone.',
      yes: 'Reset everything',
    }, () => {
      store.reset();
      ui.syncSettingsInputs();
      applyGraphicsSettings(store.getSettings());
      audio.applySettings(store.getSettings());
      ui.updateProfile();
      ui.toast('Local progress reset.', { warn: true });
    });
  });

  /* ---------------------------------------------------------- data portability */
  ui.el.exportBtn?.addEventListener('click', () => {
    try {
      const blob = new Blob([store.exportProfile()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `english-club-profile-${todayIso()}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      ui.toast('Progress exported as JSON.');
    } catch {
      ui.toast('Export failed in this browser.', { warn: true });
    }
  });
  ui.el.importBtn?.addEventListener('click', () => ui.el.importFile?.click());
  ui.el.importFile?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    let text = '';
    try {
      text = await file.text();
      JSON.parse(text);
    } catch {
      ui.toast('That file is not valid JSON.', { warn: true });
      event.target.value = '';
      return;
    }
    ui.confirm({
      title: 'Import this profile?',
      text: 'Your XP, badges, best scores, mistake book and settings on this device will be replaced.',
      yes: 'Import profile',
    }, () => {
      try {
        store.importProfile(text);
        ui.syncSettingsInputs();
        applyGraphicsSettings(store.getSettings());
        audio.applySettings(store.getSettings());
        ui.updateProfile();
        ui.renderProgress();
        ui.renderTagSelect();
        ui.toast('Profile imported.', { ms: 3000 });
      } catch (error) {
        ui.toast(error?.message || 'Import failed.', { warn: true, ms: 4000 });
      }
    });
    event.target.value = '';
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && closeTopOverlay()) event.preventDefault();
  });

  /* ----------------------------------------------------------------- PWA */
  const offlineBanner = ui.el.offlineBanner;
  const updateOnline = () => {
    if (!offlineBanner) return;
    offlineBanner.hidden = navigator.onLine;
  };
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (ui.el.installHint) ui.el.installHint.textContent = 'Install this quiz on your device';
  });
  ui.el.installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) {
      ui.toast('Use your browser menu → “Install app” or “Add to Home Screen”.', { ms: 4200 });
      return;
    }
    deferredPrompt.prompt();
    try {
      const choice = await deferredPrompt.userChoice;
      ui.toast(choice.outcome === 'accepted' ? 'Installing English Club…' : 'Install dismissed.', { ms: 2600 });
    } catch {
      ui.toast('Install prompt is unavailable in this browser.', { warn: true });
    }
    deferredPrompt = null;
  });
  window.addEventListener('appinstalled', () => {
    ui.toast('English Club installed. It works offline.');
    if (ui.el.installHint) ui.el.installHint.textContent = 'Installed';
  });

  ui.el.updateBtn?.addEventListener('click', () => {
    const worker = swRegistration?.waiting;
    if (!worker) {
      ui.toast('No update is waiting right now.', { warn: true });
      return;
    }
    updateRequested = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
    if (ui.el.updateBanner) ui.el.updateBanner.hidden = true;
    ui.toast('Installing update…');
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((registration) => {
        swRegistration = registration;
        const showUpdate = () => {
          if (registration.waiting && navigator.serviceWorker.controller && ui.el.updateBanner) {
            ui.el.updateBanner.hidden = false;
          }
        };
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') showUpdate();
          });
        });
        if (registration.waiting) showUpdate();
      }).catch(() => {
        /* offline caching is optional; the quiz still runs */
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!updateRequested || reloadedForUpdate) return;
        reloadedForUpdate = true;
        window.location.reload();
      });
    });
  }

  /* ---------------------------------------------------------------- boot */
  drawLogo(logoCanvas, 0);
  ui.updateProfile();
  ui.setBootStatus('Quiz ready · press START');
  ui.el.bootBtn?.removeAttribute('disabled');
  document.body.classList.add('is-booted');
  window.__ENGLISH_CLUB__ = {
    store, ui, quiz, activities, audio,
    LEVELS, SKILLS, QUIZ_STAGES, countExercises, getExercises, stageQuestionCount,
  };
  console.info('[English Club] ready', {
    screens: ui.screens.size,
    levels: LEVELS,
    skills: [...SKILLS, 'culture'],
    stages: QUIZ_STAGES,
    exercises: LEVELS.reduce(
      (sum, level) => sum + [...SKILLS, 'culture']
        .reduce((n, skill) => n + getExercises(skill, level).length, 0),
      0,
    ),
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
