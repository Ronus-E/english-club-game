/**
 * Screen and overlay controller plus all static UI rendering:
 * profile chips, level cards, achievements, practice grid, quiz pips,
 * results and settings.
 */
import { LEVELS, LEVEL_INFO, SKILLS, SKILL_INFO } from '../content/schema.js';
import { achievementProgress } from '../core/achievements.js';
import { levelFromXp } from '../core/storage.js';
import { drawResultsBadge } from './decor.js';
import { escapeHtml } from '../core/util.js';
import { h } from './activities.js';

export const SCREEN_IDS = ['splash', 'menu', 'level', 'quiz', 'results', 'practice', 'achievements'];
const OVERLAY_IDS = ['settings', 'help', 'about', 'activity', 'confirm'];
export const QUIZ_SKILLS = [...SKILLS, 'culture'];

export class UI {
  constructor({ store, audio }) {
    this.store = store;
    this.audio = audio;
    this.el = {};
    const ids = [
      'app', 'offlineBanner', 'bootBtn', 'bootStatus',
      'playBtn', 'practiceBtn', 'howBtn', 'achievementsBtn', 'settingsBtn',
      'aboutBtn', 'installBtn', 'installHint',
      'profileName', 'profileStats', 'profileAvatar', 'storageBadge',
      'levelGrid', 'levelContinueBtn', 'placementBtn', 'playerNameInput',
      'quizQuitBtn', 'quizOpenBtn', 'quizKicker', 'quizTitle', 'quizStatus', 'quizPips',
      'resultScore', 'resultMax', 'resultGrade', 'resultXp', 'newBest',
      'resultCorrect', 'resultWrong', 'resultsBadgeCanvas', 'skillReport',
      'recommendations', 'sessionAchievements', 'resultsTitle', 'resultsSubtitle',
      'replayBtn', 'practiceWeakBtn', 'resultsMenuBtn',
      'practiceLevel', 'practiceSummary', 'skillGrid',
      'achievementLevel', 'achievementName', 'achievementXp',
      'levelProgressBar', 'bestScore', 'achievementGrid',
      'resetProgressBtn',
      'musicVolume', 'musicVolumeOut', 'sfxVolume', 'sfxVolumeOut', 'musicToggle',
      'reducedGraphics', 'reduceMotion', 'highContrast',
      'confirmTitle', 'confirmText', 'confirmYes', 'confirmNo',
      'overlayRoot', 'overlay-settings', 'overlay-help', 'overlay-about',
      'overlay-activity', 'overlay-confirm',
      'toast',
      'activityBody', 'activityFoot', 'activityTitle', 'activityKicker',
      'activityCounter', 'activitySkill', 'activityQuit', 'activityIcon',
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
    const best = Math.max(0, ...Object.values(p.best));
    if (this.el.profileName) this.el.profileName.textContent = p.name;
    if (this.el.profileStats) {
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
      this.el.achievementXp.textContent = `${p.xp} XP · ${p.missions} ${p.missions === 1 ? 'quiz' : 'quizzes'}`;
    }
    if (this.el.levelProgressBar) {
      this.el.levelProgressBar.style.width = `${Math.round(info.ratio * 100)}%`;
    }
    if (this.el.bestScore) this.el.bestScore.textContent = best ? `${best}%` : '—';
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
    if (this.el.playerNameInput && document.activeElement !== this.el.playerNameInput) {
      this.el.playerNameInput.value = p.name;
    }
  }

  /* ------------------------------------------------------------- quiz UI */
  setQuizHeader(level, total = 15) {
    if (this.el.quizKicker) this.el.quizKicker.textContent = `${level} · ${total} questions`;
    if (this.el.quizTitle) this.el.quizTitle.textContent = `${LEVEL_INFO[level]?.short || level} quiz`;
    this.renderQuizPips({});
    this.setQuizStatus(1, total);
  }

  setQuizStatus(index, total) {
    if (this.el.quizStatus) this.el.quizStatus.textContent = `Question ${index} of ${total}`;
  }

  renderQuizPips(skills) {
    const host = this.el.quizPips;
    if (!host) return;
    host.replaceChildren();
    for (const key of QUIZ_SKILLS) {
      const stat = skills?.[key];
      const done = stat?.total > 0;
      host.append(h('span', {
        class: `skill-pip${done ? ' is-done' : ''}`,
        title: SKILL_INFO[key]?.name || key,
        text: `${done ? '✓' : '·'} ${SKILL_INFO[key]?.name || key}`,
      }));
    }
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
    for (const skill of QUIZ_SKILLS) {
      const info = SKILL_INFO[skill];
      const card = h('button', {
        class: 'skill-card', type: 'button', dataset: { skill, level },
        onclick: () => this.onPracticeSkill?.(skill, level),
      },
      h('span', { class: 'skill-icon', 'aria-hidden': 'true', text: info.icon }),
      h('strong', { text: info.name }),
      h('small', { text: info.blurb || info.description || '' }),
      h('span', { class: 'skill-count', text: '10 exercises · no timer' }),
      );
      grid.append(card);
    }
    if (this.el.practiceSummary) {
      this.el.practiceSummary.textContent = `Level ${level} · ten exercises per skill · answers and explanations shown immediately.`;
    }
  }

  /* ------------------------------------------------------------- settings */
  syncSettingsInputs() {
    const s = this.store.getSettings();
    const map = {
      musicVolume: 'music', sfxVolume: 'sfx', musicToggle: 'musicOn',
      reducedGraphics: 'reducedGraphics', reduceMotion: 'reduceMotion',
      highContrast: 'highContrast',
    };
    for (const [id, key] of Object.entries(map)) {
      const input = this.el[id];
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = Boolean(s[key]);
      else input.value = String(s[key]);
    }
    this.syncSettingLabels();
  }

  bindSettings({ onChange } = {}) {
    const map = {
      musicVolume: ['music', Number], sfxVolume: ['sfx', Number],
      musicToggle: ['musicOn', Boolean], reducedGraphics: ['reducedGraphics', Boolean],
      reduceMotion: ['reduceMotion', Boolean], highContrast: ['highContrast', Boolean],
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

  /* -------------------------------------------------------------- results */
  renderResults(result, { unlocked = [] } = {}) {
    const set = (id, value) => { if (this.el[id]) this.el[id].textContent = String(value); };
    set('resultScore', result.score);
    set('resultMax', result.maxScore);
    set('resultGrade', result.grade);
    set('resultXp', result.xpGained);
    set('resultCorrect', result.correct);
    set('resultWrong', result.wrong);

    if (this.el.resultsTitle) {
      this.el.resultsTitle.textContent = result.percent >= 75
        ? 'Outstanding quiz' : result.percent >= 50 ? 'Good work' : 'Quiz debrief';
    }
    if (this.el.resultsSubtitle) {
      this.el.resultsSubtitle.textContent = `Level ${result.level} · ${result.correct} correct · ${result.wrong} to review`;
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
      for (const line of result.recommendations) recs.append(h('li', { text: line }));
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

    if (this.el.resultsBadgeCanvas) {
      drawResultsBadge(this.el.resultsBadgeCanvas, { grade: result.grade, percent: result.percent });
    }
    this.updateProfile();
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

export { escapeHtml };
