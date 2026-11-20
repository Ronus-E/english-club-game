/**
 * Screen and overlay controller plus all static UI rendering:
 * profile chips, level cards, achievements, practice grid, quiz pips,
 * results and settings.
 */
import { LEVELS, LEVEL_INFO, SKILLS, SKILL_INFO } from '../content/schema.js';
import { allTags, QUIZ_STAGES, stageQuestionCount } from '../content/index.js';
import { achievementProgress } from '../core/achievements.js';
import { levelFromXp } from '../core/storage.js';
import { drawResultsBadge } from './decor.js';
import { escapeHtml } from '../core/util.js';
import { h } from './activities.js';
import { iconSvg } from './icons.js';

export const SCREEN_IDS = ['splash', 'menu', 'level', 'stages', 'quiz', 'results', 'practice', 'progress', 'achievements'];
const OVERLAY_IDS = ['settings', 'help', 'about', 'stage', 'activity', 'confirm'];
export const QUIZ_SKILLS = [...SKILLS, 'culture'];

export class UI {
  constructor({ store, audio }) {
    this.store = store;
    this.audio = audio;
    this.el = {};
    const ids = [
      'app', 'offlineBanner', 'bootBtn', 'bootStatus',
      'playBtn', 'practiceBtn', 'dailyBtn', 'shareBtn', 'howBtn', 'achievementsBtn', 'settingsBtn',
      'comebackCard', 'comebackCount', 'comebackBtn',
      'aboutBtn', 'installBtn', 'installHint', 'progressBtn', 'progressHint',
      'profileName', 'profileStats', 'profileAvatar', 'storageBadge',
      'levelGrid', 'levelContinueBtn', 'placementBtn', 'playerNameInput',
      'stageGrid', 'stagesTitle', 'stagesLead',
      'quizQuitBtn', 'quizOpenBtn', 'quizKicker', 'quizTitle', 'quizStatus', 'quizPips',
      'resultScore', 'resultMax', 'resultGrade', 'resultXp', 'newBest',
      'resultCorrect', 'resultWrong', 'resultsBadgeCanvas', 'skillReport',
      'answerReview', 'recommendations', 'sessionAchievements', 'resultsTitle', 'resultsSubtitle',
      'replayBtn', 'nextStageBtn', 'reviewMistakesBtn', 'practiceWeakBtn', 'resultsMenuBtn', 'shareCardBtn',
      'stageWelcomeTitle', 'stageWelcomeLead', 'stageWelcomeNum',
      'stageWelcomeKicker', 'stageContinueBtn', 'stageRestartBtn', 'stageBackBtn',
      'practiceLevel', 'practiceSummary', 'practiceTag', 'practiceTagBtn', 'skillGrid',
      'progressContent',
      'achievementLevel', 'achievementName', 'achievementXp',
      'levelProgressBar', 'bestScore', 'achievementGrid',
      'resetProgressBtn',
      'musicVolume', 'musicVolumeOut', 'sfxVolume', 'sfxVolumeOut', 'musicToggle',
      'reducedGraphics', 'reduceMotion', 'highContrast', 'largeText',
      'weeklyGoal', 'weeklyGoalOut', 'exportBtn', 'importBtn', 'importFile',
      'updateBanner', 'updateBtn',
      'confirmTitle', 'confirmText', 'confirmYes', 'confirmNo',
      'overlayRoot', 'overlay-settings', 'overlay-help', 'overlay-about',
      'overlay-stage', 'overlay-activity', 'overlay-confirm',
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
    this.renderComeback();
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

  renderComeback() {
    if (!this.el.comebackCard) return;
    const items = this.store.getComeback(3);
    this.el.comebackCard.hidden = items.length === 0;
    if (this.el.comebackCount) this.el.comebackCount.textContent = String(items.length);
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
      h('span', {
        class: 'level-best',
        text: best
          ? `Best ${best}% · stage ${this.store.stageState(level).unlocked} of ${QUIZ_STAGES}`
          : `Stage 1 of ${QUIZ_STAGES} · not attempted`,
      }),
      );
      grid.append(card);
    }
    if (this.el.playerNameInput && document.activeElement !== this.el.playerNameInput) {
      this.el.playerNameInput.value = p.name;
    }
  }

  /* ------------------------------------------------------------ stage grid */
  renderStageGrid(level = this.store.get().level, { onPick } = {}) {
    const grid = this.el.stageGrid;
    if (!grid) return;
    const info = LEVEL_INFO[level];
    const state = this.store.stageState(level);
    if (this.el.stagesTitle) {
      this.el.stagesTitle.textContent = `${info?.short || level} · ${QUIZ_STAGES} quiz stages`;
    }
    if (this.el.stagesLead) {
      this.el.stagesLead.textContent = `Level ${level} · ${QUIZ_STAGES} stages of 5–9 questions. `
        + 'The difficulty rises stage by stage. Score 60% or more to unlock the next one.';
    }
    grid.replaceChildren();
    for (const entry of state.entries) {
      const size = stageQuestionCount(entry.stage);
      const icon = entry.cleared ? 'check' : entry.unlocked ? 'play' : 'lock';
      const badge = h('span', { class: 'stage-icon', 'aria-hidden': 'true' });
      badge.innerHTML = iconSvg(icon);
      const status = entry.cleared
        ? `Cleared · best ${entry.best}%`
        : entry.current
          ? (entry.best ? `Current stage · best ${entry.best}%` : 'Current stage · play now')
          : entry.unlocked
            ? (entry.best ? `Best ${entry.best}% · replay` : 'Ready to play')
            : `Locked · clear stage ${entry.stage - 1} first`;
      const button = h('button', {
        class: `stage-card${entry.unlocked ? '' : ' is-locked'}${entry.cleared ? ' is-cleared' : ''}${entry.current ? ' is-current' : ''}`,
        type: 'button',
        dataset: { stage: String(entry.stage), level },
        disabled: !entry.unlocked,
        'aria-disabled': entry.unlocked ? 'false' : 'true',
        'aria-label': `Stage ${entry.stage}, ${size} questions. ${status}`,
        onclick: () => {
          if (!entry.unlocked) return;
          this.audio.play('select');
          onPick?.(entry.stage);
        },
      },
      h('span', { class: 'stage-top' },
        h('span', { class: 'stage-num', text: `Stage ${entry.stage}` }),
        badge,
      ),
      h('strong', { class: 'stage-size', text: `${size} questions` }),
      h('span', { class: 'stage-bar' }, h('i', { style: `width:${entry.unlocked ? entry.best : 0}%` })),
      h('small', { class: 'stage-meta', text: status }),
      );
      grid.append(button);
    }
  }

  /* ----------------------------------------------------- stage welcome */
  renderStageWelcome({ level = this.store.get().level, stage = 1, total = stageQuestionCount(stage), label = null } = {}) {
    const info = LEVEL_INFO[level];
    const state = this.store.stageState(level);
    const entry = state.entries.find((row) => row.stage === stage);
    const best = entry?.best || 0;
    const nextStage = Math.min(QUIZ_STAGES, stage + 1);
    if (this.el.stageWelcomeKicker) {
      this.el.stageWelcomeKicker.textContent = label
        ? `${label} · ${level} · Stage ${stage} of ${QUIZ_STAGES}`
        : `Level ${level} · ${info?.short || level} · Stage ${stage} of ${QUIZ_STAGES}`;
    }
    if (this.el.stageWelcomeTitle) {
      this.el.stageWelcomeTitle.textContent = `Welcome to stage ${stage}`;
    }
    if (this.el.stageWelcomeNum) this.el.stageWelcomeNum.textContent = String(stage);
    if (this.el.stageWelcomeLead) {
      const parts = [
        `${total} question${total === 1 ? '' : 's'} across five skills, written for ${level} ${info?.short || ''}`.trim() + '.',
      ];
      if (stage === 1) parts.push('This warm-up uses the easiest questions of the level.');
      else parts.push(`Difficulty is one step higher than stage ${stage - 1}, still inside ${level}.`);
      parts.push(best >= 60
        ? `Your best score here is ${best}%. Beat it to improve your record.`
        : `Score 60% or more to unlock stage ${nextStage === stage ? 'the next level' : nextStage}.`);
      this.el.stageWelcomeLead.textContent = parts.join(' ');
    }
    if (this.el.stageContinueBtn) {
      this.el.stageContinueBtn.textContent = best >= 60 ? `CONTINUE → STAGE ${stage} · ${level}` : `CONTINUE → STAGE ${stage}`;
    }
    if (this.el.stageRestartBtn) {
      this.el.stageRestartBtn.hidden = stage === 1;
      this.el.stageRestartBtn.textContent = `RESTART FROM STAGE 1 · ${level}`;
    }
  }

  /* ------------------------------------------------------------- quiz UI */
  setQuizHeader(level, total = 5, stage = 1) {
    if (this.el.quizKicker) this.el.quizKicker.textContent = `${level} · Stage ${stage} · ${total} questions`;
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

  /* ---------------------------------------------------------------- topics */
  renderTagSelect(selected = '') {
    const select = this.el.practiceTag;
    if (!select) return;
    const tags = allTags(30);
    select.replaceChildren(h('option', { value: '', text: 'Choose a topic…' }));
    for (const { tag, count } of tags) {
      select.append(h('option', { value: tag, text: `${tag} (${count})` }));
    }
    select.value = tags.some((t) => t.tag === selected) ? selected : '';
  }

  /* ------------------------------------------------------------- progress */
  renderProgress() {
    const host = this.el.progressContent;
    if (!host) return;
    const p = this.store.get();
    const goal = Math.max(1, Number(p.settings.weeklyGoal) || 3);
    const done = this.store.weeklyCount();
    const ratio = Math.min(100, Math.round((done / goal) * 100));
    host.replaceChildren(
      h('div', { class: 'panel progress-card' },
        h('p', { class: 'kicker', text: 'This week' }),
        h('h3', { text: `${done} of ${goal} quizzes` }),
        h('div', { class: 'progress-track' }, h('i', { style: `width:${ratio}%` })),
        h('p', { class: 'muted', text: done >= goal ? 'Weekly goal reached. Well done.' : `${goal - done} more quiz${goal - done === 1 ? '' : 'zes'} to reach your goal.` }),
      ),
      h('div', { class: 'panel progress-card' },
        h('p', { class: 'kicker', text: 'Lifetime' }),
        h('h3', { text: `${p.missions} quiz${p.missions === 1 ? '' : 'zes'} completed` }),
        h('p', { class: 'muted', text: `${p.xp} XP · ${Object.keys(p.achievements).length} of 10 badges` }),
      ),
      h('div', { class: 'panel progress-card' },
        h('p', { class: 'kicker', text: 'Quiz stages' }),
        ...LEVELS.map((level) => {
          const state = this.store.stageState(level);
          return h('div', { class: 'progress-history' },
            h('span', { text: `${level} · stage ${state.unlocked} of ${QUIZ_STAGES}` }),
            h('strong', { text: `${state.cleared}/${QUIZ_STAGES} cleared` }),
          );
        }),
      ),
      h('div', { class: 'panel progress-card progress-skills' },
        h('p', { class: 'kicker', text: 'Skills' }),
        ...Object.entries(p.skills).map(([key, stat]) => {
          const percent = stat.total ? Math.round((stat.correct / stat.total) * 100) : null;
          const name = SKILL_INFO[key]?.name || key;
          return h('div', { class: 'progress-skill' },
            h('span', { class: 'progress-skill-name', text: name }),
            h('span', { class: 'progress-skill-track' }, h('i', { style: `width:${percent ?? 0}%` })),
            h('span', { class: 'progress-skill-val', text: percent === null ? '—' : `${percent}%` }),
          );
        }),
      ),
      h('div', { class: 'panel progress-card' },
        h('p', { class: 'kicker', text: 'Recent quizzes' }),
        ...(p.history.length
          ? p.history.slice(-5).reverse().map((entry) => h('div', { class: 'progress-history' },
            h('span', { text: `${entry.date} · ${entry.level}${entry.stage ? ` · Stage ${entry.stage}` : ''}` }),
            h('strong', { text: `${entry.percent}%` }),
          ))
          : [h('p', { class: 'muted', text: 'No quiz recorded yet.' })]),
      ),
    );
  }

  /* ------------------------------------------------------------- settings */
  syncSettingsInputs() {
    const s = this.store.getSettings();
    const map = {
      musicVolume: 'music', sfxVolume: 'sfx', musicToggle: 'musicOn',
      reducedGraphics: 'reducedGraphics', reduceMotion: 'reduceMotion',
      highContrast: 'highContrast', largeText: 'largeText', weeklyGoal: 'weeklyGoal',
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
      largeText: ['largeText', Boolean], weeklyGoal: ['weeklyGoal', Number],
    };
    for (const [id, [key, cast]] of Object.entries(map)) {
      const input = this.el[id];
      if (!input) continue;
      const handler = () => {
        const value = input.type === 'checkbox' ? input.checked : cast(input.value);
        this.store.setSetting(key, value);
        this.syncSettingLabels();
        onChange?.(key, value, this.store.getSettings());
      };
      const events = input.tagName === 'SELECT' ? ['change'] : ['input'];
      for (const eventName of events) input.addEventListener(eventName, handler);
    }
    this.syncSettingLabels();
  }

  syncSettingLabels() {
    const s = this.store.getSettings();
    if (this.el.musicVolumeOut) this.el.musicVolumeOut.textContent = `${s.music}%`;
    if (this.el.sfxVolumeOut) this.el.sfxVolumeOut.textContent = `${s.sfx}%`;
    if (this.el.weeklyGoalOut) this.el.weeklyGoalOut.textContent = String(s.weeklyGoal);
  }

  applyA11yClasses() {
    const s = this.store.getSettings();
    document.documentElement.classList.toggle('reduce-motion', Boolean(s.reduceMotion));
    document.documentElement.classList.toggle('high-contrast', Boolean(s.highContrast));
    document.documentElement.classList.toggle('large-text', Boolean(s.largeText));
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
  renderResults(result, { unlocked = [], review = [] } = {}) {
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
      this.el.resultsSubtitle.textContent = `Level ${result.level}${result.stage ? ` · Stage ${result.stage}` : ''} · ${result.correct} correct · ${result.wrong} to review`;
    }
    if (this.el.newBest) this.el.newBest.hidden = !result.isNewBest;
    if (this.el.nextStageBtn) {
      const current = Number(result.stage) || 0;
      const next = current + 1;
      const show = Boolean(result.stagePassed) && current > 0 && next <= QUIZ_STAGES;
      this.el.nextStageBtn.hidden = !show;
      this.el.nextStageBtn.textContent = show ? `Next level → Stage ${next}` : 'Next level →';
      this.el.nextStageBtn.dataset.stage = show ? String(next) : '';
      this.el.nextStageBtn.dataset.level = show ? result.level : '';
    }

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

    const answerHost = this.el.answerReview;
    if (answerHost) {
      answerHost.replaceChildren();
      if (!review.length) {
        answerHost.append(h('p', { class: 'muted', text: 'No question review available for this run.' }));
      } else {
        for (const row of review) {
          answerHost.append(h('article', { class: `review-item ${row.correct ? 'is-correct' : 'is-wrong'}` },
            h('header', { class: 'review-head' },
              h('span', { class: 'review-num', text: String(row.number).padStart(2, '0') }),
              h('span', { class: 'review-skill', text: SKILL_INFO[row.skill]?.name || row.skill }),
              h('strong', { class: 'review-status', text: row.correct ? 'Correct' : 'To review' }),
            ),
            h('p', { class: 'review-prompt', text: row.prompt }),
            h('p', { class: 'review-line' }, h('strong', { text: 'Your answer: ' }), row.yourAnswer),
            row.correct
              ? h('p', { class: 'review-line' }, h('strong', { text: 'Correct answer: ' }), row.expected)
              : h('p', { class: 'review-line is-fix' }, h('strong', { text: 'Correction: ' }), row.expected),
            row.explanation ? h('p', { class: 'micro muted', text: row.explanation }) : null,
            row.note ? h('p', { class: 'source-note', text: row.note }) : null,
          ));
        }
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
        strip.append(h('span', { class: 'badge',
          title: def.description,
          tabindex: 0 },
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
