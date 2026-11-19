/**
 * Unit tests — pure logic, no browser, no dependencies.
 * Run: node --test tests/unit.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { MissionTimer } from '../src/core/timer.js';
import {
  newSession, recordAnswer, completeStation, visitStation,
  computeResults, gradeFor, computeXp, percentFor, recommendationsFor,
} from '../src/core/scoring.js';
import { evaluateAchievements, achievementProgress, ACHIEVEMENTS } from '../src/core/achievements.js';
import { ProfileStore, defaultProfile, levelFromXp, STORAGE_KEY, LEVEL_XP, DEFAULT_SETTINGS } from '../src/core/storage.js';
import { demoPreset } from '../src/core/demo.js';
import { createRng, shuffle, sample, normalizeText, todayIso } from '../src/core/util.js';
import { validateBank, countExercises, buildMissionPlan, getExercises, getPlacementQuestions, LEVELS, SKILLS } from '../src/content/index.js';
import { banks } from '../src/content/index.js';
import { FR_INSTRUCTIONS, arrangeOptions } from '../src/content/schema.js';

/* ------------------------------------------------------------------ helpers */
function fakeClock(start = 0) {
  let now = start;
  const clock = () => now;
  clock.advance = (seconds) => { now += seconds * 1000; };
  return clock;
}

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

/* -------------------------------------------------------------------- timer */
test('timer counts down from the mission duration', () => {
  const clock = fakeClock();
  const timer = new MissionTimer(180, clock).start();
  assert.equal(timer.remainingSeconds(), 180);
  clock.advance(30);
  assert.equal(Math.round(timer.remainingSeconds()), 150);
  assert.equal(timer.elapsedSeconds(), 30);
});

test('timer pauses without losing time', () => {
  const clock = fakeClock();
  const timer = new MissionTimer(180, clock).start();
  clock.advance(20);
  timer.pause();
  clock.advance(600); // a long pause must not consume the mission
  assert.equal(Math.round(timer.remainingSeconds()), 160);
  timer.resume();
  clock.advance(10);
  assert.equal(Math.round(timer.remainingSeconds()), 150);
});

test('timer never goes negative and stops at zero', () => {
  const clock = fakeClock();
  const timer = new MissionTimer(5, clock).start();
  clock.advance(9);
  assert.equal(timer.remainingSeconds(), 0);
  assert.equal(timer.ratio(), 0);
  assert.equal(timer.isExpired(), true);
});

test('accuracy credit adds time but is capped at 210 s', () => {
  const clock = fakeClock();
  const timer = new MissionTimer(180, clock).start();
  clock.advance(60);
  timer.extend(3);
  assert.equal(Math.round(timer.remainingSeconds()), 123);
  for (let i = 0; i < 50; i += 1) timer.extend(3);
  assert.equal(timer.duration, 210000);
  assert.ok(timer.remainingSeconds() <= 210);
  timer.extend(-10); // negative credit is ignored
  assert.equal(timer.duration, 210000);
});

test('stop freezes the elapsed time', () => {
  const clock = fakeClock();
  const timer = new MissionTimer(180, clock).start();
  clock.advance(15);
  timer.stop();
  clock.advance(300);
  assert.equal(Math.round(timer.elapsedSeconds()), 15);
  assert.equal(timer.finished, true);
});

/* ------------------------------------------------------------------ scoring */
test('a new session starts empty for every skill including culture', () => {
  const session = newSession('A2');
  assert.equal(session.level, 'A2');
  assert.equal(session.score, 0);
  assert.equal(session.maxScore, 0);
  for (const skill of [...SKILLS, 'culture']) {
    assert.deepEqual(session.skills[skill], { correct: 0, total: 0 });
  }
});

test('answers, score and maximum score stay consistent', () => {
  const session = newSession('A1');
  recordAnswer(session, { skill: 'vocabulary', itemId: 'v1', correct: true });
  recordAnswer(session, { skill: 'vocabulary', itemId: 'v2', correct: false });
  recordAnswer(session, { skill: 'grammar', itemId: 'g1', correct: true });
  assert.equal(session.score, 20);
  assert.equal(session.maxScore, 30);
  assert.deepEqual(session.skills.vocabulary, { correct: 1, total: 2 });
  assert.equal(percentFor(session.skills.vocabulary), 50);
  assert.equal(session.answers.length, 3);
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

test('XP rewards answers and stations, never speed', () => {
  const session = newSession('A1');
  recordAnswer(session, { skill: 'vocabulary', itemId: 'v1', correct: true });
  recordAnswer(session, { skill: 'vocabulary', itemId: 'v2', correct: true });
  completeStation(session, 'vocabulary');
  assert.equal(computeXp(session), 2 * 3 + 2);
  session.usedSeconds = 5; // a fast run must not change XP
  assert.equal(computeXp(session), 8);
});

test('results report per-skill percentages and a new best', () => {
  const session = newSession('A2');
  recordAnswer(session, { skill: 'vocabulary', itemId: 'v1', correct: true });
  recordAnswer(session, { skill: 'vocabulary', itemId: 'v2', correct: true });
  recordAnswer(session, { skill: 'grammar', itemId: 'g1', correct: false });
  session.usedSeconds = 92.4;
  const result = computeResults(session, 40);
  assert.equal(result.percent, 67);
  assert.equal(result.grade, 'B');
  assert.equal(result.correct, 2);
  assert.equal(result.wrong, 1);
  assert.equal(result.usedSeconds, 92);
  assert.equal(result.isNewBest, true);
  assert.equal(result.best, 67);
  assert.equal(result.skills.vocabulary.percent, 100);
  assert.equal(result.skills.grammar.percent, 0);
  assert.equal(result.skills.reading.percent, null, 'untouched skills must be null, not 0');
});

test('an answerless session produces a defensible report', () => {
  const session = newSession('B1');
  const result = computeResults(session, 0);
  assert.equal(result.percent, 0);
  assert.equal(result.grade, 'D');
  assert.equal(result.isNewBest, false);
  assert.ok(result.recommendations.length >= 1);
});

test('recommendations target the weakest graded skill first', () => {
  const skills = {
    vocabulary: { correct: 1, total: 1 },
    grammar: { correct: 0, total: 2 },
    writing: { correct: 1, total: 1 },
    reading: { correct: 0, total: 1 },
    writing: { correct: 0, total: 0 },
    culture: { correct: 1, total: 1 },
  };
  const lines = recommendationsFor(skills);
  assert.match(lines[0], /Grammar/);
  assert.match(lines[0], /0%/);
  assert.match(lines.join(' '), /Reading/);
});

/* ------------------------------------------------------------- achievements */
test('first mission always unlocks Club Member', () => {
  const session = newSession('A1');
  recordAnswer(session, { skill: 'vocabulary', itemId: 'v1', correct: true });
  const result = computeResults(session, 0);
  const unlocked = evaluateAchievements({ session, result, profile: defaultProfile() });
  const ids = unlocked.map((a) => a.id);
  assert.ok(ids.includes('first_mission'));
  assert.ok(ids.includes('best_improved'));
  assert.ok(!ids.includes('five_missions'));
});

test('perfect grammar needs two graded answers, not one', () => {
  const one = newSession('A1');
  recordAnswer(one, { skill: 'grammar', itemId: 'g1', correct: true });
  const oneResult = computeResults(one, 0);
  assert.ok(!evaluateAchievements({ session: one, result: oneResult, profile: defaultProfile() })
    .map((a) => a.id).includes('grammar_guru'));

  const two = newSession('A1');
  recordAnswer(two, { skill: 'grammar', itemId: 'g1', correct: true });
  recordAnswer(two, { skill: 'grammar', itemId: 'g2', correct: true });
  const twoResult = computeResults(two, 0);
  assert.ok(evaluateAchievements({ session: two, result: twoResult, profile: defaultProfile() })
    .map((a) => a.id).includes('grammar_guru'));
});

test('already unlocked achievements are never returned twice', () => {
  const profile = defaultProfile();
  profile.achievements.first_mission = { date: '2026-01-01', name: 'Club Member' };
  const session = newSession('A1');
  const result = computeResults(session, 0);
  const ids = evaluateAchievements({ session, result, profile }).map((a) => a.id);
  assert.ok(!ids.includes('first_mission'));
});

test('achievement list and progress agree', () => {
  const profile = defaultProfile();
  profile.achievements.culture_whiz = { date: '2026-02-02', name: 'Culture Explorer' };
  const progress = achievementProgress(profile);
  assert.equal(progress.length, ACHIEVEMENTS.length);
  assert.equal(ACHIEVEMENTS.length, 10);
  const badge = progress.find((a) => a.id === 'culture_whiz');
  assert.equal(badge.unlocked, true);
  assert.equal(badge.date, '2026-02-02');
  assert.equal(progress.filter((a) => a.unlocked).length, 1);
});

/* ------------------------------------------------------------------ storage */
test('store falls back to defaults with no storage at all', () => {
  const store = new ProfileStore(null);
  assert.equal(store.available, false);
  assert.equal(store.get().name, 'Explorer');
  assert.equal(store.get().level, 'A1');
  store.setName('Ronus');
  assert.equal(store.get().name, 'Ronus', 'in-memory profile must still work');
});

test('store persists profile, settings and achievements', () => {
  const memory = new MemoryStorage();
  const store = new ProfileStore(memory);
  store.setName('  Ronus  ');
  store.setLevel('B1');
  store.setAvatar(3);
  store.setSetting('frenchHints', true);
  assert.equal(store.get().name, 'Ronus');
  assert.equal(store.get().level, 'B1');

  const reloaded = new ProfileStore(memory);
  assert.equal(reloaded.get().name, 'Ronus');
  assert.equal(reloaded.get().level, 'B1');
  assert.equal(reloaded.get().avatar, 3);
  assert.equal(reloaded.getSettings().frenchHints, true);
});

test('names are clamped and invalid levels rejected', () => {
  const store = new ProfileStore(new MemoryStorage());
  store.setName('A'.repeat(40));
  assert.equal(store.get().name.length, 12);
  store.setName('   ');
  assert.equal(store.get().name, 'Explorer');
  store.setLevel('Z9');
  assert.equal(store.get().level, 'A1');
});

test('recording a session updates XP, missions, best and skill totals', () => {
  const store = new ProfileStore(new MemoryStorage());
  const session = newSession('A3' in {} ? 'A1' : 'A2');
  recordAnswer(session, { skill: 'vocabulary', itemId: 'v1', correct: true });
  recordAnswer(session, { skill: 'vocabulary', itemId: 'v2', correct: false });
  const result = computeResults(session, 0);
  const saved = store.recordSession(result);
  assert.equal(saved.newBest, true);
  assert.equal(store.get().missions, 1);
  assert.equal(store.get().xp, result.xpGained);
  assert.equal(store.get().best.A2, 50);
  assert.deepEqual(store.get().skills.vocabulary, { correct: 1, total: 2 });

  // a worse second mission must not lower the best score
  const second = computeResults(newSession('A2'), 50);
  store.recordSession(second);
  assert.equal(store.get().best.A2, 50);
  assert.equal(store.get().missions, 2);
});

test('unlocking is idempotent', () => {
  const store = new ProfileStore(new MemoryStorage());
  const item = { id: 'culture_whiz', name: 'Culture Explorer' };
  assert.equal(store.unlock(item), true);
  assert.equal(store.unlock(item), false);
  assert.equal(store.hasAchievement('culture_whiz'), true);
});

test('corrupt storage never breaks the game', () => {
  const memory = new MemoryStorage();
  memory.setItem(STORAGE_KEY, '{not json');
  const store = new ProfileStore(memory);
  assert.equal(store.get().name, 'Explorer');
  assert.equal(store.get().xp, 0);
});

test('unknown or hostile values are merged safely', () => {
  const memory = new MemoryStorage();
  memory.setItem(STORAGE_KEY, JSON.stringify({
    name: 42, level: 'C2', xp: -9, missions: 'lots', best: null, settings: { music: 'loud' },
  }));
  const store = new ProfileStore(memory);
  const p = store.get();
  assert.equal(p.level, 'A1');
  assert.equal(p.xp, 0);
  assert.equal(p.missions, 0);
  assert.equal(p.best.A1, 0);
  assert.equal(typeof p.settings.music, 'number', 'settings fall back to defaults');
});

test('reset clears everything on the device', () => {
  const memory = new MemoryStorage();
  const store = new ProfileStore(memory);
  store.setName('Ronus');
  store.unlock({ id: 'culture_whiz', name: 'Culture Explorer' });
  store.reset();
  assert.equal(store.get().name, 'Explorer');
  assert.equal(store.hasAchievement('culture_whiz'), false);
  assert.equal(new ProfileStore(memory).get().xp, 0);
});

test('level progression is monotonic and bounded', () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(LEVEL_XP - 1).level, 1);
  assert.equal(levelFromXp(LEVEL_XP).level, 2);
  assert.equal(levelFromXp(LEVEL_XP * 4).level, 5);
  assert.equal(levelFromXp(-50).level, 1);
  assert.ok(levelFromXp(LEVEL_XP / 2).ratio > 0 && levelFromXp(LEVEL_XP / 2).ratio < 1);
});

/* --------------------------------------------------------------------- util */
test('seeded randomness is reproducible', () => {
  const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], createRng(1234));
  const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], createRng(1234));
  assert.deepEqual(a, b);
  assert.deepEqual([...a].sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8], 'shuffle keeps every item');
});

test('sample never returns more than the source', () => {
  const source = [1, 2, 3];
  const out = sample(source, 10, createRng(7));
  assert.equal(out.length, 3);
  assert.equal(new Set(out).size, 3);
  assert.deepEqual(sample([], 2), []);
});

test('answer normalisation ignores case, spacing and punctuation', () => {
  assert.equal(normalizeText('  Hello,   World! '), 'hello world');
  assert.equal(normalizeText('don’t'), normalizeText("don't"));
  assert.equal(normalizeText(null), '');
});

test('todayIso returns a stable calendar date', () => {
  assert.match(todayIso(), /^\d{4}-\d{2}-\d{2}$/);
});

/* ------------------------------------------------------------------ content */
test('every skill and level has exactly ten exercises', () => {
  const counts = countExercises();
  for (const skill of Object.keys(counts)) {
    for (const level of LEVELS) {
      assert.equal(counts[skill][level], 10, `${skill} ${level}`);
    }
  }
  assert.ok(!('listening' in counts) && !('speaking' in counts));
  assert.equal(Object.values(counts).reduce((sum, byLevel) => sum
    + Object.values(byLevel).reduce((a, b) => a + b, 0), 0), 150);
});

test('the content bank validates without any schema error', () => {
  let report = null;
  assert.doesNotThrow(() => { report = validateBank(banks); });
  assert.equal(report.total, 150);
  assert.equal(Object.keys(report.counts).length, 15);
});

test('every exercise carries a French translation of its instruction', () => {
  const missing = [];
  const unknown = new Set();
  for (const levels of Object.values(banks)) {
    for (const items of Object.values(levels)) {
      for (const item of items) {
        if (!item.instructionFr || !item.instructionFr.trim()) {
          missing.push(item.id);
          if (!FR_INSTRUCTIONS[item.instruction]) unknown.add(item.instruction);
        }
      }
    }
  }
  assert.deepEqual(missing, [], 'exercises without a French instruction');
  assert.equal(unknown.size, 0, `untranslated instructions: ${[...unknown].join(' | ')}`);
});

test('French instructions are real French, not the English fallback', () => {
  for (const levels of Object.values(banks)) {
    for (const items of Object.values(levels)) {
      for (const item of items) {
        assert.notEqual(item.instructionFr, item.instruction, item.id);
        assert.ok(/[éèêàçûô’]|Choisissez|Écoutez|Associez|Touchez|Dites|Lisez/.test(item.instructionFr), item.id);
      }
    }
  }
});

test('exercise ids are unique across the whole bank', () => {
  const ids = new Set();
  for (const [skill, levels] of Object.entries(banks)) {
    for (const [level, items] of Object.entries(levels)) {
      for (const item of items) {
        assert.ok(!ids.has(item.id), `duplicate id ${item.id} (${skill}/${level})`);
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
        assert.ok(item.objective && item.objective.length > 8, `${item.id} objective`);
        assert.ok(item.instruction, `${item.id} instruction`);
        assert.ok(item.explanation && item.explanation.length > 8, `${item.id} explanation`);
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
  const options = ['alpha', 'beta', 'gamma', 'delta'];
  const a = arrangeOptions('rea-a1-01', options, 0);
  const b = arrangeOptions('rea-a1-01', options, 0);
  assert.deepEqual(a, b, 'same id must produce the same order');
  assert.notDeepEqual(a.options, options, 'the authored order must not leak to the learner');
  for (let answer = 0; answer < options.length; answer += 1) {
    const arranged = arrangeOptions(`item-${answer}`, options, answer);
    assert.equal(arranged.options[arranged.answer], options[answer]);
    assert.equal(new Set(arranged.options).size, options.length);
  }
});

test('the correct option is not systematically in position A', () => {
  const choices = [];
  for (const levels of Object.values(banks)) {
    for (const items of Object.values(levels)) {
      for (const item of items) if (item.type === 'choice') choices.push(item);
    }
  }
  assert.ok(choices.length >= 100);
  const first = choices.filter((item) => item.answer === 0).length;
  assert.ok(first / choices.length < 0.35, `${first}/${choices.length} answers in position A`);
  for (const [skill, levels] of Object.entries(banks)) {
    const group = [];
    for (const items of Object.values(levels)) {
      for (const item of items) if (item.type === 'choice') group.push(item);
    }
    if (group.length >= 10) {
      assert.ok(new Set(group.map((item) => item.answer)).size >= 3, `${skill} uses several answer positions`);
    }
  }
});

test('mission plans have the advertised shape at every level', () => {
  for (const level of LEVELS) {
    const plan = buildMissionPlan(level, 2026);
    assert.equal(plan.stations.vocabulary.length, 3, `${level} vocabulary`);
    assert.equal(plan.stations.grammar.length, 2, `${level} grammar`);
    assert.equal(plan.stations.writing.length, 1, `${level} writing bonus`);
    assert.equal(plan.stations.culture.length, 2, `${level} culture`);
    assert.equal(plan.stations.final.length, 2, `${level} final`);
    const ids = Object.values(plan.stations).flat().map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `${level} plan has no duplicate exercise`);
    assert.ok(!('listening' in plan.stations) && !('speaking' in plan.stations), `${level} has no removed skill`);
  }
});

test('mission plans are stable for a given seed and vary between seeds', () => {
  const a = buildMissionPlan('A2', 99).stations.final.map((i) => i.id).join();
  const b = buildMissionPlan('A2', 99).stations.final.map((i) => i.id).join();
  assert.equal(a, b);
  const seeds = new Set();
  for (let seed = 1; seed <= 12; seed += 1) {
    seeds.add(buildMissionPlan('A2', seed).stations.vocabulary.map((i) => i.id).join());
  }
  assert.ok(seeds.size > 1, 'different seeds should vary the plan');
});

test('the placement check is six distinct questions across levels', () => {
  const items = getPlacementQuestions();
  assert.equal(items.length, 6);
  assert.equal(new Set(items.map((i) => i.id)).size, 6);
  assert.ok(new Set(items.map((i) => i.level)).size >= 2);
});

test('vocabulary practice returns a full set per level', () => {
  for (const level of LEVELS) {
    assert.equal(getExercises('vocabulary', level).length, 10);
  }
  assert.deepEqual(getExercises('unknown', 'A1'), []);
});

test('exhibition demo preset is clean, readable and safe to reuse', () => {
  const preset = demoPreset();
  assert.equal(preset.level, 'A1');
  assert.equal(preset.name, 'Guest');
  assert.equal(preset.avatar, 0);
  assert.equal(preset.settings.highContrast, true);
  assert.equal(preset.settings.frenchHints, false);
  assert.equal(preset.settings.reduceMotion, false);
  assert.equal(Object.keys(preset.settings).length, Object.keys(DEFAULT_SETTINGS).length);
  preset.settings.highContrast = false;
  assert.equal(demoPreset().settings.highContrast, true, 'a caller must not mutate the preset');
});
