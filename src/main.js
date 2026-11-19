/**
 * Entry point: builds the store, audio engine, UI, activity/dialogue runners,
 * the mission controller and every navigation path. No dependencies.
 */
import { ProfileStore } from './core/storage.js';
import { AudioEngine } from './core/audio.js';
import { UI, formatClock } from './ui/screens.js';
import { AmbientField, drawLogo, drawAvatarPreview } from './ui/decor.js';
import { ActivityRunner } from './ui/activities.js';
import { DialogueRunner } from './ui/dialogue.js';
import { Mission } from './game/mission.js';
import { InputController } from './game/input.js';
import { getExercises, getPlacementQuestions, LEVELS, SKILLS, SKILL_INFO } from './content/index.js';
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

  const dialogue = new DialogueRunner({
    overlay: ui.el['overlay-dialogue'],
    elements: {
      name: ui.el.dialogueName,
      text: ui.el.dialogueText,
      fr: ui.el.dialogueFr,
      choices: ui.el.dialogueChoices,
      next: ui.el.dialogueNext,
      portrait: ui.el.dialoguePortrait,
    },
    audio,
    getSettings: () => store.getSettings(),
    syncRoot: () => ui.syncOverlayRoot(),
    onComplete: (info) => mission.onDialogueComplete(info),
  });

  const mission = new Mission({
    ui,
    store,
    audio,
    activities,
    dialogue,
    callbacks: {
      onEnd: ({ result }) => { lastResult = result; },
    },
  });

  let lastResult = null;
  let placementCorrect = 0;
  let muted = false;
  let deferredPrompt = null;

  const input = new InputController({
    joystick: ui.el.joystick,
    knob: ui.el.joystickKnob,
    actionBtn: ui.el.actionBtn,
    isEnabled: () => mission.isPlaying,
    onAction: () => {
      if (ui.isOverlayOpen('dialogue')) { dialogue.advance(); return; }
      if (ui.isOverlayOpen('activity')) return;
      if (ui.anyOverlayOpen()) return;
      mission.interact();
    },
    onPause: () => handlePause(),
  });
  mission.setInput(() => input.worldAxis(), () => input.reset());

  /* ------------------------------------------------------------- helpers */
  const closeOverlayNode = (node) => {
    node.hidden = true;
    ui.syncOverlayRoot();
  };

  const applyGraphicsSettings = (settings) => {
    ui.applyA11yClasses();
    const reduced = Boolean(settings.reduceMotion || settings.reducedGraphics);
    mission.renderer.reduced = reduced;
    ambient.setReduced(reduced);
    if (logoRaf) {
      cancelAnimationFrame(logoRaf);
      logoRaf = null;
    }
    if (!reduced) animateLogo();
  };

  const syncAvatar = () => {
    const p = store.get();
    drawAvatarPreview(ui.el.avatarCanvas, p.avatar);
    if (ui.el.playerNameInput && document.activeElement !== ui.el.playerNameInput) {
      ui.el.playerNameInput.value = p.name;
    }
  };

  const updateMuteButton = () => {
    if (!ui.el.muteBtn) return;
    ui.el.muteBtn.textContent = muted ? '🔇' : '🔊';
    ui.el.muteBtn.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
  };

  const toggleMute = () => {
    muted = !muted;
    audio.setMuted(muted);
    updateMuteButton();
    if (!muted) audio.play('click');
  };

  const openLevelSelect = () => {
    ui.renderLevelGrid({
      selected: store.get().level,
      onPick: () => ui.updateProfile(),
    });
    ui.updateProfile();
    ui.showScreen('level');
  };

  const openIntro = () => {
    ui.renderAvatarPicker({ onPick: () => syncAvatar() });
    syncAvatar();
    ui.updateProfile();
    ui.showScreen('intro');
  };

  const startMission = () => {
    const name = ui.el.playerNameInput?.value || store.get().name;
    store.setName(name);
    store.setAvatar(store.get().avatar);
    ui.closeAllOverlays();
    ui.setBootStatus('Campus ready.');
    mission.start(store.get().level);
    lastResult = null;
  };

  const runPractice = (skill, level) => {
    const items = shuffle(getExercises(skill, level));
    if (!items.length) { ui.toast('No exercises available for this selection.', { warn: true }); return; }
    activities.open({
      stationId: `practice:${skill}`,
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
      stationId: 'placement',
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

  const handlePause = () => {
    if (ui.isOverlayOpen('confirm')) return;
    if (ui.isOverlayOpen('dialogue')) { dialogue.close(false); return; }
    if (ui.isOverlayOpen('activity')) { activities.requestQuit(); return; }
    if (ui.isOverlayOpen('pause')) { mission.resume(); return; }
    if (ui.isOverlayOpen('help') || ui.isOverlayOpen('about') || ui.isOverlayOpen('settings') || ui.isOverlayOpen('progress')) {
      for (const id of ['help', 'about', 'settings', 'progress']) if (ui.isOverlayOpen(id)) ui.closeOverlay(id);
      if (mission.state === 'paused' && !ui.anyOverlayOpen()) ui.openOverlay('pause');
      return;
    }
    if (ui.currentScreen === 'game' && mission.isPlaying) mission.pause();
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
  ui.el.levelContinueBtn?.addEventListener('click', () => { audio.play('select'); openIntro(); });
  ui.el.startMissionBtn?.addEventListener('click', () => { audio.play('fanfare'); startMission(); });
  ui.el.practiceBtn?.addEventListener('click', () => {
    audio.play('click');
    ui.el.practiceLevel.value = store.get().level;
    ui.renderPractice();
    ui.showScreen('practice');
  });
  ui.el.practiceCampusBtn?.addEventListener('click', () => { audio.play('click'); startMission(); });
  ui.el.achievementsBtn?.addEventListener('click', () => {
    audio.play('click');
    ui.renderAchievements();
    ui.updateProfile();
    ui.showScreen('achievements');
  });
  ui.el.settingsBtn?.addEventListener('click', () => { audio.play('open'); ui.syncSettingsInputs(); ui.openOverlay('settings'); });
  ui.el.aboutBtn?.addEventListener('click', () => { audio.play('open'); ui.openOverlay('about'); });
  ui.el.howBtn?.addEventListener('click', () => { audio.play('open'); ui.openOverlay('help'); });
  ui.el.introHowBtn?.addEventListener('click', () => { audio.play('open'); ui.openOverlay('help'); });
  ui.el.placementBtn?.addEventListener('click', () => { audio.play('click'); startPlacement(); });

  ui.el.practiceLevel?.addEventListener('change', () => {
    ui.renderPractice();
  });

  ui.onPracticeSkill = (skill, level) => {
    audio.play('select');
    runPractice(skill, level);
  };

  for (const btn of document.querySelectorAll('[data-back]')) {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-back');
      if (target === 'level') openLevelSelect();
      else ui.showScreen(target);
      audio.play('close');
    });
  }

  for (const btn of document.querySelectorAll('[data-close-overlay]')) {
    btn.addEventListener('click', () => {
      const overlay = btn.closest('.overlay');
      if (overlay) closeOverlayNode(overlay);
      if (overlay?.id === 'overlay-progress' && mission.state === 'paused' && !ui.anyOverlayOpen()) {
        ui.openOverlay('pause');
      }
      audio.play('close');
    });
  }

  ui.el.playerNameInput?.addEventListener('input', (event) => {
    store.setName(event.target.value);
    ui.updateProfile();
    syncAvatar();
  });

  /* ---------------------------------------------------------------- game */
  ui.el.pauseBtn?.addEventListener('click', () => mission.pause());
  ui.el.muteBtn?.addEventListener('click', toggleMute);

  ui.el.resumeBtn?.addEventListener('click', () => mission.resume());
  ui.el.progressBtn?.addEventListener('click', () => {
    ui.closeOverlay('pause');
    mission.showMissionProgress();
  });
  ui.el.pauseSettingsBtn?.addEventListener('click', () => {
    ui.syncSettingsInputs();
    ui.openOverlay('settings');
  });
  ui.el.pauseRestartBtn?.addEventListener('click', () => {
    ui.confirm({
      title: 'Restart the mission?',
      text: 'The clock and all answers for this mission will be reset.',
      yes: 'Restart',
    }, () => mission.restart());
  });
  ui.el.quitBtn?.addEventListener('click', () => {
    ui.confirm({
      title: 'End this mission?',
      text: 'You will see the report for the answers given so far.',
      yes: 'End mission',
    }, () => mission.abandon());
  });

  /* ------------------------------------------------------------- results */
  ui.el.replayBtn?.addEventListener('click', () => { audio.play('click'); mission.start(store.get().level); });
  ui.el.resultsMenuBtn?.addEventListener('click', () => { audio.play('close'); ui.showScreen('menu'); ui.updateProfile(); });
  ui.el.practiceWeakBtn?.addEventListener('click', () => {
    const result = lastResult;
    if (!result) { ui.showScreen('practice'); return; }
    const scored = Object.entries(result.skills)
      .filter(([key, stat]) => key !== 'speaking' && stat.total > 0 && stat.percent !== null)
      .sort((a, b) => a[1].percent - b[1].percent);
    const weakest = scored[0]?.[0] || 'vocabulary';
    ui.el.practiceLevel.value = result.level;
    ui.renderPractice();
    ui.showScreen('practice');
    ui.toast(`Weakest skill this mission: ${SKILL_INFO[weakest]?.name || weakest}. Starting focused practice.`, { ms: 3000 });
    runPractice(weakest, result.level);
  });

  /* ------------------------------------------------------------ settings */
  ui.bindSettings({
    onChange: (key, value, settings) => {
      audio.applySettings(settings);
      applyGraphicsSettings(settings);
      if (key === 'musicOn') {
        if (value && mission.isPlaying && !ui.anyOverlayOpen()) audio.startMusic();
        if (!value) audio.stopMusic();
      }
      if (key === 'music' || key === 'sfx') audio.play('select');
    },
  });
  ui.syncSettingsInputs();
  ui.applyA11yClasses();
  applyGraphicsSettings(store.getSettings());
  updateMuteButton();

  ui.el.resetProgressBtn?.addEventListener('click', () => {
    ui.confirm({
      title: 'Reset local progress?',
      text: 'XP, badges, best scores and settings on this device will be deleted. This cannot be undone.',
      yes: 'Reset everything',
    }, () => {
      store.reset();
      ui.syncSettingsInputs();
      ui.applyA11yClasses();
      applyGraphicsSettings(store.getSettings());
      audio.applySettings(store.getSettings());
      ui.updateProfile();
      ui.toast('Local progress reset.', { warn: true });
    });
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
    if (ui.el.installHint) ui.el.installHint.textContent = 'Install this game on your device';
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
        /* offline caching is optional; the game still runs */
      });
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mission.isPlaying) mission.pause();
  });

  window.addEventListener('beforeunload', () => {
    if (mission.isPlaying) mission.timer?.pause();
  });

  /* ---------------------------------------------------------------- boot */
  drawLogo(logoCanvas, 0);
  ui.updateProfile();
  syncAvatar();
  ui.setBootStatus('Campus ready · press START MISSION');
  ui.el.bootBtn?.removeAttribute('disabled');
  document.body.classList.add('is-booted');
  window.__ENGLISH_CLUB__ = { store, ui, mission, activities, dialogue, audio, formatClock };
  console.info('[English Club] ready', {
    screens: ui.screens.size,
    levels: LEVELS,
    skills: [...SKILLS, 'culture'],
    exercises: LEVELS.reduce((sum, level) => sum + [...SKILLS, 'culture']
      .reduce((n, skill) => n + getExercises(skill, level).length, 0), 0),
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
