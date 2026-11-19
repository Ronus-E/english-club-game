import { vocabulary } from './vocabulary.js';
import { grammar } from './grammar.js';
import { reading } from './reading.js';
import { writing } from './writing.js';
import { cultureBank } from './culture.js';
import { LEVELS, SKILLS, SKILL_INFO, LEVEL_INFO, validateBank, checkAnswer } from './schema.js';
import { sample, shuffle, createRng, hashString, todayIso, normalizeText } from '../core/util.js';

export const banks = {
  vocabulary,
  grammar,
  reading,
  writing,
  culture: cultureBank,
};

export { LEVELS, SKILLS, SKILL_INFO, LEVEL_INFO, validateBank, checkAnswer };

export function getExercises(skill, level) {
  return banks[skill]?.[level] || [];
}

export function allExercises() {
  return Object.values(banks).flatMap((levels) => Object.values(levels).flat());
}

export function countExercises() {
  const counts = {};
  for (const skill of [...SKILLS, 'culture']) {
    counts[skill] = {};
    for (const level of LEVELS) counts[skill][level] = getExercises(skill, level).length;
  }
  return counts;
}

const byId = new Map(allExercises().map((item) => [item.id, item]));

/** Look up one authored exercise; returns undefined for unknown ids. */
export function getExerciseById(id) {
  if (!id) return undefined;
  return byId.get(String(id));
}

/**
 * Tags are authored when present, otherwise derived from the objective and
 * prompt. This keeps every exercise searchable without editing 150 records.
 */
const TAG_STOPWORDS = new Set([
  'about', 'after', 'again', 'answer', 'choose', 'correct', 'describe', 'every',
  'expression', 'first', 'form', 'given', 'identify', 'language', 'learn', 'make',
  'match', 'more', 'most', 'question', 'recognise', 'recognize', 'sentence',
  'simple', 'skill', 'statement', 'text', 'their', 'there', 'these', 'thing',
  'three', 'through', 'under', 'understand', 'use', 'using', 'what', 'when',
  'which', 'with', 'word', 'words', 'write', 'your',
]);

export function deriveTags(item) {
  if (!item) return [];
  const tags = new Set();
  for (const tag of Array.isArray(item.tags) ? item.tags : []) {
    if (typeof tag === 'string' && tag.trim()) tags.add(normalizeText(tag));
  }
  if (item.skill) tags.add(String(item.skill));
  const text = `${item.objective || ''} ${item.prompt || ''}`.toLowerCase();
  for (const raw of text.match(/[a-z][a-z'-]{3,}/g) || []) {
    const token = raw.replace(/['’].*$/, '');
    if (token.length >= 4 && !TAG_STOPWORDS.has(token)) tags.add(token);
  }
  return [...tags].filter(Boolean).slice(0, 8);
}

/** All available revision tags with their exercise counts. */
export function allTags(limit = 40) {
  const counts = new Map();
  for (const item of allExercises()) {
    for (const tag of deriveTags(item)) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

/** Exercises matching one tag, optionally restricted to one CEFR level. */
export function getExercisesByTag(tag, level = null) {
  const key = normalizeText(tag);
  if (!key) return [];
  return allExercises().filter((item) => (
    (!level || item.level === level) && deriveTags(item).includes(key)
  ));
}

/** One stable, offline seed per calendar day — no account, no leaderboard. */
export function dailySeed(iso = todayIso()) {
  return hashString(`english-club-daily-${String(iso).slice(0, 10)}`);
}

export function buildDaily(level, iso = todayIso(), stage = 1) {
  return buildStageQuiz(level, stage, dailySeed(iso));
}

/**
 * Legacy fixed quiz: three exercises from each of the five skills, interleaved.
 * Kept for compatibility with older tests; the product now uses stages.
 */
export const QUIZ_SKILLS = [...SKILLS, 'culture'];
export const QUIZ_PER_SKILL = 3;

export function buildQuiz(level, seed = Date.now()) {
  if (!LEVELS.includes(level)) throw new Error(`Unknown level: ${level}`);
  const rng = createRng(seed);
  const groups = QUIZ_SKILLS.map((skill) => sample(getExercises(skill, level), QUIZ_PER_SKILL, rng));
  const rounds = [];
  for (let i = 0; i < QUIZ_PER_SKILL; i++) {
    const round = [];
    for (const group of groups) if (group[i]) round.push(group[i]);
    rounds.push(shuffle(round, rng));
  }
  return rounds.flat();
}

/* ------------------------------------------------------------ quiz stages */

/**
 * Ten progressive stages per CEFR level. Each stage asks between five and nine
 * questions, mixing the five skills. The authored banks are ordered from the
 * simplest to the richest exercise, so a two-item sliding window over that
 * author index makes each stage slightly harder than the previous one.
 */
export const QUIZ_STAGES = 10;
export const STAGE_SIZES = [5, 5, 6, 6, 7, 7, 7, 8, 8, 9];
export const STAGE_BAND_WIDTH = 2;
const BANK_SIZE = 10;

export function normalizeStage(stage) {
  const value = Math.round(Number(stage));
  if (!Number.isFinite(value)) return 1;
  return Math.min(QUIZ_STAGES, Math.max(1, value));
}

/** Number of questions in one stage (5–9). */
export function stageQuestionCount(stage) {
  return STAGE_SIZES[normalizeStage(stage) - 1];
}

/**
 * Difficulty window on the 0..9 author index. Stage 1 uses indices 0–1,
 * stage 2 uses 1–2, and so on; the last two stages share indices 8–9.
 */
export function stageBand(stage) {
  const s = normalizeStage(stage);
  const start = Math.min(BANK_SIZE - STAGE_BAND_WIDTH, Math.max(0, s - 1));
  return { start, end: start + STAGE_BAND_WIDTH - 1, center: s - 1 };
}

/**
 * Build one stage quiz. Questions are drawn only from the stage's difficulty
 * window, one per skill with the extra slots distributed by the seed, then
 * interleaved so the same skill never appears three times in a row.
 */
export function buildStageQuiz(level, stage, seed = Date.now()) {
  if (!LEVELS.includes(level)) throw new Error(`Unknown level: ${level}`);
  const s = normalizeStage(stage);
  const total = stageQuestionCount(s);
  const { start, end } = stageBand(s);
  const rng = createRng(hashString(`stage-${level}-${s}-${seed}`));
  const skillOrder = shuffle(QUIZ_SKILLS, rng);
  const base = Math.floor(total / QUIZ_SKILLS.length);
  const extra = total % QUIZ_SKILLS.length;
  const groups = new Map();

  for (const skill of QUIZ_SKILLS) {
    const bank = getExercises(skill, level);
    const pool = [];
    for (let index = start; index <= end; index++) {
      if (bank[index]) pool.push(bank[index]);
    }
    const count = base + (skillOrder.indexOf(skill) < extra ? 1 : 0);
    groups.set(skill, sample(pool, count, rng));
  }

  const maxPerSkill = Math.max(...[...groups.values()].map((group) => group.length));
  const rounds = [];
  for (let i = 0; i < maxPerSkill; i++) {
    const round = [];
    for (const skill of QUIZ_SKILLS) {
      const group = groups.get(skill);
      if (group[i]) round.push(group[i]);
    }
    rounds.push(shuffle(round, rng));
  }
  return rounds.flat();
}

/** Six-question placement check, deliberately spread across skills and levels. */
export const placementIds = [
  'voc-a1-05',
  'gra-a1-02',
  'voc-a2-06',
  'gra-a2-03',
  'rea-a2-03',
  'gra-b1-01',
];

export function getPlacementQuestions() {
  return placementIds.map((id) => byId.get(id)).filter(Boolean);
}
