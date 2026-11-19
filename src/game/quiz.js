/**
 * Quiz controller: builds one progressive stage run, feeds the shared activity
 * renderer, records the answers and produces the end-of-quiz report.
 */
import { buildStageQuiz, getExerciseById, normalizeStage, LEVEL_INFO } from '../content/index.js';
import { newSession, recordAnswer, computeResults } from '../core/scoring.js';
import { evaluateAchievements } from '../core/achievements.js';

function displayResponse(response) {
  if (Array.isArray(response)) {
    if (response.length && response.every((r) => r && typeof r === 'object' && 'term' in r)) {
      return response.map((r) => `${r.term} → ${r.icon}`).join(', ');
    }
    return response.join(', ') || '—';
  }
  return response == null || response === '' ? '—' : String(response);
}

function expectedAnswer(item) {
  if (!item) return '—';
  if (item.type === 'choice') return item.options?.[item.answer] ?? '—';
  if (item.type === 'match') return (item.pairs || []).map((p) => `${p.term} → ${p.icon}`).join(', ') || '—';
  if (item.type === 'order') return item.answerText || '—';
  if (item.type === 'short') return item.accepted?.[0] || '—';
  return '—';
}

function buildReview(session) {
  return session.answers.map((answer, index) => {
    const item = getExerciseById(answer.itemId);
    const note = item?.skill === 'culture'
      ? [item.region && `Region: ${item.region}`, item.note && `Source note: ${item.note}`].filter(Boolean).join(' · ')
      : '';
    return {
      number: index + 1,
      skill: item?.skill || answer.skill,
      prompt: item?.prompt || item?.objective || answer.itemId,
      correct: answer.correct === true,
      yourAnswer: displayResponse(answer.response),
      expected: expectedAnswer(item),
      explanation: item?.explanation || '',
      note,
    };
  });
}

export class Quiz {
  constructor({ store, activities, onEnd }) {
    this.store = store;
    this.activities = activities;
    this.onEnd = onEnd || (() => {});
    this.onQuit = null;
    this.onProgress = null;
    this.session = null;
    this.level = null;
    this.stage = null;
    this.total = 0;
  }

  get isActive() { return Boolean(this.session) && this.activities.isOpen; }

  start(level, seed = Date.now(), stage = null) {
    const chosenStage = normalizeStage(stage == null ? this.store.stageState(level).current : stage);
    const items = buildStageQuiz(level, chosenStage, seed);
    this.level = level;
    this.stage = chosenStage;
    this.total = items.length;
    this.session = newSession(level, chosenStage);
    this.activities.open({
      kicker: `${level} · Stage ${chosenStage} · ${items.length} questions`,
      title: `${LEVEL_INFO[level]?.short || level} quiz`,
      icon: '★',
      skill: null,
      items,
      silent: true,
      noQuit: true,
      finishLabel: 'See my report',
      onAnswer: ({ item, correct, response }) => {
        if (!this.session) return;
        recordAnswer(this.session, {
          skill: item.skill, itemId: item.id, correct, response,
        });
        this.onProgress?.(this.session, item);
      },
      onQuit: () => this.abandon(),
      onFinish: () => this.finish(),
    });
  }

  finish() {
    if (!this.session) return null;
    const session = this.session;
    session.endedAt = Date.now();
    const profile = this.store.get();
    const result = computeResults(session, profile.best[session.level] || 0);
    // Evaluate before recordSession mutates the stored profile.
    const unlocked = evaluateAchievements({ session, result, profile });
    const review = buildReview(session);
    const stageResult = this.store.recordStage(session.level, session.stage, result.percent);
    result.stageBest = stageResult.best;
    result.stagePassed = stageResult.passed;
    result.stageUnlocked = stageResult.unlockedStage;
    this.store.recordMistakes(session.answers.map((answer) => ({ ...answer, level: session.level })));
    this.store.recordSession(result);
    for (const badge of unlocked) this.store.unlock(badge);
    this.session = null;
    this.onEnd?.({ result, unlocked, review });
    return result;
  }

  abandon() {
    this.activities.close();
    this.session = null;
    this.onQuit?.();
  }
}
