/** Original pixel characters. Every sprite is drawn with rectangles. */

export const AVATARS = [
  { name: 'Mint', skin: '#e8b48a', hair: '#2b1c17', shirt: '#5ce1a6', pants: '#26305a', accent: '#ffc857' },
  { name: 'Sky', skin: '#c98a63', hair: '#141414', shirt: '#63c5ff', pants: '#1c2440', accent: '#ff8fd8' },
  { name: 'Amber', skin: '#f2c6a0', hair: '#7a4a2b', shirt: '#ffc857', pants: '#2f3a6b', accent: '#5ce1a6' },
  { name: 'Violet', skin: '#8d5a3c', hair: '#0f0f12', shirt: '#a78bfa', pants: '#20284a', accent: '#ff6b6b' },
  { name: 'Coral', skin: '#e6b48f', hair: '#3a2018', shirt: '#ff6b6b', pants: '#232c52', accent: '#63c5ff' },
  { name: 'Ivory', skin: '#f7d7bd', hair: '#b8862f', shirt: '#e8eefc', pants: '#2a3358', accent: '#a78bfa' },
];

/**
 * Draw a pixel person with feet at (x, y), where one art pixel = `u` screen px.
 * Returns the total height in screen px for layout purposes.
 */
export function drawPerson(ctx, x, y, u = 2, palette = AVATARS[0], { dir = 'down', frame = 0, alpha = 1, shadow = true } = {}) {
  const p = { ...AVATARS[0], ...palette };
  const bob = frame % 2 === 0 ? 0 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (shadow) {
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(x - 6 * u, y - 1 * u, 12 * u, 2 * u);
  }
  // legs
  ctx.fillStyle = p.pants;
  const legOffset = frame % 4 === 1 || frame % 4 === 3 ? 1 : 0;
  ctx.fillRect(x - 4 * u, y - 8 * u, 3 * u, 8 * u - legOffset * u);
  ctx.fillRect(x + 1 * u, y - 8 * u, 3 * u, 8 * u - (1 - legOffset) * u);
  // body
  ctx.fillStyle = p.shirt;
  ctx.fillRect(x - 5 * u, y - 17 * u - bob * u, 10 * u, 10 * u);
  ctx.fillStyle = p.accent;
  ctx.fillRect(x - 5 * u, y - 17 * u - bob * u, 10 * u, 1 * u);
  // arms
  ctx.fillStyle = p.skin;
  ctx.fillRect(x - 7 * u, y - 16 * u - bob * u, 2 * u, 6 * u);
  ctx.fillRect(x + 5 * u, y - 16 * u - bob * u, 2 * u, 6 * u);
  // neck + head
  ctx.fillStyle = p.skin;
  ctx.fillRect(x - 1 * u, y - 19 * u - bob * u, 2 * u, 2 * u);
  ctx.fillRect(x - 4 * u, y - 26 * u - bob * u, 8 * u, 7 * u);
  // hair
  ctx.fillStyle = p.hair;
  ctx.fillRect(x - 4 * u, y - 27 * u - bob * u, 8 * u, 2 * u);
  if (dir !== 'up') {
    ctx.fillRect(x - 4 * u, y - 25 * u - bob * u, 1 * u, 2 * u);
    ctx.fillRect(x + 3 * u, y - 25 * u - bob * u, 1 * u, 2 * u);
  } else {
    ctx.fillRect(x - 4 * u, y - 25 * u - bob * u, 8 * u, 4 * u);
  }
  // face
  if (dir === 'down' || dir === 'left' || dir === 'right') {
    ctx.fillStyle = '#1a1a22';
    const eyeShift = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    ctx.fillRect(x - 2 * u + eyeShift * u, y - 23 * u - bob * u, 1 * u, 1 * u);
    ctx.fillRect(x + 1 * u + eyeShift * u, y - 23 * u - bob * u, 1 * u, 1 * u);
  }
  ctx.restore();
  return 27 * u;
}

/** Draw a head-and-shoulders portrait for dialogue and menus. */
export function drawPortrait(ctx, w, h, palette, { accent = '#0b1128' } = {}) {
  const p = { ...AVATARS[0], ...palette };
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, w, h);
  const u = Math.max(2, Math.floor(w / 24));
  const cx = w / 2;
  const baseY = h - u * 2;
  ctx.fillStyle = p.shirt;
  ctx.fillRect(cx - 7 * u, baseY - 9 * u, 14 * u, 9 * u);
  ctx.fillStyle = p.skin;
  ctx.fillRect(cx - 2 * u, baseY - 12 * u, 4 * u, 3 * u);
  ctx.fillRect(cx - 5 * u, baseY - 20 * u, 10 * u, 9 * u);
  ctx.fillStyle = p.hair;
  ctx.fillRect(cx - 5 * u, baseY - 21 * u, 10 * u, 3 * u);
  ctx.fillRect(cx - 6 * u, baseY - 19 * u, 2 * u, 5 * u);
  ctx.fillRect(cx + 4 * u, baseY - 19 * u, 2 * u, 5 * u);
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(cx - 2 * u, baseY - 16 * u, 1 * u, 1 * u);
  ctx.fillRect(cx + 1 * u, baseY - 16 * u, 1 * u, 1 * u);
  ctx.fillStyle = p.accent;
  ctx.fillRect(cx - 7 * u, baseY - 9 * u, 14 * u, u);
  ctx.restore();
}

export function drawNpcByPalette(ctx, npc, x, y, u, frame = 0) {
  return drawPerson(ctx, x, y, u, npc.palette, { dir: npc.dir || 'down', frame, shadow: true });
}
