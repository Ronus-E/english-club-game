/**
 * Screen and overlay controller plus all static UI rendering:
 * profile chips, level cards, achievements, practice grid, results, settings.
 */
import { LEVELS, LEVEL_INFO, SKILLS, SKILL_INFO } from '../content/schema.js';
import { achievementProgress } from '../core/achievements.js';
import { levelFromXp } from '../core/storage.js';
import { drawResultsBadge } from './decor.js';
import { escapeHtml } from '../core/util.js';
import { h } from './activities.js';

export const SCREEN_IDS = ['splash', 'menu', 'level', 'intro', 'game', 'results', 'practice', 'achievements'];
const OVERLAY_IDS = ['pause', 'progress', 'settings', 'help', 'about', 'dialogue', 'activity', 'confirm'];

export class UI {
  constructor({ store, audio }) {
    this.store = store;
    this.audio = audio;
    this.el = {};
    const ids = [
      'app', 'offlineBanner', 'bootBtn', 'bootStatus', 'playBtn', 'practiceBtn', 'howBtn',
      'achievementsBtn', 'settingsBtn', 'aboutBtn', 'installBtn', 'installHint',
      'profileName', 'profileStats', 'profileAvatar', 'storageBadge',
      'levelGrid', 'levelContinueBtn', 'placementBtn', 'avatarPicker', 'avatarCanvas', 'playerNameInput', 'startMissionBtn', 'introHowBtn',
      'gameCanvas', 'hud', 'hudLevel', 'hudPhase', 'hudScore', 'timerValue', 'timerBar', 'timer', 'pauseBtn', 'muteBtn',
      'interactionHint', 'interactionLabel', 'toast', 'routeBar', 'locationLabel', 'npcHint',
      'joystick', 'joystickKnob', 'actionBtn',
      'resultScore', 'resultMax', 'resultGrade', 'resultXp', 'newBest', 'resultCorrect', 'resultWrong', 'resultTime',
      'resultsBadgeCanvas', 'skillReport', 'recommendations', 'sessionAchievements', 'speakingNote',
      'replayBtn', 'practiceWeakBtn', 'resultsMenuBtn',
      'practiceLevel', 'practiceSummary', 'skillGrid', 'practiceCampusBtn',
      'achievementLevel', 'achievementName', 'achievementXp', 'levelProgressBar', 'bestScore', 'achievementGrid',
      'progressList', 'resetProgressBtn',
      'musicVolume', 'musicVolumeOut', 'sfxVolume', 'sfxVolumeOut', 'musicToggle',
      'reducedGraphics', 'reduceMotion', 'highContrast', 'frenchHints', 'forceTouch',
      'resumeBtn', 'progressBtn', 'pauseSettingsBtn', 'pauseRestartBtn', 'quitBtn',
      'confirmTitle', 'confirmText', 'confirmYes', 'confirmNo',
      'overlayRoot', 'overlay-pause', 'overlay-progress', 'overlay-settings', 'overlay-help',
      'overlay-about', 'overlay-dialogue', 'overlay-activity', 'overlay-confirm',
      'activityBody', 'activityFoot', 'activityTitle', 'activityKicker', 'activityCounter',
      'activitySkill', 'activityQuit', 'activityIcon',
      'dialogueName', 'dialogueText', 'dialogueFr', 'dialogueChoices', 'dialogueNext', 'dialoguePortrait',
    ];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.screens = new Map(SCREEN_IDS.map((id) => [id, document.getElementById(`screen-${id}`)]));
    this.overlays = new Map(OVERLAY_IDS.map((id) => [id, document.getElementById(`overlay-${id}`)]));
    this.toastTimer = 0;
    this.currentScreen = 'splash';
    this.el['overlayRoot'].hidden = true;
  }

  /* ------------------------------------------------------------- screens */
  showScreen(id) {
    for (const [key, node] of this.screens) {
      if (!node) continue;
      node.classList.toggle('is-active', key === id);
    }
    this.currentScreen = id;
    const active = this.screens.get(id);
    active?.scrollTo?.(0, 0);
    active?.querySelector('.page')?.scrollTo?.(0, 0);
  }

  /* ------------------------------------------------------------ overlays */
  openOverlay(id) {
    const node = this.overlays.get(id);
    if (!node) return;
    node.hidden = false;
    this.el['overlayRoot'].hidden = false;
    const focusable = node.querySelector('button, input, select, [tabindex]');
    focusable?.focus?.({ preventScroll: true });
  }

  closeOverlay(id) {
    const node = this.overlays.get(id);
    if (!node) return;
    node.hidden = true;
    this.syncOverlayRoot();
  }

  closeAllOverlays() {
    for (const node of this.overlays.values()) node.hidden = true;
    this.syncOverlayRoot();
  }

  syncOverlayRoot() {
    const anyOpen = [...this.overlays.values()].some((n) => !n.hidden);
    this.el['overlayRoot'].hidden = !anyOpen;
  }

  anyOverlayOpen() {
    return [...this.overlays.values()].some((n) => !n.hidden);
  }

  isOverlayOpen(id) {
    const node = this.overlays.get(id);
    return Boolean(node && !node.hidden);
  }

  /* -------------------------------------------------------------- profile */
  updateProfile() {
    const p = this.store.get();
    const info = levelFromXp(p.xp);
    if (this.el.profileName) this.el.profileName.textContent = p.name;
    if (this.el.profileStats) {
      const best = Math.max(0, ...Object.values(p.best));
      this.el.profileStats.textContent = `Lv ${info.level} · XP ${p.xp} · Best ${best}%`;
    }
    if (this.el.profileAvatar) {
      this.el.profileAvatar.textContent = (p.name || 'E').trim().charAt(0).toUpperCase() || '★';
    }
    if (this.el.storageBadge) {
      this.el.storageBadge.textContent = this.store.available
        ? 'Progress saved on this device'
        : 'Progress cannot be saved in this browser';
    }
    if (this.el.achievementName) this.el.achievementName.textContent = p.name;
    if (this.el.achievementLevel) this.el.achievementLevel.textContent = String(info.level);
    if (this.el.achievementXp) {
      this.el.achievementXp.textContent = `${p.xp} XP · ${p.missions} mission${p.missions === 1 ? '' : 's'}`;
    }
    if (this.el.levelProgressBar) {
      this.el.levelProgressBar.style.width = `${Math.round(info.ratio * 100)}%`;
    }
    if (this.el.bestScore) {
      const best = Math.max(0, ...Object.values(p.best));
      this.el.bestScore.textContent = best ? `${best}%` : '—';
    }
  }

  /* ---------------------------------------------------------- level cards */
  renderLevelGrid({ selected = 'A1', onPick } = {}) {
    const p = this.store.get();
    const grid = this.el.levelGrid;
    if (!grid) return;
    grid.replaceChildren();
    for (const level of LEVELS) {
      const info = LEVEL_INFO[level];
      const best = p.best[level] || 0;
      const card = h('button', {
        class: `level-card${level === selected ? ' is-selected' : ''}`,
        type: 'button',
        dataset: { level },
        'aria-pressed': level === selected ? 'true' : 'false',
        onclick: () => {
          this.audio.play('select');
          this.store.setLevel(level);
          this.renderLevelGrid({ selected: level, onPick });
          onPick?.(level);
        },
      },
      h('span', { class: 'level-tag', text: level }),
      h('h3', { text: info.short }),
      h('p', { text: info.description }),
      h('ul', {}, ...info.bullets.map((b) => h('li', { text: b }))),
      h('span', { class: 'level-best', text: best ? `Personal best ${best}%` : 'Not attempted yet' }),
      );
      grid.append(card);
    }
  }

  /* -------------------------------------------------------------- avatars */
  renderAvatarPicker({ onPick } = {}) {
    const p = this.store.get();
    const picker = this.el.avatarPicker;
    if (!picker) return;
    picker.replaceChildren();
    const palette = [
      ['#5ce1a6', '#2b1c17', '#e8b48a'],
      ['#63c5ff', '#141414', '#c98a63'],
      ['#ffc857', '#7a4a2b', '#f2c6a0'],
      ['#a78bfa', '#0f0f12', '#8d5a3c'],
      ['#ff6b6b', '#3a2018', '#e6b48f'],
      ['#e8eefc', '#b8862f', '#f7d7bd'],
    ];
    palette.forEach(([shirt, hair, skin], i) => {
      const swatch = h('button', {
        class: `avatar-swatch${i === p.avatar ? ' is-selected' : ''}`,
        type: 'button',
        'aria-label': `Character colour ${i + 1}`,
        'aria-pressed': i === p.avatar ? 'true' : 'false',
        style: `background:linear-gradient(180deg, ${shirt} 0 58%, ${skin} 58% 100%);border-top:6px solid ${hair}`,
        onclick: () => {
          this.store.setAvatar(i);
          this.audio.play('select');
          this.renderAvatarPicker({ onPick });
          onPick?.(i);
        },
      });
      picker.append(swatch);
    });
  }

  /* --------------------------------------------------------- achievements */
  renderAchievements() {
    const p = this.store.get();
    const grid = this.el.achievementGrid;
    if (!grid) return;
    grid.replaceChildren();
    for (const def of achievementProgress(p)) {
      grid.append(h('article', { class: `achievement-card${def.unlocked ? '' : ' is-locked'}` },
        h('span', { class: 'ach-icon', 'aria-hidden': 'true', text: def.icon }),
        h('div', {},
          h('h3', { text: def.name }),
          h('p', { text: def.description }),
          def.date ? h('span', { class: 'ach-date', text: `Unlocked ${def.date}` }) : h('span', { class: 'ach-date', text: 'Locked' }),
        ),
      ));
    }
  }

  /* ------------------------------------------------------------- practice */
  renderPractice() {
    const grid = this.el.skillGrid;
    if (!grid) return;
    const level = this.el.practiceLevel?.value || this.store.get().level || 'A1';
    grid.replaceChildren();
    for (const skill of [...SKILLS, 'culture']) {
      const info = SKILL_INFO[skill];
      const card = h('button', {
        class: 'skill-card', type: 'button', dataset: { skill, level },
        onclick: () => this.onPracticeSkill?.(skill, level),
      },
      h('span', { class: 'skill-icon', 'aria-hidden': 'true', text: info.icon }),
      h('strong', { text: info.name }),
      h('small', { text: info.blurb }),
      h('span', { class: 'skill-count', text: '10 exercises · no timer' }),
      );
      grid.append(card);
    }
    if (this.el.practiceSummary) {
      this.el.practiceSummary.textContent = `Level ${level} · 10 exercises per skill · answers and explanations shown immediately.`;
    }
  }

  /* ------------------------------------------------------------- settings */
  syncSettingsInputs() {
    const s = this.store.getSettings();
    const map = {
      musicVolume: ['music', Number],
      sfxVolume: ['sfx', Number],
      musicToggle: ['musicOn', Boolean],
      reducedGraphics: ['reducedGraphics', Boolean],
      reduceMotion: ['reduceMotion', Boolean],
      highContrast: ['highContrast', Boolean],
      frenchHints: ['frenchHints', Boolean],
      forceTouch: ['forceTouch', Boolean],
    };
    for (const [id, [key]] of Object.entries(map)) {
      const input = this.el[id];
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = Boolean(s[key]);
      else input.value = String(s[key]);
    }
    this.syncSettingLabels();
  }

  bindSettings({ onChange } = {}) {
    const map = {
      musicVolume: ['music', Number],
      sfxVolume: ['sfx', Number],
      musicToggle: ['musicOn', Boolean],
      reducedGraphics: ['reducedGraphics', Boolean],
      reduceMotion: ['reduceMotion', Boolean],
      highContrast: ['highContrast', Boolean],
      frenchHints: ['frenchHints', Boolean],
      forceTouch: ['forceTouch', Boolean],
    };
    for (const [id, [key, cast]] of Object.entries(map)) {
      const input = this.el[id];
      if (!input) continue;
      input.addEventListener('input', () => {
        const value = input.type === 'checkbox' ? input.checked : cast(input.value);
        this.store.setSetting(key, value);
        this.syncSettingLabels();
        onChange?.(key, value, this.store.getSettings());
      });
    }
    this.syncSettingLabels();
  }

  syncSettingLabels() {
    const s = this.store.getSettings();
    if (this.el.musicVolumeOut) this.el.musicVolumeOut.textContent = `${s.music}%`;
    if (this.el.sfxVolumeOut) this.el.sfxVolumeOut.textContent = `${s.sfx}%`;
  }

  applyA11yClasses() {
    const s = this.store.getSettings();
    document.documentElement.classList.toggle('reduce-motion', Boolean(s.reduceMotion));
    document.documentElement.classList.toggle('high-contrast', Boolean(s.highContrast));
    document.documentElement.classList.toggle('force-touch', Boolean(s.forceTouch));
  }

  /* --------------------------------------------------------------- toasts */
  toast(message, { warn = false, ms = 2600 } = {}) {
    const node = this.el.toast;
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-warn', warn);
    node.classList.add('is-visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => node.classList.remove('is-visible'), ms);
  }

  /* ------------------------------------------------------------------ HUD */
  updateHUD({ remaining, ratio, score, phase, level }) {
    if (this.el.timerValue) this.el.timerValue.textContent = formatClock(remaining);
    if (this.el.timerBar) this.el.timerBar.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
    if (this.el.timer) this.el.timer.classList.toggle('is-low', remaining <= 30);
    if (this.el.hudScore) this.el.hudScore.textContent = String(score);
    if (phase && this.el.hudPhase) this.el.hudPhase.textContent = phase;
    if (level && this.el.hudLevel) this.el.hudLevel.textContent = level;
  }

  renderRoute(route, { completed = [], next = null } = {}) {
    const bar = this.el.routeBar;
    if (!bar) return;
    bar.replaceChildren();
    for (const item of route) {
      if (!item?.id) continue;
      const done = completed.includes(item.id);
      bar.append(h('span', {
        class: `route-chip${done ? ' is-done' : ''}${item.id === next ? ' is-next' : ''}`,
        title: item.name,
        text: `${done ? '✓' : item.id === next ? '▸' : '·'} ${item.short}`,
      }));
    }
  }

  setInteraction(hint) {
    const box = this.el.interactionHint;
    if (!box) return;
    if (!hint) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    if (this.el.interactionLabel) this.el.interactionLabel.textContent = hint.label;
  }

  setLocation(text) {
    if (this.el.locationLabel) this.el.locationLabel.textContent = text;
  }

  /* -------------------------------------------------------------- results */
  renderResults(result, { unlocked = [], reason = 'complete' } = {}) {
    const set = (id, value) => { if (this.el[id]) this.el[id].textContent = String(value); };
    set('resultScore', result.score);
    set('resultMax', result.maxScore);
    set('resultGrade', result.grade);
    set('resultXp', result.xpGained);
    set('resultCorrect', result.correct);
    set('resultWrong', result.wrong);
    set('resultTime', formatClock(result.usedSeconds));

    const title = this.el['resultsTitle'];
    if (title) {
      title.textContent = reason === 'time'
        ? 'Time is up — mission report'
        : result.percent >= 75 ? 'Outstanding mission' : result.percent >= 50 ? 'Good mission' : 'Mission debrief';
    }
    const subtitle = this.el['resultsSubtitle'];
    if (subtitle) {
      subtitle.textContent = `Level ${result.level} · ${result.correct} correct · ${result.wrong} to review · speaking: ${result.speaking.completed ? 'completed' : 'not attempted'}`;
    }
    if (this.el.newBest) this.el.newBest.hidden = !result.isNewBest;

    const report = this.el.skillReport;
    if (report) {
      report.replaceChildren();
      for (const [key, stat] of Object.entries(result.skills)) {
        const na = !stat.total;
        report.append(h('div', { class: `skill-row${na ? ' is-na' : ''}` },
          h('span', { class: 'skill-name', text: stat.name || key }),
          h('span', { class: 'skill-track' }, h('i', { style: `width:${na ? 0 : stat.percent}%` })),
          h('span', { class: 'skill-val', text: na ? '—' : `${stat.percent}%` }),
        ));
      }
    }

    const recs = this.el.recommendations;
    if (recs) {
      recs.replaceChildren();
      result.recommendations.forEach((line) => recs.append(h('li', { text: line })));
    }

    const strip = this.el.sessionAchievements;
    if (strip) {
      strip.replaceChildren();
      if (!unlocked.length) {
        strip.append(h('span', { class: 'badge is-locked', text: 'No new badge this time — your progress is saved.' }));
      }
      for (const def of unlocked) {
        strip.append(h('span', { class: 'badge' },
          h('span', { class: 'badge-icon', 'aria-hidden': 'true', text: def.icon }),
          h('span', { text: def.name }),
        ));
      }
    }

    if (this.el['resultsBadgeCanvas']) {
      drawResultsBadge(this.el['resultsBadgeCanvas'], { grade: result.grade, percent: result.percent });
    }
    this.updateProfile();
  }

  renderProgress(entries) {
    const list = this.el.progressList;
    if (!list) return;
    list.replaceChildren();
    for (const entry of entries) {
      list.append(h('div', { class: `progress-item${entry.done ? ' is-done' : ''}` },
        h('span', { class: 'pi-icon', text: entry.done ? '✓' : '·' }),
        h('div', {},
          h('strong', { text: entry.name }),
          h('small', { text: entry.detail }),
        ),
        h('span', { class: 'pi-score', text: entry.score || '' }),
      ));
    }
  }

  setBootStatus(text) {
    if (this.el.bootStatus) this.el.bootStatus.textContent = text;
  }

  confirm({ title, text, yes = 'Confirm', no = 'Cancel' }, onYes) {
    if (this.el.confirmTitle) this.el.confirmTitle.textContent = title;
    if (this.el.confirmText) this.el.confirmText.textContent = text;
    if (this.el.confirmYes) {
      this.el.confirmYes.textContent = yes;
      this.el.confirmYes.onclick = null;
    }
    if (this.el.confirmNo) {
      this.el.confirmNo.textContent = no;
      this.el.confirmNo.onclick = () => this.closeOverlay('confirm');
    }
    if (this.el.confirmYes) {
      this.el.confirmYes.onclick = () => {
        this.closeOverlay('confirm');
        onYes?.();
      };
    }
    this.openOverlay('confirm');
  }
}

export function formatClock(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export { escapeHtml };
