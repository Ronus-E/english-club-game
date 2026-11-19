/**
 * Entry point: builds the store, audio engine, UI, activity runner and quiz
 * controller, then wires every navigation path. No third-party dependencies.
 */
import { ProfileStore } from './core/storage.js';
import { AudioEngine } from './core/audio.js';
import { UI } from './ui/screens.js';
import { AmbientField, drawLogo } from './ui/decor.js';
import { ActivityRunner } from './ui/activities.js';
import { Quiz } from './game/quiz.js';
import {
  getExercises, getPlacementQuestions, countExercises,
  LEVELS, SKILLS, SKILL_INFO,
} from './content/index.js';
import { shuffle } from './core/util.js';

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
  const TOTAL_QUESTIONS = 15;

  const quiz = new Quiz({
    store,
    activities,
    onEnd: ({ result, unlocked }) => {
      lastResult = result;
      ui.renderResults(result, { unlocked });
      ui.showScreen('results');
    },
  });
  quiz.onProgress = (session) => {
    ui.setQuizStatus(Math.min(session.answers.length + 1, TOTAL_QUESTIONS), TOTAL_QUESTIONS);
    ui.renderQuizPips(session.skills);
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

  const startQuiz = (level) => {
    const name = ui.el.playerNameInput?.value || store.get().name;
    store.setName(name);
    store.setLevel(level);
    ui.closeAllOverlays();
    ui.setQuizHeader(level, TOTAL_QUESTIONS);
    ui.showScreen('quiz');
    lastResult = null;
    quiz.start(level);
  };

  const runPractice = (skill, level) => {
    const items = shuffle(getExercises(skill, level));
    if (!items.length) {
      ui.toast('No exercises available for this selection.', { warn: true });
      return;
    }
    activities.open({
      title: `${SKILL_INFO[skill]?.name || skill} practice`,
      kicker: `Practice · level ${level}`,
      icon: SKILL_INFO[skill]?.icon || '★',
      skill,
      items,
      finishLabel: 'Finish practice',
      onAnswer: () => {},
      onQuit: () => {
        activities.close();
        ui.showScreen('practice');
      },
      onFinish: (summary) => {
        const line = summary.total
          ? `${summary.correct}/${summary.total} correct (${summary.percent}%)`
          : 'Practice session completed.';
        ui.toast(`${line} · no timer, no score pressure.`, { ms: 4200 });
        ui.showScreen('practice');
      },
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
  ui.el.bootBtn?.addEventListener('click', () => {
    audio.ensure();
    audio.play('fanfare');
    try { localStorage.setItem('ec.visited', '1'); } catch { /* private mode */ }
    ui.showScreen('menu');
    ui.updateProfile();
    if (logoRaf) { cancelAnimationFrame(logoRaf); logoRaf = null; }
  });

  ui.el.playBtn?.addEventListener('click', () => { audio.play('click'); openLevelSelect(); });
  ui.el.levelContinueBtn?.addEventListener('click', () => {
    audio.play('fanfare');
    startQuiz(store.get().level);
  });
  ui.el.practiceBtn?.addEventListener('click', () => {
    audio.play('click');
    ui.el.practiceLevel.value = store.get().level;
    ui.renderPractice();
    ui.showScreen('practice');
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

  /* ------------------------------------------------------------- results */
  ui.el.replayBtn?.addEventListener('click', () => {
    audio.play('click');
    startQuiz(lastResult?.level || store.get().level);
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

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        /* offline caching is optional; the quiz still runs */
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
    LEVELS, SKILLS, countExercises, getExercises,
  };
  console.info('[English Club] ready', {
    screens: ui.screens.size,
    levels: LEVELS,
    skills: [...SKILLS, 'culture'],
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
