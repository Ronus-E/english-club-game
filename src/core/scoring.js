import { SKILLS, SKILL_INFO } from '../content/schema.js';

export const POINTS_PER_ANSWER = 10;
export const REQUIRED_STATIONS = ['vocabulary', 'grammar', 'culture', 'final'];

export function newSession(level) {
  const skills = {};
  for (const key of SKILLS) skills[key] = { correct: 0, total: 0 };
  skills.culture = { correct: 0, total: 0 };
  return {
    level,
    startedAt: Date.now(),
    endedAt: null,
    answers: [],
    skills,
    stationsVisited: [],
    stationsCompleted: [],
    score: 0,
    maxScore: 0,
    usedSeconds: 0,
    xpGained: 0,
  };
}

export function recordAnswer(session, { skill, itemId, correct, response }) {
  if (!session.skills[skill]) session.skills[skill] = { correct: 0, total: 0 };
  session.skills[skill].total += 1;
  session.maxScore += POINTS_PER_ANSWER;
  if (correct) {
    session.skills[skill].correct += 1;
    session.score += POINTS_PER_ANSWER;
  }
  session.answers.push({ skill, itemId, correct: Boolean(correct), response: response ?? null, at: Date.now() });
  return session;
}

export function visitStation(session, id) {
  if (!session.stationsVisited.includes(id)) session.stationsVisited.push(id);
  return session;
}

export function completeStation(session, id) {
  visitStation(session, id);
  if (!session.stationsCompleted.includes(id)) session.stationsCompleted.push(id);
  return session;
}

export function percentFor(stat) {
  if (!stat || !stat.total) return null;
  return Math.round((stat.correct / stat.total) * 100);
}

export function computeXp(session) {
  const correct = session.answers.filter((a) => a.correct === true).length;
  const stations = session.stationsCompleted.filter((id) => id !== 'achievement').length;
  return correct * 3 + Math.min(stations, 5) * 2;
}

export function gradeFor(percent) {
  if (percent >= 90) return 'S';
  if (percent >= 75) return 'A';
  if (percent >= 60) return 'B';
  if (percent >= 40) return 'C';
  return 'D';
}

const TIPS = {
  vocabulary: 'Review the Vocabulary Garden match sets, then use each new word in a sentence of your own.',
  grammar: 'Revisit the Grammar Classroom: focus on the tense or structure behind each mistake, not just the answer.',
  reading: 'In the Reading Library, underline the exact sentence that proves your answer before choosing.',
  writing: 'In the Writing Office, rebuild each sentence, then rewrite it once from memory.',
  culture: 'Explore the Culture Zone map and connect each fact to a place or date rather than memorising isolated details.',
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
  if (!out.length) out.push('Complete a few exercises to receive targeted recommendations.');
  return out;
}

/**
 * Build the end-of-mission report from a session.
 * Accuracy is used for grading; speed is reported but never rewarded.
 */
export function computeResults(session, profileBest = 0) {
  const correct = session.answers.filter((a) => a.correct === true).length;
  const wrong = session.answers.filter((a) => a.correct === false).length;
  const answered = correct + wrong;
  const percent = answered ? Math.round((correct / answered) * 100) : 0;
  const skills = {};
  for (const key of [...SKILLS, 'culture']) {
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
    usedSeconds: Math.round(session.usedSeconds),
    skills,
    xpGained,
    best: Math.max(profileBest, percent),
    isNewBest: percent > profileBest,
    recommendations: recommendationsFor(session.skills),
    stationsCompleted: [...session.stationsCompleted],
    stationsVisited: [...session.stationsVisited],
  };
}
