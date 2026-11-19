/**
 * Quiz scoring. Pure functions only: a session holds the answers of one
 * 15-question quiz; results are derived from accuracy, never from speed.
 */
import { ALL_SKILLS, SKILL_INFO } from '../content/schema.js';

export const POINTS_PER_ANSWER = 10;
export const QUESTIONS_PER_QUIZ = 15;
export const QUESTIONS_PER_SKILL = 3;

export function newSession(level) {
  const skills = {};
  for (const key of ALL_SKILLS) skills[key] = { correct: 0, total: 0 };
  return {
    level,
    startedAt: Date.now(),
    endedAt: null,
    answers: [],
    skills,
    score: 0,
    maxScore: 0,
    xpGained: 0,
  };
}

export function recordAnswer(session, { skill, itemId, correct, response }) {
  if (!session.skills[skill]) session.skills[skill] = { correct: 0, total: 0 };
  session.skills[skill].total += 1;
  session.maxScore += POINTS_PER_ANSWER;
  if (correct === true) {
    session.skills[skill].correct += 1;
    session.score += POINTS_PER_ANSWER;
  }
  session.answers.push({
    skill, itemId, correct: correct === true, response: response ?? null, at: Date.now(),
  });
  return session;
}

export function percentFor(stat) {
  if (!stat || !stat.total) return null;
  return Math.round((stat.correct / stat.total) * 100);
}

/** XP rewards correct answers only. No timer, no exploration bonus. */
export function computeXp(session) {
  return session.answers.filter((a) => a.correct === true).length * 3;
}

export function gradeFor(percent) {
  if (percent >= 90) return 'S';
  if (percent >= 75) return 'A';
  if (percent >= 60) return 'B';
  if (percent >= 40) return 'C';
  return 'D';
}

const TIPS = {
  vocabulary: 'Review the word sets, then use each new word in a sentence of your own.',
  grammar: 'Look at the tense or structure behind each mistake, not only at the answer.',
  reading: 'Underline the exact sentence that proves your answer before you choose.',
  writing: 'Rebuild each sentence, then write it once again from memory.',
  culture: 'Connect each fact to a place or a date rather than memorising isolated details.',
};

export function recommendationsFor(skills) {
  const scored = Object.entries(skills)
    .filter(([, stat]) => stat && stat.total > 0)
    .map(([key, stat]) => ({ key, percent: percentFor(stat), total: stat.total }))
    .sort((a, b) => a.percent - b.percent);
  const out = [];
  for (const item of scored.slice(0, 2)) {
    out.push(`${SKILL_INFO[item.key]?.name || item.key} (${item.percent}%): ${TIPS[item.key]}`);
  }
  if (!out.length) out.push('Answer a few questions to receive targeted recommendations.');
  return out;
}

/** Build the end-of-quiz report from a session. */
export function computeResults(session, profileBest = 0) {
  const correct = session.answers.filter((a) => a.correct === true).length;
  const wrong = session.answers.filter((a) => a.correct === false).length;
  const answered = correct + wrong;
  const percent = answered ? Math.round((correct / answered) * 100) : 0;
  const skills = {};
  for (const key of ALL_SKILLS) {
    const stat = session.skills[key] || { correct: 0, total: 0 };
    skills[key] = {
      correct: stat.correct,
      total: stat.total,
      percent: percentFor(stat),
      name: SKILL_INFO[key]?.name || key,
    };
  }
  const xpGained = computeXp(session);
  return {
    level: session.level,
    score: session.score,
    maxScore: session.maxScore,
    percent,
    grade: gradeFor(percent),
    correct,
    wrong,
    answered,
    skills,
    xpGained,
    best: Math.max(profileBest, percent),
    isNewBest: percent > profileBest,
    recommendations: recommendationsFor(session.skills),
  };
}
