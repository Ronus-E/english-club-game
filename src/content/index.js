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
 * Build the exercise sets for one 3-minute mission.
 * Kept deliberately small: 9 required interactions, plus optional bonus stations.
 */
export function buildMissionPlan(level, seed = Date.now()) {
  const rng = createRng(seed);
  const vocab = getExercises('vocabulary', level);
  const grammar = getExercises('grammar', level);
  const culture = getExercises('culture', level);
  const readingItems = getExercises('reading', level);
  const writingItems = getExercises('writing', level);

  const matchItems = vocab.filter((item) => item.type === 'match');
  const choiceItems = vocab.filter((item) => item.type === 'choice');
  const vocabSet = [
    ...sample(matchItems, 1, rng),
    ...sample(choiceItems, 2, rng),
  ];
  const grammarSet = sample(grammar, 2, rng);
  const cultureSet = sample(culture, 2, rng);
  const writingSet = sample(writingItems.filter((i) => i.type === 'order'), 1, rng);
  const finalSet = shuffle([
    ...sample(grammar.filter((i) => !grammarSet.includes(i)), 1, rng),
    ...sample(readingItems, 1, rng),
  ], rng);

  return {
    level,
    seed,
    stations: {
      vocabulary: vocabSet,
      grammar: grammarSet,
      writing: writingSet,
      culture: cultureSet,
      final: finalSet,
    },
  };
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
