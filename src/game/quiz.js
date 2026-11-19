/**
 * Quiz controller: builds a 15-question run, feeds the shared activity
 * renderer, records the answers and produces the end-of-quiz report.
 */
import { buildQuiz, LEVEL_INFO } from '../content/index.js';
import { newSession, recordAnswer, computeResults } from '../core/scoring.js';
import { evaluateAchievements } from '../core/achievements.js';

export class Quiz {
  constructor({ store, activities, onEnd }) {
    this.store = store;
    this.activities = activities;
    this.onEnd = onEnd || (() => {});
    this.onQuit = null;
    this.onProgress = null;
    this.session = null;
    this.level = null;
  }

  get isActive() { return Boolean(this.session) && this.activities.isOpen; }

  start(level, seed = Date.now()) {
    const items = buildQuiz(level, seed);
    this.level = level;
    this.session = newSession(level);
    this.activities.open({
      kicker: `${level} quiz · ${items.length} questions`,
      title: `${LEVEL_INFO[level]?.short || level} quiz`,
      icon: '★',
      skill: null,
      items,
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
    this.store.recordSession(result);
    for (const badge of unlocked) this.store.unlock(badge);
    this.session = null;
    this.onEnd?.({ result, unlocked });
    return result;
  }

  abandon() {
    this.activities.close();
    this.session = null;
    this.onQuit?.();
  }
}
