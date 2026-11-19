/**
 * Unit tests — pure logic, no browser, no dependencies.
 * Run: node --test tests/unit.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  newSession, recordAnswer, percentFor, gradeFor, computeXp,
  recommendationsFor, computeResults, POINTS_PER_ANSWER,
} from '../src/core/scoring.js';
import { evaluateAchievements, achievementProgress, ACHIEVEMENTS } from '../src/core/achievements.js';
import {
  ProfileStore, defaultProfile, levelFromXp, STORAGE_KEY, LEVEL_XP,
  sanitizeSettings, sanitizeMistakes, sanitizeHistory, sanitizeStages,
  weekKey, EXPORT_APP, STAGE_COUNT, STAGE_PASS_PERCENT,
} from '../src/core/storage.js';
import { createRng, shuffle, sample, normalizeText, todayIso } from '../src/core/util.js';
import {
  validateBank, countExercises, buildQuiz, getExercises, allExercises,
  getPlacementQuestions, getExerciseById, deriveTags, allTags,
  getExercisesByTag, dailySeed, buildDaily,
  buildStageQuiz, stageQuestionCount, stageBand, normalizeStage,
  LEVELS, SKILLS, QUIZ_SKILLS, QUIZ_STAGES, STAGE_SIZES, banks,
} from '../src/content/index.js';
import { arrangeOptions, checkAnswer } from '../src/content/schema.js';
import { iconSvg } from '../src/ui/icons.js';
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

function fullSession(level = 'A1', correctPerSkill = 3, perSkill = 3) {
  const s = newSession(level);
  for (const skill of QUIZ_SKILLS) {
    for (let i = 1; i <= perSkill; i++) {
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

test('a perfect skill unlocks only when every graded item is correct', () => {
  const perfect = newSession('A1', 1);
  answer(perfect, 'vocabulary', 'v1', true);
  answer(perfect, 'vocabulary', 'v2', true);
  const out = evaluateAchievements({ session: perfect, result: computeResults(perfect), profile: defaultProfile() });
  assert.ok(out.some((a) => a.id === 'perfect_vocab'));

  const partial = newSession('A1', 1);
  answer(partial, 'vocabulary', 'v1', true);
  answer(partial, 'vocabulary', 'v2', false);
  const out2 = evaluateAchievements({ session: partial, result: computeResults(partial), profile: defaultProfile() });
  assert.ok(!out2.some((a) => a.id === 'perfect_vocab'));

  const none = newSession('A1', 1);
  const out3 = evaluateAchievements({ session: none, result: computeResults(none), profile: defaultProfile() });
  assert.ok(!out3.some((a) => a.id === 'perfect_vocab'));
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

test('stage progress is sanitized, bounded and repaired', () => {
  const stages = sanitizeStages({
    A1: { unlocked: 99, best: { 1: 70, 2: 150, 3: -5, 11: 80, foo: 50 } },
    A2: { unlocked: 'x', best: { 1: 60 } },
    B1: null,
  });
  assert.equal(stages.A1.unlocked, STAGE_COUNT);
  assert.equal(stages.A1.best[1], 70);
  assert.equal(stages.A1.best[2], 100);
  assert.equal(stages.A1.best[3], 0);
  assert.ok(!(11 in stages.A1.best) && !('foo' in stages.A1.best));
  assert.equal(stages.A2.unlocked, 2);
  assert.equal(stages.B1.unlocked, 1);
  assert.deepEqual(stages.B1.best, {});
  assert.equal(sanitizeStages(null).A1.unlocked, 1);
});

test('recording a stage unlocks the next one at the pass threshold only', () => {
  const store = storeWith();
  const passed = store.recordStage('A2', 1, STAGE_PASS_PERCENT);
  assert.equal(passed.passed, true);
  assert.equal(passed.best, STAGE_PASS_PERCENT);
  assert.equal(passed.unlocked, 2);
  assert.equal(passed.unlockedStage, 2);

  const lower = store.recordStage('A2', 1, 40);
  assert.equal(lower.newBest, false);
  assert.equal(lower.best, STAGE_PASS_PERCENT);
  assert.equal(store.stageState('A2').unlocked, 2);

  const failed = store.recordStage('A2', 2, STAGE_PASS_PERCENT - 1);
  assert.equal(failed.passed, false);
  assert.equal(failed.unlockedStage, null);
  assert.equal(store.stageState('A2').unlocked, 2);

  const second = store.recordStage('A2', 2, 75);
  assert.equal(second.unlockedStage, 3);
  const last = store.recordStage('A2', STAGE_COUNT, 100);
  assert.equal(last.unlocked, STAGE_COUNT);
  const state = store.stageState('A2');
  assert.equal(state.entries.length, STAGE_COUNT);
  assert.equal(state.entries[0].cleared, true);
  assert.equal(state.entries[1].cleared, true);
  assert.equal(state.entries[1].current, false);
  assert.equal(state.entries[STAGE_COUNT - 1].unlocked, true);
});

test('profile export and import keep stage progress', () => {
  const store = storeWith();
  store.recordStage('B1', 1, 80);
  store.recordStage('B1', 2, 70);
  const fresh = storeWith();
  fresh.importProfile(store.exportProfile());
  const state = fresh.stageState('B1');
  assert.equal(state.unlocked, 3);
  assert.equal(state.entries[0].best, 80);
  assert.equal(state.entries[1].best, 70);
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

test('the legacy fixed builder remains available for compatibility', () => {
  const legacyPerSkill = 3;
  for (const level of LEVELS) {
    const q = buildQuiz(level, 1234);
    assert.equal(q.length, legacyPerSkill * QUIZ_SKILLS.length);
    const counts = {};
    for (const item of q) {
      counts[item.skill] = (counts[item.skill] || 0) + 1;
      assert.equal(item.level, level, item.id);
    }
    assert.deepEqual(counts, Object.fromEntries(QUIZ_SKILLS.map((s) => [s, legacyPerSkill])));
    assert.equal(new Set(q.map((i) => i.id)).size, q.length);
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

/* ------------------------------------------------------------- stage model */
test('ten stages per level use 5 to 9 questions', () => {
  assert.equal(QUIZ_STAGES, 10);
  assert.equal(STAGE_SIZES.length, QUIZ_STAGES);
  assert.equal(Math.min(...STAGE_SIZES), 5);
  assert.equal(Math.max(...STAGE_SIZES), 9);
  for (let stage = 1; stage <= QUIZ_STAGES; stage++) {
    assert.equal(stageQuestionCount(stage), STAGE_SIZES[stage - 1]);
  }
  assert.equal(stageQuestionCount(0), 5);
  assert.equal(stageQuestionCount(99), 9);
  assert.equal(normalizeStage(3.4), 3);
});

test('every stage quiz respects its level, size, skills and uniqueness', () => {
  for (const level of LEVELS) {
    for (let stage = 1; stage <= QUIZ_STAGES; stage++) {
      const quiz = buildStageQuiz(level, stage, 4242);
      assert.equal(quiz.length, stageQuestionCount(stage), `${level} stage ${stage}`);
      assert.equal(new Set(quiz.map((item) => item.id)).size, quiz.length);
      const counts = {};
      for (const item of quiz) {
        assert.equal(item.level, level, item.id);
        counts[item.skill] = (counts[item.skill] || 0) + 1;
      }
      assert.deepEqual(Object.keys(counts).sort(), [...QUIZ_SKILLS].sort());
      const values = Object.values(counts);
      assert.ok(Math.max(...values) - Math.min(...values) <= 1, JSON.stringify(counts));
    }
  }
});

test('stage quizzes are reproducible and interleave the five skills', () => {
  const ids = (level, stage, seed) => buildStageQuiz(level, stage, seed).map((item) => item.id).join('|');
  assert.equal(ids('A2', 5, 99), ids('A2', 5, 99));
  const quiz = buildStageQuiz('B1', 10, 2026);
  const runs = quiz.reduce((acc, item) => {
    if (acc.length && acc[acc.length - 1].skill === item.skill) acc[acc.length - 1].n += 1;
    else acc.push({ skill: item.skill, n: 1 });
    return acc;
  }, []);
  assert.ok(runs.every((run) => run.n <= 2), JSON.stringify(runs));
  assert.ok(runs.length >= 5, JSON.stringify(runs));
});

test('the difficulty window slides through the authored bank', () => {
  let previous = { start: -1, end: -1 };
  for (let stage = 1; stage <= QUIZ_STAGES; stage++) {
    const band = stageBand(stage);
    assert.ok(band.start >= 0 && band.end <= 9, JSON.stringify(band));
    assert.ok(band.start < band.end, JSON.stringify(band));
    assert.ok(band.start >= previous.start && band.end >= previous.end, `stage ${stage}`);
    previous = band;
  }
  assert.deepEqual(stageBand(1), { start: 0, end: 1, center: 0 });
  assert.equal(stageBand(10).end, 9);

  const authorIndex = (level, item) => getExercises(item.skill, level)
    .findIndex((candidate) => candidate.id === item.id);
  for (const level of LEVELS) {
    for (let stage = 1; stage <= QUIZ_STAGES; stage++) {
      const band = stageBand(stage);
      for (const item of buildStageQuiz(level, stage, 7)) {
        const index = authorIndex(level, item);
        assert.ok(index >= band.start && index <= band.end, `${item.id} outside stage ${stage}`);
      }
    }
  }

  // Across the full sequence the later stages clearly draw on richer items.
  for (const level of LEVELS) {
    const average = (stages) => {
      const values = stages.flatMap((stage) => buildStageQuiz(level, stage, 555)
        .map((item) => authorIndex(level, item)));
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    };
    assert.ok(average([8, 9, 10]) > average([1, 2, 3]) + 3, level);
  }
});

test('the stage builder rejects an unknown level', () => {
  assert.throws(() => buildStageQuiz('C1', 1, 1), /Unknown level/);
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
  quiz.start('A1', 55, 1);
  assert.equal(opened.items.length, stageQuestionCount(1));
  assert.equal(quiz.stage, 1);
  assert.equal(quiz.session.stage, 1);
  assert.equal(quiz.isActive, true);
  for (const item of opened.items) {
    opened.onAnswer({ item, correct: true, response: 0 });
  }
  assert.equal(quiz.session.answers.length, stageQuestionCount(1));
  opened.onFinish();
  assert.equal(ended.result.percent, 100);
  assert.equal(ended.result.grade, 'S');
  assert.equal(ended.result.stage, 1);
  assert.equal(ended.result.stagePassed, true);
  assert.equal(ended.result.stageUnlocked, 2);
  assert.equal(store.get().missions, 1);
  assert.equal(store.get().best.A1, 100);
  assert.equal(store.stageState('A1').unlocked, 2);
  assert.equal(store.stageState('A1').entries[0].best, 100);
  assert.equal(quiz.session, null);
});

test('failing a stage keeps the next stage locked', () => {
  const store = storeWith();
  let opened = null;
  let ended = null;
  const activities = {
    isOpen: true,
    open(config) { opened = config; },
    close() { this.isOpen = false; },
  };
  const quiz = new Quiz({ store, activities, onEnd: (event) => { ended = event; } });
  quiz.start('A2', 11, 1);
  opened.items.forEach((item, index) => {
    opened.onAnswer({ item, correct: index < 2, response: 0 });
  });
  opened.onFinish();
  assert.equal(ended.result.percent, 40);
  assert.equal(ended.result.stagePassed, false);
  assert.equal(ended.result.stageUnlocked, null);
  assert.equal(store.stageState('A2').unlocked, 1);
  assert.equal(store.stageState('A2').entries[0].best, 40);
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

/* --------------------------------------------------- new local improvements */
test('settings sanitizers clamp weekly goal and reject bad types', () => {
  const s = sanitizeSettings({ weeklyGoal: 99, largeText: 'yes', music: -8 });
  assert.equal(s.weeklyGoal, 14);
  assert.equal(s.largeText, true);
  assert.equal(s.music, 0);
  assert.equal(sanitizeSettings(null).weeklyGoal, 3);
});

test('week keys start on Monday and stay stable inside one week', () => {
  assert.equal(weekKey('2026-11-19'), '2026-11-16');
  assert.equal(weekKey('2026-11-16'), '2026-11-16');
  assert.equal(weekKey('2026-11-22'), '2026-11-16');
  assert.equal(weekKey('2026-11-23'), '2026-11-23');
});

test('mistake and history sanitizers bound hostile records', () => {
  const mistakes = sanitizeMistakes({
    good: { count: 900, skill: 'vocabulary', level: 'A1', last: '2026-11-19' },
    bad: { count: 'x', level: 'C1' },
  });
  assert.equal(mistakes.good.count, 99);
  assert.equal(mistakes.bad.count, 1);
  assert.equal(mistakes.bad.level, '');
  const history = sanitizeHistory([
    { date: '2026-11-19', level: 'B1', percent: 900, correct: -2 },
    { date: 'bad' },
  ]);
  assert.equal(history.length, 1);
  assert.equal(history[0].percent, 100);
  assert.equal(history[0].correct, 0);
});

test('mistake book counts repeats and records only failed answers', () => {
  const store = storeWith();
  store.recordMistakes([
    { itemId: 'voc-a1-01', correct: false, skill: 'vocabulary', level: 'A1' },
    { itemId: 'voc-a1-01', correct: false, skill: 'vocabulary', level: 'A1' },
    { itemId: 'gra-a1-01', correct: true, skill: 'grammar', level: 'A1' },
  ]);
  assert.equal(store.getMistakes().length, 1);
  assert.equal(store.getMistakes()[0].count, 2);
  assert.equal(store.clearMistake('voc-a1-01'), true);
  assert.equal(store.getMistakes().length, 0);
});

test('weekly count uses the stored history and the selected goal', () => {
  const store = storeWith();
  store.setSetting('weeklyGoal', 5);
  store.profile.history = [
    { date: '2026-11-16', level: 'A1', percent: 80, correct: 12 },
    { date: '2026-11-18', level: 'A2', percent: 90, correct: 13 },
    { date: '2026-11-23', level: 'B1', percent: 70, correct: 10 },
  ];
  assert.equal(store.weeklyCount('2026-11-19'), 2);
  assert.equal(store.weeklyGoal(), 5);
});

test('profile export and import preserve progress with an app marker', () => {
  const store = storeWith();
  store.setName('Ronus');
  store.recordSession(computeResults(fullSession('A1', 3)));
  const payload = store.exportProfile();
  assert.match(payload, new RegExp(EXPORT_APP));
  const fresh = storeWith();
  fresh.importProfile(payload);
  assert.equal(fresh.get().name, 'Ronus');
  assert.equal(fresh.get().missions, 1);
  assert.equal(fresh.get().best.A1, 100);
});

test('profile import rejects foreign apps, huge files and absurd values', () => {
  const store = storeWith();
  assert.throws(
    () => store.importProfile(JSON.stringify({ app: 'Another App', profile: defaultProfile() })),
    /another application/,
  );
  assert.throws(() => store.importProfile('x'.repeat(1_000_001)), /too large/);
  store.importProfile(JSON.stringify({
    app: EXPORT_APP,
    profile: {
      xp: 10 ** 12, missions: -5, best: { A1: 900 },
      skills: { vocabulary: { correct: 99, total: 5 } },
      achievements: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`badge${i}`, { date: '2026-01-01' }])),
    },
  }));
  const p = store.get();
  assert.equal(p.xp, 1_000_000_000);
  assert.equal(p.missions, 0);
  assert.equal(p.best.A1, 100);
  assert.equal(p.skills.vocabulary.correct, 5);
  assert.equal(Object.keys(p.achievements).length, 40);
});

test('content helpers resolve ids, derive tags and filter exercises', () => {
  const first = allExercises()[0];
  assert.equal(getExerciseById(first.id), first);
  assert.equal(getExerciseById('does-not-exist'), undefined);
  const tags = deriveTags(first);
  assert.ok(tags.includes(first.skill));
  assert.ok(tags.length > 0 && tags.length <= 8);
  const listed = allTags(200);
  assert.ok(listed.length > 10);
  assert.ok(listed.every((entry) => entry.count >= 1));
  const tag = listed.find((entry) => entry.count >= 2)?.tag || first.skill;
  const matches = getExercisesByTag(tag, first.level);
  assert.ok(matches.length >= 1);
  assert.ok(matches.every((item) => item.level === first.level));
});

test('daily seed is stable and builds the requested stage', () => {
  assert.equal(dailySeed('2026-11-19'), dailySeed('2026-11-19'));
  assert.notEqual(dailySeed('2026-11-19'), dailySeed('2026-11-20'));
  const a = buildDaily('B1', '2026-11-19').map((item) => item.id).join('|');
  const b = buildDaily('B1', '2026-11-19').map((item) => item.id).join('|');
  assert.equal(a, b);
  assert.equal(a.split('|').length, stageQuestionCount(1));
  assert.equal(buildDaily('B1', '2026-11-19', 5).length, stageQuestionCount(5));
});

test('every picture-matching icon has a scalable offline SVG', () => {
  const icons = new Set();
  for (const levels of Object.values(banks)) {
    for (const items of Object.values(levels)) {
      for (const item of items.filter((i) => i.type === 'match')) {
        for (const pair of item.pairs) icons.add(pair.icon);
      }
    }
  }
  assert.ok(icons.size >= 10, `only ${icons.size} match icons found`);
  for (const icon of icons) {
    const svg = iconSvg(icon);
    assert.match(svg, /^<svg /, icon);
    assert.match(svg, /viewBox="0 0 24 24"/, icon);
    assert.match(svg, /<(?:path|circle|rect)\b/, icon);
  }
});

test('the quiz is silent, locked until the end and produces a full review', () => {
  const store = storeWith();
  let opened = null;
  let ended = null;
  const activities = {
    isOpen: true,
    open(config) { opened = config; },
    close() { this.isOpen = false; },
  };
  const quiz = new Quiz({ store, activities, onEnd: (event) => { ended = event; } });
  quiz.start('A1', 321, 3);
  assert.equal(opened.silent, true);
  assert.equal(opened.noQuit, true);
  assert.equal(opened.finishLabel, 'See my report');
  assert.equal(quiz.stage, 3);
  assert.equal(quiz.session.stage, 3);
  for (const item of opened.items) {
    opened.onAnswer({ item, correct: false, response: 'wrong' });
  }
  opened.onFinish();
  assert.equal(ended.review.length, stageQuestionCount(3));
  assert.equal(ended.review[0].correct, false);
  assert.equal(typeof ended.review[0].prompt, 'string');
  assert.ok(ended.review[0].expected.length > 0);
  assert.equal(store.getMistakes().length, stageQuestionCount(3));
});
