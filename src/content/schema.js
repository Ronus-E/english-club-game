/**
 * Content schema, builders and validation.
 * Every exercise is plain data: easy to audit, test and translate.
 */
import { normalizeText, createRng, hashString } from '../core/util.js';

export const LEVELS = ['A1', 'A2', 'B1'];
export const SKILLS = ['vocabulary', 'grammar', 'reading', 'writing'];
export const ALL_SKILLS = [...SKILLS, 'culture'];

export const LEVEL_INFO = {
  A1: {
    label: 'A1 · Beginner',
    short: 'Beginner',
    description: 'Everyday words, simple present, short sentences.',
    bullets: ['Classroom & daily vocabulary', 'be / have / present simple', 'Very short texts and notices'],
  },
  A2: {
    label: 'A2 · Elementary',
    short: 'Elementary',
    description: 'Past experiences, comparisons, practical situations.',
    bullets: ['Travel, food, routines', 'Past simple, comparatives, future', 'Short dialogues with detail'],
  },
  B1: {
    label: 'B1 · Intermediate',
    short: 'Intermediate',
    description: 'Opinions, connected ideas, real-world topics.',
    bullets: ['Abstract and topic vocabulary', 'Perfect tenses, conditionals, passives', 'Longer texts and articles'],
  },
};

export const SKILL_INFO = {
  vocabulary: { name: 'Vocabulary', icon: '📚', color: '#5ce1a6', blurb: 'Words and meanings' },
  grammar: { name: 'Grammar', icon: '🧩', color: '#63c5ff', blurb: 'Tenses and structures' },
  reading: { name: 'Reading', icon: '📖', color: '#ffc857', blurb: 'Short texts and notices' },
  writing: { name: 'Writing', icon: '✍', color: '#ff6b6b', blurb: 'Build a sentence' },
  culture: { name: 'American culture', icon: '🇺🇸', color: '#ffd166', blurb: 'Verified cultural facts' },
};

/**
 * Deterministic option ordering. Content is authored with the correct answer
 * first so it stays easy to audit; learners must not be able to exploit that.
 * The seed is the item id, so the order is stable across sessions and tests.
 */
export function arrangeOptions(id, options, answer) {
  if (!Array.isArray(options) || options.length < 2) return { options, answer };
  const rng = createRng(hashString(String(id)));
  const positions = options.map((_, index) => index);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return {
    options: positions.map((index) => options[index]),
    answer: positions.indexOf(answer),
  };
}

const base = (data) => ({
  type: 'choice',
  passage: null,
  ...data,
});

/** Multiple-choice question. answer = index of the correct option. */
export function choice({ id, skill, level, prompt, options, answer, explanation, objective, instruction, passage = null, tags = [] }) {
  const arranged = arrangeOptions(id, options, answer);
  return base({ id, skill, level, type: 'choice', prompt, options: arranged.options, answer: arranged.answer, explanation, objective, instruction, passage, tags });
}

/** Word ↔ picture matching set. */
export function match({ id, skill = 'vocabulary', level, pairs, explanation, objective, instruction = 'Match each word with the correct picture.', prompt = 'Tap a word, then tap its picture.', tags = [] }) {
  return { id, skill, level, type: 'match', pairs, explanation, objective, instruction, prompt, tags };
}

/** Word-order / sentence building. */
export function order({ id, skill, level, prompt, words, answerText, explanation, objective, instruction, accepted = [], tags = [] }) {
  return { id, skill, level, type: 'order', prompt, words, answerText, accepted, explanation, objective, instruction, tags };
}

/** Short written answer with accepted variants. */
export function short({ id, skill = 'writing', level, prompt, accepted, explanation, objective, instruction, hint = '', tags = [] }) {
  return { id, skill, level, type: 'short', prompt, accepted, explanation, objective, instruction, hint, tags };
}

/** American culture question. `fact` marks verified factual content. */
export function culture({ id, level, prompt, options, answer, explanation, objective, instruction = 'Choose the best answer.', fact = true, note = '', region = '' }) {
  const arranged = arrangeOptions(id, options, answer);
  return base({
    id, skill: 'culture', level, type: 'choice', prompt,
    options: arranged.options, answer: arranged.answer,
    explanation, objective, instruction, tags: [], fact, note, region,
  });
}

export function normalizeOrder(item, words) {
  return normalizeText(words.join(' '));
}

/** Check a graded exercise answer. */
export function checkAnswer(item, response) {
  if (!item) return { correct: null };
  if (item.type === 'choice') return { correct: Number(response) === item.answer };
  if (item.type === 'order') {
    const expected = normalizeText(item.answerText);
    const given = Array.isArray(response) ? normalizeText(response.join(' ')) : normalizeText(response);
    return { correct: given === expected, expected: item.answerText };
  }
  if (item.type === 'short') {
    const given = normalizeText(response);
    const accepted = (item.accepted || []).map(normalizeText);
    return { correct: accepted.includes(given), expected: item.accepted?.[0] || '' };
  }
  return { correct: null };
}

/** Validate the whole bank. Throws with a readable report on error. */
export function validateBank(banks, { perSkillLevel = 14 } = {}) {
  const problems = [];
  const ids = new Set();
  const counts = {};
  const flat = [];
  for (const [skillKey, levels] of Object.entries(banks)) {
    if (!ALL_SKILLS.includes(skillKey)) problems.push(`Unknown skill key: ${skillKey}`);
    for (const [level, items] of Object.entries(levels)) {
      if (!LEVELS.includes(level)) problems.push(`Unknown level ${level} in ${skillKey}`);
      counts[`${skillKey}:${level}`] = items.length;
      for (const item of items) {
        flat.push(item);
        if (!item.id) problems.push(`${skillKey}/${level}: item without id`);
        if (ids.has(item.id)) problems.push(`Duplicate id: ${item.id}`);
        ids.add(item.id);
        if (item.skill !== skillKey) problems.push(`${item.id}: skill mismatch (${item.skill} vs ${skillKey})`);
        if (item.level !== level) problems.push(`${item.id}: level mismatch (${item.level} vs ${level})`);
        if (!item.objective) problems.push(`${item.id}: missing objective`);
        if (!item.instruction) problems.push(`${item.id}: missing instruction`);
        if (!item.prompt) problems.push(`${item.id}: missing prompt`);
        if (!item.explanation) problems.push(`${item.id}: missing explanation`);
        if (item.type === 'choice') {
          if (!Array.isArray(item.options) || item.options.length < 3) problems.push(`${item.id}: needs at least 3 options`);
          if (typeof item.answer !== 'number' || item.answer < 0 || item.answer >= item.options.length) problems.push(`${item.id}: invalid answer index`);
          if (new Set(item.options.map(normalizeText)).size !== item.options.length) problems.push(`${item.id}: duplicate options`);
        } else if (item.type === 'match') {
          if (!Array.isArray(item.pairs) || item.pairs.length < 3) problems.push(`${item.id}: match needs 3+ pairs`);
          for (const pair of item.pairs || []) if (!pair.term || !pair.icon) problems.push(`${item.id}: pair missing term or icon`);
        } else if (item.type === 'order') {
          if (!Array.isArray(item.words) || item.words.length < 3) problems.push(`${item.id}: order needs 3+ words`);
          if (!item.answerText) problems.push(`${item.id}: order missing answerText`);
          else {
            const tokenKey = (text) => normalizeText(text).split(' ').sort().join(' ');
            if (tokenKey(item.words.join(' ')) !== tokenKey(item.answerText)) problems.push(`${item.id}: answerText is not a permutation of words`);
          }
        } else if (item.type === 'short') {
          if (!Array.isArray(item.accepted) || !item.accepted.length) problems.push(`${item.id}: short needs accepted answers`);
        } else {
          problems.push(`${item.id}: unknown type ${item.type}`);
        }
        if (skillKey === 'reading' && !item.passage) problems.push(`${item.id}: reading item missing passage`);
      }
      if (perSkillLevel && items.length < perSkillLevel) problems.push(`${skillKey}/${level}: only ${items.length} exercises (need ${perSkillLevel})`);
    }
  }
  if (problems.length) throw new Error(`Content validation failed (${problems.length} problems):\n- ${problems.join('\n- ')}`);
  return { total: flat.length, counts };
}
