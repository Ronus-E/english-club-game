import { safeStorage, todayIso } from './util.js';

export const STORAGE_KEY = 'ec.profile.v3';
export const LEVEL_XP = 120;

export const DEFAULT_SETTINGS = {
  music: 35,
  sfx: 70,
  musicOn: true,
  reducedGraphics: false,
  reduceMotion: false,
  highContrast: false,
};

export function defaultProfile() {
  return {
    version: 3,
    name: 'Explorer',
    avatar: 0,
    level: 'A1',
    xp: 0,
    missions: 0,
    best: { A1: 0, A2: 0, B1: 0 },
    achievements: {},
    skills: {},
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
  for (const key of ['musicOn', 'reducedGraphics', 'reduceMotion', 'highContrast']) {
    if (key in raw) out[key] = Boolean(raw[key]);
  }
  return out;
}

function mergeProfile(raw) {
  const base = defaultProfile();
  if (!raw || typeof raw !== 'object') return base;
  const profile = {
    ...base,
    ...raw,
    best: { ...base.best, ...(raw.best || {}) },
    achievements: { ...(raw.achievements || {}) },
    skills: { ...(raw.skills || {}) },
    settings: sanitizeSettings(raw.settings, base.settings),
  };
  if (!['A1', 'A2', 'B1'].includes(profile.level)) profile.level = 'A1';
  profile.xp = Math.max(0, Number(profile.xp) || 0);
  profile.missions = Math.max(0, Number(profile.missions) || 0);
  return profile;
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
      percent: result.percent,
      score: result.score,
      maxScore: result.maxScore,
      correct: result.correct,
      wrong: result.wrong,
    };
    for (const [skill, stat] of Object.entries(result.skills || {})) {
      if (!stat || !stat.total) continue;
      const prev = p.skills[skill] || { correct: 0, total: 0 };
      p.skills[skill] = { correct: prev.correct + stat.correct, total: prev.total + stat.total };
    }
    this.save();
    return { xpGained: result.xpGained, newBest, best: p.best[result.level] || 0, previousBest };
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
