/**
 * Campus map: isometric grid, buildings, decoration, NPC anchors and collision.
 * Pure data + geometry, no rendering, so it can be unit-tested.
 */
export const TILE_W = 64;
export const TILE_H = 32;
export const MAP_W = 20;
export const MAP_H = 16;

export const STATIONS = [
  {
    id: 'hub', name: 'English Club Hub', short: 'Hub', icon: '🏠', kind: 'hub',
    x: 9, y: 6, w: 2, h: 2, entrance: { x: 10, y: 8.1 }, color: '#ffc857', accent: '#8a5c12',
    description: 'Club reception and mission briefing.',
  },
  {
    id: 'vocabulary', name: 'Vocabulary Garden', short: 'Vocabulary', icon: '🌳', kind: 'activity',
    x: 3, y: 3, w: 2, h: 2, entrance: { x: 4, y: 5.1 }, color: '#5ce1a6', accent: '#1f7d5a',
    description: 'Match words with pictures and meaning.',
  },
  {
    id: 'grammar', name: 'Grammar Classroom', short: 'Grammar', icon: '🧩', kind: 'activity',
    x: 6, y: 1, w: 2, h: 2, entrance: { x: 7, y: 3.1 }, color: '#63c5ff', accent: '#1f5f8f',
    description: 'Complete sentences and choose accurate forms.',
  },
  {
    id: 'reading', name: 'Reading Library', short: 'Reading', icon: '📖', kind: 'activity',
    x: 15, y: 9, w: 2, h: 2, entrance: { x: 16, y: 11.1 }, color: '#ffc857', accent: '#8a5c12',
    description: 'Short texts, notices and practical details.',
  },
  {
    id: 'writing', name: 'Writing Office', short: 'Writing', icon: '✍', kind: 'bonus',
    x: 11, y: 12, w: 2, h: 2, entrance: { x: 12, y: 14.1 }, color: '#ff6b6b', accent: '#8f2f3a',
    description: 'Bonus station: rebuild a sentence correctly.',
  },
  {
    id: 'culture', name: 'American Culture Zone', short: 'Culture', icon: '🇺🇸', kind: 'activity',
    x: 5, y: 12, w: 2, h: 2, entrance: { x: 6, y: 14.1 }, color: '#ffd166', accent: '#8a6a12',
    description: 'Geography, landmarks, traditions and education.',
  },
  {
    id: 'arena', name: 'Final Challenge Arena', short: 'Final', icon: '★', kind: 'final',
    x: 1, y: 8, w: 2, h: 2, entrance: { x: 2, y: 10.1 }, color: '#ff6b6b', accent: '#7d1f2b',
    description: 'Two rapid questions, then your mission report.',
  },
  {
    id: 'achievement', name: 'Achievement Hall', short: 'Achievements', icon: '🏆', kind: 'achievements',
    x: 1, y: 4, w: 2, h: 2, entrance: { x: 2, y: 6.1 }, color: '#e8eefc', accent: '#5d678c',
    description: 'Your badges, XP and personal bests.',
  },
];

export const STATION_BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

export const SPAWN = { x: 9.2, y: 9.6 };

export const NPCS = [
  { id: 'guide', x: 11.1, y: 9.2, dir: 'left' },
  { id: 'student', x: 8.1, y: 9.9, dir: 'right' },
  { id: 'cafe', x: 13.1, y: 3.9, dir: 'left' },
  { id: 'librarian', x: 15.4, y: 11.9, dir: 'up' },
  { id: 'president', x: 5.6, y: 10.4, dir: 'down' },
  { id: 'visitor', x: 7.6, y: 7.0, dir: 'down' },
];

export const DECORATIONS = [
  { type: 'tree', x: 2, y: 2 }, { type: 'tree', x: 5, y: 6 }, { type: 'tree', x: 7, y: 5 },
  { type: 'tree', x: 13, y: 5 }, { type: 'tree', x: 14, y: 12 }, { type: 'tree', x: 9, y: 13 },
  { type: 'tree', x: 4, y: 8 }, { type: 'tree', x: 17, y: 2 }, { type: 'tree', x: 17, y: 7 },
  { type: 'tree', x: 3, y: 14 }, { type: 'tree', x: 8, y: 11 }, { type: 'tree', x: 18, y: 14 },
  { type: 'bench', x: 8, y: 9.2 }, { type: 'bench', x: 11.6, y: 9.2 },
  { type: 'lamp', x: 7.2, y: 8.2 }, { type: 'lamp', x: 12.4, y: 8.2 },
  { type: 'lamp', x: 9.4, y: 5.2 }, { type: 'lamp', x: 10.4, y: 11.4 },
  { type: 'fountain', x: 12.4, y: 7.2, blocking: true },
  { type: 'flowers', x: 3.6, y: 6.4 }, { type: 'flowers', x: 6.4, y: 9.4 },
  { type: 'flowers', x: 13.6, y: 10.4 }, { type: 'flowers', x: 5.4, y: 8.4 },
  { type: 'flag', x: 13.8, y: 8.4 },
  { type: 'flag', x: 6.6, y: 6.6 },
  { type: 'statue', x: 15.4, y: 7.6 },
  { type: 'statue', x: 4.4, y: 12.4 },
];

export const PLAZA = { x1: 8, y1: 8, x2: 12, y2: 11 };

/** L-shaped path tiles from the hub to every station entrance. */
export function buildPaths() {
  const tiles = new Set();
  const hubEntrance = STATION_BY_ID.hub.entrance;
  const add = (x, y) => {
    const tx = Math.round(x);
    const ty = Math.round(y);
    if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) tiles.add(`${tx},${ty}`);
  };
  for (const station of STATIONS) {
    if (station.id === 'hub') continue;
    const e = station.entrance;
    const start = { x: Math.round(hubEntrance.x), y: Math.round(hubEntrance.y) + 1 };
    const end = { x: Math.round(e.x), y: Math.round(e.y) };
    const stepX = Math.sign(end.x - start.x) || 1;
    const stepY = Math.sign(end.y - start.y) || 1;
    for (let x = start.x; x !== end.x + stepX; x += stepX) add(x, start.y);
    for (let y = start.y; y !== end.y + stepY; y += stepY) add(end.x, y);
  }
  for (let x = PLAZA.x1; x <= PLAZA.x2; x++) {
    for (let y = PLAZA.y1; y <= PLAZA.y2; y++) add(x, y);
  }
  return tiles;
}

export const PATH_TILES = buildPaths();

export function isBuildingTile(tx, ty) {
  return STATIONS.some((s) => tx >= s.x && tx < s.x + s.w && ty >= s.y && ty < s.y + s.h);
}

function decorationBlocks(tx, ty) {
  return DECORATIONS.some((d) => {
    if (!(d.blocking || d.type === 'tree' || d.type === 'fountain' || d.type === 'statue')) return false;
    const cx = Math.round(d.x);
    const cy = Math.round(d.y);
    if (d.type === 'tree' || d.type === 'fountain' || d.type === 'statue') {
      return Math.abs(tx - cx) <= 0 && Math.abs(ty - cy) <= 0;
    }
    return tx === cx && ty === cy;
  });
}

export function isWalkableTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  if (isBuildingTile(tx, ty)) return false;
  if (decorationBlocks(tx, ty)) return false;
  return true;
}

/**
 * Continuous collision test against the four corners of the player's footprint.
 * `radius` is expressed in tiles.
 */
export function canStand(x, y, radius = 0.26) {
  if (x - radius < 0 || y - radius < 0 || x + radius >= MAP_W || y + radius >= MAP_H) return false;
  const points = [
    [x - radius, y - radius], [x + radius, y - radius],
    [x - radius, y + radius], [x + radius, y + radius],
    [x, y],
  ];
  return points.every(([px, py]) => isWalkableTile(Math.floor(px), Math.floor(py)));
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Find the closest interaction target. Stations use their entrance pad,
 * NPCs use their standing position. Returns { kind, id, distance } or null.
 */
export function nearestInteractable(player, radius = 1.75) {
  let best = null;
  for (const npc of NPCS) {
    const d = distance(player, npc);
    if (d <= 1.05 && (!best || d < best.distance)) best = { kind: 'npc', id: npc.id, distance: d };
  }
  for (const station of STATIONS) {
    const d = distance(player, station.entrance);
    if (d <= radius && (!best || d < best.distance - 0.15)) {
      best = { kind: 'station', id: station.id, distance: d };
    }
  }
  return best;
}

export function stationIsNear(player, id, radius = 1.75) {
  const station = STATION_BY_ID[id];
  return station ? distance(player, station.entrance) <= radius : false;
}

// Route order. `arena` is the world station; the mission plan calls the same
// stop `final`, so mission.js maps between the two names in one place.
export const MISSION_ROUTE = ['vocabulary', 'grammar', 'culture', 'arena'];
export const PLAN_KEY = { arena: 'final' };
export const planKeyFor = (stationId) => PLAN_KEY[stationId] || stationId;
