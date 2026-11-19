import { vocabulary } from './vocabulary.js';
import { grammar } from './grammar.js';
import { reading } from './reading.js';
import { writing } from './writing.js';
import { cultureBank } from './culture.js';
import { LEVELS, SKILLS, SKILL_INFO, LEVEL_INFO, validateBank, checkAnswer } from './schema.js';
import { sample, shuffle, createRng } from '../core/util.js';

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

/**
 * Build one 15-question quiz: three exercises from each of the five skills,
 * interleaved so the same skill never appears three times in a row. The seed
 * makes a session reproducible in tests while remaining varied for learners.
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
  const byId = new Map(allExercises().map((item) => [item.id, item]));
  return placementIds.map((id) => byId.get(id)).filter(Boolean);
}
