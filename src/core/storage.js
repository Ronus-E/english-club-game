import { safeStorage, todayIso, clamp } from './util.js';

export const STORAGE_KEY = 'ec.profile.v3';
export const LEVEL_XP = 120;
export const EXPORT_APP = 'English Club Quiz';
export const STAGE_COUNT = 10;
export const STAGE_PASS_PERCENT = 60;
const LEVEL_KEYS = ['A1', 'A2', 'B1'];

export const DEFAULT_SETTINGS = {
  music: 100,
  sfx: 70,
  musicOn: true,
  reducedGraphics: false,
  reduceMotion: false,
  highContrast: false,
  largeText: false,
  weeklyGoal: 3,
};

const MAX_MISTAKES = 80;
const MAX_HISTORY = 200;
const MAX_ACHIEVEMENTS = 40;
const MAX_IMPORT_BYTES = 1_000_000;

export function defaultProfile() {
  return {
    version: 3,
    name: 'Explorer',
    avatar: 0,
    level: 'A1',
    xp: 0,
    missions: 0,
    best: { A1: 0, A2: 0, B1: 0 },
    stages: {
      A1: { unlocked: 1, best: {} },
      A2: { unlocked: 1, best: {} },
      B1: { unlocked: 1, best: {} },
    },
    achievements: {},
    skills: {},
    mistakes: {},
    history: [],
    lastSession: null,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function levelFromXp(xp) {
  const level = Math.floor(Math.max(0, xp) / LEVEL_XP) + 1;
  const into = Math.max(0, xp) % LEVEL_XP;
  return { level, into, needed: LEVEL_XP, ratio: into / LEVEL_XP };
}

/** Settings come from localStorage: never trust their types or ranges. */
export function sanitizeSettings(raw, base = DEFAULT_SETTINGS) {
  const out = { ...base };
  if (!raw || typeof raw !== 'object') return out;
  for (const key of ['music', 'sfx']) {
    const value = Number(raw[key]);
    if (Number.isFinite(value)) out[key] = Math.min(100, Math.max(0, Math.round(value)));
  }
  for (const key of ['musicOn', 'reducedGraphics', 'reduceMotion', 'highContrast', 'largeText']) {
    if (key in raw) out[key] = Boolean(raw[key]);
  }
  if ('weeklyGoal' in raw) {
    const goal = Number(raw.weeklyGoal);
    if (Number.isFinite(goal)) out.weeklyGoal = Math.round(clamp(goal, 1, 14));
  }
  return out;
}

/** Mistake book: only the exercise id and a small, bounded record are kept. */
export function sanitizeMistakes(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!id || typeof id !== 'string' || id.length > 64 || !value || typeof value !== 'object') continue;
    out[id] = {
      count: Math.round(clamp(Number(value.count) || 1, 1, 99)),
      skill: typeof value.skill === 'string' ? value.skill.slice(0, 24) : '',
      level: ['A1', 'A2', 'B1'].includes(value.level) ? value.level : '',
      last: typeof value.last === 'string' ? value.last.slice(0, 10) : '',
    };
  }
  return out;
}

/** Recent quiz results; old entries are dropped rather than kept forever. */
export function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => entry && typeof entry === 'object'
      && typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date))
    .slice(-MAX_HISTORY)
    .map((entry) => ({
      date: String(entry.date).slice(0, 10),
      level: ['A1', 'A2', 'B1'].includes(entry.level) ? entry.level : 'A1',
      stage: Number.isFinite(Number(entry.stage))
        ? Math.round(clamp(Number(entry.stage), 1, STAGE_COUNT))
        : null,
      percent: Math.round(clamp(Number(entry.percent) || 0, 0, 100)),
      correct: Math.max(0, Math.round(Number(entry.correct) || 0)),
    }));
}

function sanitizeBest(raw) {
  const out = { A1: 0, A2: 0, B1: 0 };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const level of Object.keys(out)) {
    const value = Number(raw[level]);
    if (Number.isFinite(value)) out[level] = Math.round(clamp(value, 0, 100));
  }
  return out;
}

/**
 * Stage progress per level: one unlocked stage (1..10) and the best percent
 * obtained on each played stage (0..100). A passed stage also repairs the
 * unlocked counter when a profile is imported or edited by hand.
 */
export function sanitizeStages(raw) {
  const out = {};
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  for (const level of LEVEL_KEYS) {
    const saved = source[level] && typeof source[level] === 'object' && !Array.isArray(source[level])
      ? source[level]
      : {};
    const unlocked = Number(saved.unlocked);
    const state = {
      unlocked: Number.isFinite(unlocked)
        ? Math.round(clamp(unlocked, 1, STAGE_COUNT))
        : 1,
      best: {},
    };
    const savedBest = saved.best && typeof saved.best === 'object' && !Array.isArray(saved.best)
      ? saved.best
      : {};
    for (const [key, value] of Object.entries(savedBest)) {
      const stage = Number(key);
      const percent = Number(value);
      if (!Number.isInteger(stage) || stage < 1 || stage > STAGE_COUNT) continue;
      if (!Number.isFinite(percent)) continue;
      state.best[stage] = Math.round(clamp(percent, 0, 100));
      if (state.best[stage] >= STAGE_PASS_PERCENT) {
        state.unlocked = Math.max(state.unlocked, Math.min(STAGE_COUNT, stage + 1));
      }
    }
    out[level] = state;
  }
  return out;
}

function sanitizeAchievements(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw).slice(0, MAX_ACHIEVEMENTS)) {
    if (!id || typeof id !== 'string' || id.length > 48) continue;
    const entry = value && typeof value === 'object' ? value : {};
    out[id.slice(0, 48)] = {
      date: typeof entry.date === 'string' ? entry.date.slice(0, 10) : todayIso(),
      name: typeof entry.name === 'string' ? entry.name.slice(0, 48) : id.slice(0, 48),
    };
  }
  return out;
}

const SKILL_KEYS = new Set(['vocabulary', 'grammar', 'reading', 'writing', 'culture']);

function sanitizeSkills(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!SKILL_KEYS.has(key) || !value || typeof value !== 'object') continue;
    const total = Math.round(clamp(Number(value.total) || 0, 0, 1_000_000));
    const correct = Math.round(clamp(Number(value.correct) || 0, 0, 1_000_000));
    out[key] = { correct: Math.min(correct, total), total };
  }
  return out;
}

function mergeProfile(raw) {
  const base = defaultProfile();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const profile = {
    ...base,
    ...raw,
    best: sanitizeBest(raw.best),
    stages: sanitizeStages(raw.stages),
    achievements: sanitizeAchievements(raw.achievements),
    skills: sanitizeSkills(raw.skills),
    mistakes: sanitizeMistakes(raw.mistakes),
    history: sanitizeHistory(raw.history),
    settings: sanitizeSettings(raw.settings, base.settings),
  };
  profile.version = 3;
  if (!['A1', 'A2', 'B1'].includes(profile.level)) profile.level = 'A1';
  profile.xp = Math.round(clamp(Number(profile.xp) || 0, 0, 1_000_000_000));
  profile.missions = Math.round(clamp(Number(profile.missions) || 0, 0, 1_000_000));
  profile.avatar = Math.round(clamp(Number(profile.avatar) || 0, 0, 99));
  profile.name = String(profile.name || '').trim().slice(0, 16) || 'Explorer';
  return profile;
}

/** Monday-based week key, so the weekly goal resets on Monday morning. */
export function weekKey(iso = todayIso()) {
  const parts = String(iso).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return String(iso).slice(0, 10);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

/** Pure selector for the comeback queue: most repeated first, newest tie-break. */
export function selectComeback(mistakes, limit = 3) {
  if (!Array.isArray(mistakes)) return [];
  const value = Number(limit);
  const n = Number.isFinite(value) ? Math.max(0, Math.min(10, Math.round(value))) : 3;
  return mistakes
    .filter((entry) => entry && typeof entry.id === 'string' && entry.id.length > 0 && entry.id.length <= 64)
    .slice()
    .sort((a, b) => (Number(b.count) || 1) - (Number(a.count) || 1)
      || String(b.last || '').localeCompare(String(a.last || '')))
    .slice(0, n)
    .map((entry) => ({
      id: entry.id,
      count: Number(entry.count) || 1,
      skill: typeof entry.skill === 'string' ? entry.skill : '',
      level: typeof entry.level === 'string' ? entry.level : '',
      last: typeof entry.last === 'string' ? entry.last : '',
    }));
}

/**
 * Versioned localStorage profile. Accepts an injected storage object so the
 * unit tests can run without a browser.
 */
export class ProfileStore {
  constructor(storage = safeStorage()) {
    this.storage = storage;
    this.available = Boolean(storage);
    this.profile = this.load();
    this._listeners = new Set();
  }

  load() {
    if (!this.storage) return defaultProfile();
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      return mergeProfile(raw ? JSON.parse(raw) : null);
    } catch {
      return defaultProfile();
    }
  }

  save() {
    if (this.storage) {
      try {
        this.storage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      } catch {
        this.available = false;
      }
    }
    this._listeners.forEach((fn) => fn(this.profile));
    return this.profile;
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  get() { return this.profile; }

  getSettings() { return this.profile.settings; }

  patch(partial) {
    Object.assign(this.profile, partial);
    return this.save();
  }

  setSetting(key, value) {
    this.profile.settings = { ...this.profile.settings, [key]: value };
    return this.save();
  }

  setName(name) {
    const clean = String(name || '').trim().slice(0, 16);
    this.profile.name = clean || 'Explorer';
    return this.save();
  }

  setAvatar(index) {
    this.profile.avatar = Math.max(0, Number(index) || 0);
    return this.save();
  }

  setLevel(level) {
    if (['A1', 'A2', 'B1'].includes(level)) this.profile.level = level;
    return this.save();
  }

  /**
   * Persist a finished quiz. Returns { xpGained, newBest, best }.
   * XP rewards correct answers only; no timer is involved.
   */
  recordSession(result) {
    const p = this.profile;
    const previousBest = p.best[result.level] || 0;
    const newBest = result.percent > previousBest;
    if (newBest) p.best[result.level] = result.percent;
    p.xp += result.xpGained;
    p.missions += 1;
    p.lastSession = {
      date: todayIso(),
      level: result.level,
      stage: Number.isFinite(Number(result.stage)) ? Math.round(clamp(Number(result.stage), 1, STAGE_COUNT)) : null,
      percent: result.percent,
      score: result.score,
      maxScore: result.maxScore,
      correct: result.correct,
      wrong: result.wrong,
    };
    p.history = sanitizeHistory([...p.history, {
      date: p.lastSession.date,
      level: result.level,
      stage: p.lastSession.stage,
      percent: result.percent,
      correct: result.correct,
    }]);
    for (const [skill, stat] of Object.entries(result.skills || {})) {
      if (!stat || !stat.total) continue;
      const prev = p.skills[skill] || { correct: 0, total: 0 };
      p.skills[skill] = { correct: prev.correct + stat.correct, total: prev.total + stat.total };
    }
    this.save();
    return { xpGained: result.xpGained, newBest, best: p.best[result.level] || 0, previousBest };
  }

  /* --------------------------------------------------------- mistake book */
  recordMistakes(answers = []) {
    const today = todayIso();
    let added = 0;
    for (const answer of answers) {
      if (!answer || answer.correct !== false || !answer.itemId) continue;
      const id = String(answer.itemId).slice(0, 64);
      const current = this.profile.mistakes[id] || { count: 0, skill: '', level: '', last: '' };
      this.profile.mistakes[id] = {
        count: Math.min(99, current.count + 1),
        skill: typeof answer.skill === 'string' ? answer.skill.slice(0, 24) : current.skill,
        level: ['A1', 'A2', 'B1'].includes(answer.level) ? answer.level : current.level,
        last: today,
      };
      added += 1;
    }
    const ids = Object.keys(this.profile.mistakes);
    if (ids.length > MAX_MISTAKES) {
      const keep = ids
        .sort((a, b) => (this.profile.mistakes[b].count - this.profile.mistakes[a].count)
          || String(this.profile.mistakes[b].last).localeCompare(String(this.profile.mistakes[a].last)))
        .slice(0, MAX_MISTAKES);
      const trimmed = {};
      for (const id of keep) trimmed[id] = this.profile.mistakes[id];
      this.profile.mistakes = trimmed;
    }
    if (added) this.save();
    return added;
  }

  getMistakes() {
    return Object.entries(this.profile.mistakes)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count || String(b.last).localeCompare(String(a.last)));
  }

  /** A short, bounded queue of the most relevant saved mistakes. */
  getComeback(limit = 3) {
    return selectComeback(this.getMistakes(), limit);
  }

  clearMistake(id) {
    if (!id || !(id in this.profile.mistakes)) return false;
    delete this.profile.mistakes[id];
    this.save();
    return true;
  }

  clearMistakes() {
    this.profile.mistakes = {};
    return this.save();
  }

  /* --------------------------------------------------------- progress */
  weeklyCount(iso = todayIso()) {
    const key = weekKey(iso);
    return this.profile.history.filter((entry) => weekKey(entry.date) === key).length;
  }

  weeklyGoal() {
    return this.profile.settings.weeklyGoal;
  }

  /* -------------------------------------------------------------- stages */
  /** Stage grid data for one level: unlocked, current, cleared and best. */
  stageState(level = this.profile.level) {
    const key = LEVEL_KEYS.includes(level) ? level : this.profile.level;
    const saved = this.profile.stages[key] || { unlocked: 1, best: {} };
    const entries = [];
    let cleared = 0;
    for (let stage = 1; stage <= STAGE_COUNT; stage++) {
      const best = Number(saved.best[stage]) || 0;
      const isCleared = best >= STAGE_PASS_PERCENT;
      if (isCleared) cleared += 1;
      entries.push({
        stage,
        best,
        unlocked: stage <= saved.unlocked,
        cleared: isCleared,
        current: stage === saved.unlocked,
      });
    }
    return {
      level: key,
      unlocked: saved.unlocked,
      current: saved.unlocked,
      cleared,
      total: STAGE_COUNT,
      best: { ...saved.best },
      entries,
    };
  }

  /**
   * Store one stage result. A score of 60 % or more unlocks the next stage.
   * Returns the new best, whether the stage passed and the newly opened stage.
   */
  recordStage(level, stage, percent) {
    const key = LEVEL_KEYS.includes(level) ? level : 'A1';
    const s = Math.round(clamp(Number(stage) || 1, 1, STAGE_COUNT));
    const value = Math.round(clamp(Number(percent) || 0, 0, 100));
    const data = this.profile.stages[key];
    const previousBest = Number(data.best[s]) || 0;
    const newBest = value > previousBest;
    if (newBest) data.best[s] = value;
    const passed = value >= STAGE_PASS_PERCENT;
    const previousUnlocked = data.unlocked;
    if (passed) data.unlocked = Math.max(data.unlocked, Math.min(STAGE_COUNT, s + 1));
    this.save();
    return {
      level: key,
      stage: s,
      percent: value,
      best: data.best[s] || 0,
      newBest,
      passed,
      unlocked: data.unlocked,
      unlockedStage: data.unlocked > previousUnlocked ? data.unlocked : null,
    };
  }

  /* --------------------------------------------------------- portability */
  exportProfile() {
    const payload = {
      app: EXPORT_APP,
      exportedAt: new Date().toISOString(),
      profile: mergeProfile(this.profile),
    };
    return JSON.stringify(payload, null, 2);
  }

  importProfile(text) {
    const raw = String(text || '');
    if (raw.length > MAX_IMPORT_BYTES) {
      throw new Error('That profile file is too large.');
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error('The selected file is not valid JSON.');
    }
    if (payload && typeof payload === 'object' && 'app' in payload && payload.app !== EXPORT_APP) {
      throw new Error('That file belongs to another application.');
    }
    const source = payload && typeof payload === 'object' && payload.profile ? payload.profile : payload;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error('This file does not contain a quiz profile.');
    }
    const known = ['name', 'xp', 'missions', 'best', 'stages', 'achievements', 'skills', 'mistakes', 'history', 'settings'];
    if (!known.some((key) => key in source)) {
      throw new Error('The profile has no recognised fields.');
    }
    this.profile = mergeProfile(source);
    this.save();
    return this.profile;
  }

  unlock(achievement) {
    if (this.profile.achievements[achievement.id]) return false;
    this.profile.achievements[achievement.id] = { date: todayIso(), name: achievement.name };
    this.save();
    return true;
  }

  hasAchievement(id) { return Boolean(this.profile.achievements[id]); }

  reset() {
    this.profile = defaultProfile();
    if (this.storage) {
      try { this.storage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
    this.save();
    return this.profile;
  }
}
