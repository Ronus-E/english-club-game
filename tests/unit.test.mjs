/**
 * Unit tests — pure logic, no browser, no dependencies.
 * Run: node --test tests/unit.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  newSession, recordAnswer, percentFor, gradeFor, computeXp,
  recommendationsFor, computeResults, POINTS_PER_ANSWER,
  QUESTIONS_PER_QUIZ, QUESTIONS_PER_SKILL,
} from '../src/core/scoring.js';
import { evaluateAchievements, achievementProgress, ACHIEVEMENTS } from '../src/core/achievements.js';
import {
  ProfileStore, defaultProfile, levelFromXp, STORAGE_KEY, LEVEL_XP,
} from '../src/core/storage.js';
import { createRng, shuffle, sample, normalizeText, todayIso } from '../src/core/util.js';
import {
  validateBank, countExercises, buildQuiz, getExercises,
  getPlacementQuestions, LEVELS, SKILLS, QUIZ_SKILLS, banks,
} from '../src/content/index.js';
import { arrangeOptions, checkAnswer } from '../src/content/schema.js';
import { Quiz } from '../src/game/quiz.js';

/* ------------------------------------------------------------------ helpers */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

const storeWith = () => new ProfileStore(new MemoryStorage());

function answer(session, skill, id, correct) {
  return recordAnswer(session, { skill, itemId: id, correct, response: 'x' });
}

function fullSession(level = 'A1', correctPerSkill = 3) {
  const s = newSession(level);
  for (const skill of QUIZ_SKILLS) {
    for (let i = 1; i <= QUESTIONS_PER_SKILL; i++) {
      answer(s, skill, `${skill}-${i}`, i <= correctPerSkill);
    }
  }
  return s;
}

/* ------------------------------------------------------------------ scoring */
test('a new session starts empty for all five skills', () => {
  const s = newSession('A2');
  assert.equal(s.level, 'A2');
  assert.deepEqual(s.answers, []);
  assert.equal(s.score, 0);
  assert.equal(s.maxScore, 0);
  assert.deepEqual(Object.keys(s.skills), QUIZ_SKILLS);
  for (const stat of Object.values(s.skills)) assert.deepEqual(stat, { correct: 0, total: 0 });
  assert.ok(!('usedSeconds' in s) && !('stationsVisited' in s));
});

test('answers, score and maximum score stay consistent', () => {
  const s = newSession('A1');
  answer(s, 'vocabulary', 'v1', true);
  answer(s, 'grammar', 'g1', false);
  answer(s, 'grammar', 'g2', true);
  assert.equal(s.answers.length, 3);
  assert.equal(s.maxScore, 3 * POINTS_PER_ANSWER);
  assert.equal(s.score, 2 * POINTS_PER_ANSWER);
  assert.deepEqual(s.skills.grammar, { correct: 1, total: 2 });
  assert.equal(s.answers[1].correct, false);
});

test('percentFor returns null when nothing was graded', () => {
  assert.equal(percentFor(null), null);
  assert.equal(percentFor({ correct: 0, total: 0 }), null);
  assert.equal(percentFor({ correct: 2, total: 3 }), 67);
});

test('grades follow the documented thresholds', () => {
  assert.equal(gradeFor(100), 'S');
  assert.equal(gradeFor(90), 'S');
  assert.equal(gradeFor(89), 'A');
  assert.equal(gradeFor(75), 'A');
  assert.equal(gradeFor(74), 'B');
  assert.equal(gradeFor(60), 'B');
  assert.equal(gradeFor(59), 'C');
  assert.equal(gradeFor(40), 'C');
  assert.equal(gradeFor(39), 'D');
  assert.equal(gradeFor(0), 'D');
});

test('XP rewards correct answers only, never speed or exploration', () => {
  const s = fullSession('A1', 3);
  assert.equal(computeXp(s), 45);
  const zero = fullSession('A1', 0);
  assert.equal(computeXp(zero), 0);
  assert.ok(!('stations' in s));
});

test('results report per-skill percentages and a new best', () => {
  const s = newSession('B1');
  answer(s, 'vocabulary', 'v1', true);
  answer(s, 'vocabulary', 'v2', false);
  answer(s, 'grammar', 'g1', true);
  const r = computeResults(s, 40);
  assert.equal(r.percent, 67);
  assert.equal(r.grade, 'B');
  assert.equal(r.correct, 2);
  assert.equal(r.wrong, 1);
  assert.equal(r.answered, 3);
  assert.equal(r.score, 20);
  assert.equal(r.maxScore, 30);
  assert.equal(r.xpGained, 6);
  assert.equal(r.best, 67);
  assert.equal(r.isNewBest, true);
  assert.equal(r.skills.vocabulary.percent, 50);
  assert.equal(r.skills.grammar.percent, 100);
  assert.equal(r.skills.culture.percent, null);
  assert.ok(!('usedSeconds' in r));
});

test('an answerless session produces a defensible report', () => {
  const r = computeResults(newSession('A1'));
  assert.equal(r.percent, 0);
  assert.equal(r.grade, 'D');
  assert.equal(r.answered, 0);
  assert.equal(r.isNewBest, false);
  assert.ok(r.recommendations.length >= 1);
});

test('recommendations target the weakest graded skills first', () => {
  const s = newSession('A1');
  answer(s, 'reading', 'r1', false);
  answer(s, 'grammar', 'g1', true);
  const recs = recommendationsFor(s.skills);
  assert.equal(recs.length, 2);
  assert.match(recs[0], /^Reading \(0%\)/);
  assert.match(recs[1], /^Grammar \(100%\)/);
});

/* ------------------------------------------------------------- achievements */
test('first quiz always unlocks Club Member', () => {
  const out = evaluateAchievements({
    session: fullSession('A1', 0), result: computeResults(fullSession('A1', 0)), profile: defaultProfile(),
  });
  assert.ok(out.some((a) => a.id === 'first_mission'));
});

test('perfect vocabulary needs all three answers correct', () => {
  const two = newSession('A1');
  answer(two, 'vocabulary', 'v1', true);
  answer(two, 'vocabulary', 'v2', true);
  const out = evaluateAchievements({ session: two, result: computeResults(two), profile: defaultProfile() });
  assert.ok(!out.some((a) => a.id === 'perfect_vocab'));
  const three = newSession('A1');
  for (let i = 1; i <= 3; i++) answer(three, 'vocabulary', `v${i}`, true);
  const out2 = evaluateAchievements({ session: three, result: computeResults(three), profile: defaultProfile() });
  assert.ok(out2.some((a) => a.id === 'perfect_vocab'));
});

test('the all-skills badge replaces campus exploration', () => {
  const strong = fullSession('A1', 2);
  const out = evaluateAchievements({ session: strong, result: computeResults(strong), profile: defaultProfile() });
  assert.ok(out.some((a) => a.id === 'all_skills'));
  assert.ok(!ACHIEVEMENTS.some((a) => a.id === 'explorer'));
  assert.equal(ACHIEVEMENTS.length, 10);
});

test('B1 badge needs at least 60 percent', () => {
  const s = fullSession('B1', 1);
  const r = computeResults(s);
  assert.ok(!evaluateAchievements({ session: s, result: r, profile: defaultProfile() })
    .some((a) => a.id === 'b1_mission'));
  const s2 = fullSession('B1', 2);
  assert.ok(evaluateAchievements({ session: s2, result: computeResults(s2), profile: defaultProfile() })
    .some((a) => a.id === 'b1_mission'));
});

test('already unlocked achievements are never returned twice', () => {
  const s = fullSession('A1', 3);
  const profile = defaultProfile();
  profile.achievements = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, { date: '2026-01-01' }]));
  assert.deepEqual(evaluateAchievements({ session: s, result: computeResults(s), profile }), []);
});

test('achievement list and progress agree', () => {
  const p = defaultProfile();
  p.achievements = { first_mission: { date: '2026-01-01' } };
  const progress = achievementProgress(p);
  assert.equal(progress.length, ACHIEVEMENTS.length);
  assert.equal(progress.filter((a) => a.unlocked).length, 1);
  assert.equal(progress.find((a) => a.id === 'first_mission').date, '2026-01-01');
});

/* ------------------------------------------------------------------- storage */
test('store falls back to defaults with no storage at all', () => {
  const store = new ProfileStore(null);
  assert.deepEqual(store.get(), defaultProfile());
  assert.equal(store.available, false);
});

test('store persists profile, settings and achievements', () => {
  const mem = new MemoryStorage();
  const store = new ProfileStore(mem);
  store.setName('Ronus');
  store.setLevel('B1');
  store.setSetting('highContrast', true);
  store.unlock({ id: 'first_mission', name: 'Club Member' });
  const fresh = new ProfileStore(mem);
  assert.equal(fresh.get().name, 'Ronus');
  assert.equal(fresh.get().level, 'B1');
  assert.equal(fresh.getSettings().highContrast, true);
  assert.equal(fresh.hasAchievement('first_mission'), true);
  assert.ok(mem.getItem(STORAGE_KEY));
});

test('names are clamped and invalid levels rejected', () => {
  const store = storeWith();
  store.setName('x'.repeat(80));
  assert.equal(store.get().name.length, 16);
  store.setLevel('C2');
  assert.equal(store.get().level, 'A1');
});

test('recording a quiz updates XP, missions, best and skill totals', () => {
  const store = storeWith();
  const s = fullSession('B1', 2);
  const result = computeResults(s, 0);
  const before = store.get();
  const unlocked = evaluateAchievements({ session: s, result, profile: before });
  store.recordSession(result);
  for (const badge of unlocked) store.unlock(badge);
  assert.equal(store.get().xp, 30);
  assert.equal(store.get().missions, 1);
  assert.equal(store.get().best.B1, 67);
  assert.equal(store.get().skills.vocabulary.total, 3);
  assert.equal(store.get().skills.culture.correct, 2);
  assert.ok(store.get().achievements.first_mission);
  assert.ok(!('usedSeconds' in store.get().lastSession));
});

test('unlocking is idempotent', () => {
  const store = storeWith();
  assert.equal(store.unlock({ id: 'x', name: 'X' }), true);
  assert.equal(store.unlock({ id: 'x', name: 'X' }), false);
});

test('corrupt storage never breaks the app', () => {
  const mem = new MemoryStorage();
  mem.setItem(STORAGE_KEY, '{not json');
  const store = new ProfileStore(mem);
  assert.deepEqual(store.get(), defaultProfile());
});

test('unknown and hostile values are merged safely', () => {
  const mem = new MemoryStorage();
  mem.setItem(STORAGE_KEY, JSON.stringify({ xp: -9, missions: -4, level: 'ZZ', settings: { music: 900, sfx: -2 } }));
  const store = new ProfileStore(mem);
  assert.equal(store.get().xp, 0);
  assert.equal(store.get().missions, 0);
  assert.equal(store.get().level, 'A1');
  assert.equal(store.getSettings().music, 100);
  assert.equal(store.getSettings().sfx, 0);
});

test('reset clears everything on the device', () => {
  const store = storeWith();
  store.setName('X');
  store.recordSession(computeResults(fullSession('A1')));
  store.reset();
  assert.deepEqual(store.get(), defaultProfile());
});

test('level progression is monotonic and bounded', () => {
  assert.deepEqual(levelFromXp(0), { level: 1, into: 0, needed: LEVEL_XP, ratio: 0 });
  assert.equal(levelFromXp(LEVEL_XP).level, 2);
  assert.equal(levelFromXp(LEVEL_XP * 9).level, 10);
});

/* --------------------------------------------------------------------- util */
test('seeded randomness is reproducible', () => {
  const a = createRng(42);
  const b = createRng(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notDeepEqual([createRng(1)(), createRng(1)()], [createRng(2)(), createRng(2)()]);
});

test('sample never returns more than the source', () => {
  const src = [1, 2, 3];
  assert.equal(sample(src, 10).length, 3);
  assert.equal(sample(src, 2).length, 2);
  assert.deepEqual([...sample(src, 3)].sort(), [1, 2, 3]);
});

test('shuffle keeps the same members', () => {
  const src = [1, 2, 3, 4, 5];
  assert.deepEqual([...shuffle(src, createRng(7))].sort(), src);
});

test('answer normalisation ignores case, spacing and punctuation', () => {
  assert.equal(normalizeText('  The Eiffel Tower! '), normalizeText('the eiffel tower'));
  assert.notEqual(normalizeText('book'), normalizeText('notebook'));
});

test('todayIso returns a stable calendar date', () => {
  assert.match(todayIso(), /^\d{4}-\d{2}-\d{2}$/);
});

/* ------------------------------------------------------------------ content */
test('every skill and level has exactly ten exercises', () => {
  const counts = countExercises();
  for (const skill of Object.keys(counts)) {
    for (const level of LEVELS) assert.equal(counts[skill][level], 10, `${skill} ${level}`);
  }
  assert.ok(!('listening' in counts) && !('speaking' in counts));
  assert.equal(Object.values(counts).reduce(
    (sum, byLevel) => sum + Object.values(byLevel).reduce((a, b) => a + b, 0), 0,
  ), 150);
});

test('the content bank validates without any schema error', () => {
  let report = null;
  assert.doesNotThrow(() => { report = validateBank(banks); });
  assert.equal(report.total, 150);
  assert.equal(Object.keys(report.counts).length, 15);
});

test('no exercise carries French help data', () => {
  for (const levels of Object.values(banks)) {
    for (const items of Object.values(levels)) {
      for (const item of items) {
        assert.ok(!('fr' in item), `${item.id} still has fr`);
        assert.ok(!('instructionFr' in item), `${item.id} still has instructionFr`);
      }
    }
  }
});

test('exercise ids are unique across the whole bank', () => {
  const ids = new Set();
  for (const levels of Object.values(banks)) {
    for (const items of Object.values(levels)) {
      for (const item of items) {
        assert.ok(!ids.has(item.id), `duplicate id ${item.id}`);
        ids.add(item.id);
      }
    }
  }
  assert.equal(ids.size, 150);
});

test('every exercise carries objective, instruction and explanation', () => {
  for (const levels of Object.values(banks)) {
    for (const items of Object.values(levels)) {
      for (const item of items) {
        assert.ok(item.objective?.length > 8, `${item.id} objective`);
        assert.ok(item.instruction, `${item.id} instruction`);
        assert.ok(item.explanation?.length > 8, `${item.id} explanation`);
      }
    }
  }
});

test('multiple-choice answers point at a real option', () => {
  for (const levels of Object.values(banks)) {
    for (const items of Object.values(levels)) {
      for (const item of items.filter((i) => i.type === 'choice')) {
        assert.ok(Number.isInteger(item.answer), `${item.id} answer index`);
        assert.ok(item.answer >= 0 && item.answer < item.options.length, `${item.id} answer range`);
      }
    }
  }
});

test('option shuffling is deterministic and preserves the correct option', () => {
  for (const levels of Object.values(banks)) {
    for (const items of Object.values(levels)) {
      for (const item of items.filter((i) => i.type === 'choice')) {
        const a = arrangeOptions(item.id, item.options, item.answer);
        const b = arrangeOptions(item.id, item.options, item.answer);
        assert.deepEqual(a, b, item.id);
        assert.equal(a.options[a.answer], item.options[item.answer], item.id);
        assert.deepEqual([...a.options].sort(), [...item.options].sort(), item.id);
      }
    }
  }
});

test('the correct option is not systematically in position A', () => {
  let first = 0;
  let total = 0;
  for (const levels of Object.values(banks)) {
    for (const items of Object.values(levels)) {
      for (const item of items.filter((i) => i.type === 'choice')) {
        total += 1;
        if (arrangeOptions(item.id, item.options, item.answer).answer === 0) first += 1;
      }
    }
  }
  assert.ok(total > 60);
  assert.ok(first / total < 0.45, `${first}/${total} answers at position A`);
});

test('checkAnswer handles choices, order and short answers', () => {
  const choice = { id: 'x', type: 'choice', answer: 1 };
  assert.deepEqual(checkAnswer(choice, 1), { correct: true });
  assert.deepEqual(checkAnswer(choice, 0), { correct: false });
  const order = { id: 'y', type: 'order', answerText: 'I am ready' };
  assert.equal(checkAnswer(order, ['I', 'am', 'ready']).correct, true);
  assert.equal(checkAnswer(order, 'ready am I').correct, false);
  const short = { id: 'z', type: 'short', accepted: ['book', 'a book'] };
  assert.equal(checkAnswer(short, 'A BOOK').correct, true);
  assert.equal(checkAnswer(short, 'pen').correct, false);
});

test('a quiz has 15 questions, three per skill, from the chosen level', () => {
  for (const level of LEVELS) {
    const q = buildQuiz(level, 1234);
    assert.equal(q.length, QUESTIONS_PER_QUIZ);
    const counts = {};
    for (const item of q) {
      counts[item.skill] = (counts[item.skill] || 0) + 1;
      assert.equal(item.level, level, item.id);
    }
    assert.deepEqual(counts, Object.fromEntries(QUIZ_SKILLS.map((s) => [s, 3])));
    assert.equal(new Set(q.map((i) => i.id)).size, 15);
  }
});

test('quizzes are stable for a given seed and vary between seeds', () => {
  const ids = (seed) => buildQuiz('A2', seed).map((i) => i.id).join('|');
  assert.equal(ids(99), ids(99));
  assert.notEqual(ids(99), ids(100));
});

test('quiz rounds interleave skills rather than grouping them', () => {
  const q = buildQuiz('B1', 2026);
  const runs = q.reduce((acc, item) => {
    if (acc.length && acc[acc.length - 1].skill === item.skill) acc[acc.length - 1].n += 1;
    else acc.push({ skill: item.skill, n: 1 });
    return acc;
  }, []);
  assert.ok(runs.every((r) => r.n <= 2), JSON.stringify(runs));
  assert.ok(runs.length >= 5, JSON.stringify(runs));
});

test('an unknown level is rejected explicitly', () => {
  assert.throws(() => buildQuiz('C1', 1), /Unknown level/);
});

test('the placement check is six distinct questions across levels', () => {
  const items = getPlacementQuestions();
  assert.equal(items.length, 6);
  assert.equal(new Set(items.map((i) => i.id)).size, 6);
  assert.ok(items.some((i) => i.level === 'A1'));
  assert.ok(items.some((i) => i.level === 'B1'));
});

test('practice returns ten exercises for any skill and level', () => {
  for (const level of LEVELS) {
    for (const skill of QUIZ_SKILLS) assert.equal(getExercises(skill, level).length, 10);
  }
});

/* --------------------------------------------------------- quiz controller */
test('the quiz controller records every answer and produces a report', () => {
  const store = storeWith();
  let opened = null;
  let ended = null;
  const activities = {
    isOpen: true,
    open(config) { opened = config; },
    close() { this.isOpen = false; },
  };
  const quiz = new Quiz({ store, activities, onEnd: (e) => { ended = e; } });
  quiz.start('A1', 55);
  assert.equal(opened.items.length, 15);
  assert.equal(quiz.isActive, true);
  for (const item of opened.items) {
    opened.onAnswer({ item, correct: true, response: 0 });
  }
  assert.equal(quiz.session.answers.length, 15);
  opened.onFinish();
  assert.equal(ended.result.percent, 100);
  assert.equal(ended.result.grade, 'S');
  assert.equal(store.get().missions, 1);
  assert.equal(store.get().best.A1, 100);
  assert.equal(quiz.session, null);
});

test('leaving a quiz closes the overlay and saves nothing', () => {
  const store = storeWith();
  let quit = false;
  const activities = {
    isOpen: true,
    open() {},
    close() { this.isOpen = false; },
  };
  const quiz = new Quiz({ store, activities });
  quiz.onQuit = () => { quit = true; };
  quiz.start('A2', 7);
  quiz.abandon();
  assert.equal(quit, true);
  assert.equal(quiz.isActive, false);
  assert.equal(store.get().missions, 0);
});
