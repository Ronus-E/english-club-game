import { percentFor, computeXp } from './scoring.js';
import { levelFromXp } from './storage.js';

export const ACHIEVEMENTS = [
  { id: 'first_mission', name: 'Club Member', icon: '🎓', description: 'Complete your first mission.' },
  { id: 'perfect_vocab', name: 'Word Collector', icon: '📚', description: 'Answer every vocabulary question correctly in one mission.' },
  { id: 'grammar_guru', name: 'Grammar Guru', icon: '🧩', description: 'Answer every grammar question correctly in one mission.' },
  { id: 'all_ears', name: 'Golden Ears', icon: '🎧', description: 'Get the listening question right in a mission.' },
  { id: 'culture_whiz', name: 'Culture Explorer', icon: '🗺', description: 'Answer every culture question correctly in one mission.' },
  { id: 'speaker', name: 'Brave Speaker', icon: '🎙', description: 'Complete a speaking task (speech or text alternative).' },
  { id: 'explorer', name: 'Campus Explorer', icon: '🧭', description: 'Visit six different stations in one mission.' },
  { id: 'best_improved', name: 'Personal Best', icon: '📈', description: 'Beat your previous best score at the same level.' },
  { id: 'level_five', name: 'Club Veteran', icon: '⭐', description: 'Reach club level 5.' },
  { id: 'five_missions', name: 'Regular Member', icon: '🏅', description: 'Complete five missions.' },
  { id: 'b1_mission', name: 'Intermediate Agent', icon: '🎖', description: 'Finish a B1 mission with at least 60%.' },
  { id: 'all_rounder', name: 'All-Rounder', icon: '🏆', description: 'Score at least 60% in four different skills in one mission.' },
];

/**
 * Pure achievement evaluation. `session` is the live mission session and
 * `profile` is the persisted profile *before* this session was recorded.
 */
export function evaluateAchievements({ session, result, profile }) {
  const unlocked = [];
  const has = (id) => Boolean(profile.achievements?.[id]);
  const skills = result.skills || {};
  const perfect = (key, min = 1) => skills[key]?.total >= min && skills[key].percent === 100;
  const nextXp = (profile.xp || 0) + computeXp(session);
  const nextLevel = levelFromXp(nextXp).level;

  const tests = [
    ['first_mission', (profile.missions || 0) + 1 >= 1],
    ['perfect_vocab', perfect('vocabulary', 2)],
    ['grammar_guru', perfect('grammar', 2)],
    ['all_ears', skills.listening?.total >= 1 && skills.listening.percent === 100],
    ['culture_whiz', perfect('culture', 2)],
    ['speaker', Boolean(result.speaking?.completed)],
    ['explorer', (session.stationsVisited || []).filter((s) => s !== 'hub').length >= 6],
    ['best_improved', result.isNewBest && result.percent > 0],
    ['level_five', nextLevel >= 5],
    ['five_missions', (profile.missions || 0) + 1 >= 5],
    ['b1_mission', result.level === 'B1' && result.percent >= 60],
    ['all_rounder', Object.entries(skills).filter(([key, s]) => key !== 'speaking' && s.percent !== null && s.percent >= 60).length >= 4],
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
