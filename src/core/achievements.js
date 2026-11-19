/**
 * Quiz-based achievements. Existing badge ids are kept so stored progress
 * survives the switch from the campus game to the quiz; only the campus
 * exploration badge is replaced by an all-skills badge.
 */
import { percentFor } from './scoring.js';
import { levelFromXp } from './storage.js';

export const ACHIEVEMENTS = [
  { id: 'first_mission', name: 'Club Member', icon: '🎓', description: 'Complete your first quiz.' },
  { id: 'perfect_vocab', name: 'Word Collector', icon: '📚', description: 'Every vocabulary answer correct in one quiz.' },
  { id: 'grammar_guru', name: 'Grammar Guru', icon: '🧩', description: 'Every grammar answer correct in one quiz.' },
  { id: 'culture_whiz', name: 'Culture Explorer', icon: '🗺', description: 'Every culture answer correct in one quiz.' },
  { id: 'all_skills', name: 'Every Skill', icon: '🧭', description: 'Score at least 60% in all five skills of one quiz.' },
  { id: 'best_improved', name: 'Personal Best', icon: '📈', description: 'Beat your previous best score at the same level.' },
  { id: 'level_five', name: 'Club Veteran', icon: '⭐', description: 'Reach club level 5.' },
  { id: 'five_missions', name: 'Regular Member', icon: '🏅', description: 'Complete five quizzes.' },
  { id: 'b1_mission', name: 'Intermediate Agent', icon: '🎖', description: 'Finish a B1 quiz with at least 60%.' },
  { id: 'all_rounder', name: 'All-Rounder', icon: '🏆', description: 'Score at least 60% in four different skills in one quiz.' },
];

/**
 * Pure evaluation. `session` is the finished quiz session, `result` its report
 * and `profile` the stored profile BEFORE the session was recorded.
 */
export function evaluateAchievements({ session, result, profile }) {
  const unlocked = [];
  const has = (id) => Boolean(profile.achievements?.[id]);
  const skills = result.skills || {};
  const perfect = (key, min = 1) => skills[key]?.total >= min && skills[key].percent === 100;
  const scoredSkills = Object.values(skills).filter((s) => s.total > 0 && s.percent !== null);
  const nextXp = (profile.xp || 0) + (result.xpGained ?? 0);
  const nextLevel = levelFromXp(nextXp).level;

  const tests = [
    ['first_mission', (profile.missions || 0) + 1 >= 1],
    ['perfect_vocab', perfect('vocabulary', 3)],
    ['grammar_guru', perfect('grammar', 3)],
    ['culture_whiz', perfect('culture', 3)],
    ['all_skills', skills.vocabulary?.total > 0 && scoredSkills.length === 5 && scoredSkills.every((s) => s.percent >= 60)],
    ['best_improved', result.isNewBest && result.percent > 0],
    ['level_five', nextLevel >= 5],
    ['five_missions', (profile.missions || 0) + 1 >= 5],
    ['b1_mission', result.level === 'B1' && result.percent >= 60],
    ['all_rounder', scoredSkills.filter((s) => s.percent >= 60).length >= 4],
  ];

  for (const [id, condition] of tests) {
    if (condition && !has(id)) {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def) unlocked.push(def);
    }
  }
  return unlocked;
}

export function achievementProgress(profile) {
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: Boolean(profile.achievements?.[a.id]),
    date: profile.achievements?.[a.id]?.date || null,
  }));
}

export { percentFor };
