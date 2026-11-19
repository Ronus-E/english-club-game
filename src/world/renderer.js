import {
  TILE_W, TILE_H, MAP_W, MAP_H, STATIONS, DECORATIONS, PATH_TILES, PLAZA, SPAWN,
} from './campus.js';
import { drawPerson, AVATARS } from './sprites.js';
import { drawIcon } from '../ui/icons.js';
import { hashString } from '../core/util.js';

export const VIEW_W = 480;
export const VIEW_H = 270;

const PALETTE = {
  grassA: '#244f3c',
  grassB: '#2a5943',
  grassEdge: '#1a3a2d',
  pathA: '#6e7c92',
  pathB: '#78879e',
  plazaA: '#8b95a9',
  plazaB: '#949fb4',
  water: '#2f6f9e',
  waterLight: '#4b93c4',
  shadow: 'rgba(5, 9, 20, .38)',
};

/** Short English labels drawn on campus signs (limited pixel width). */
const SIGN_LABELS = {
  hub: 'CLUB', vocabulary: 'VOCAB', grammar: 'GRAMMAR', reading: 'READ',
  writing: 'WRITE', culture: 'CULTURE', arena: 'FINAL', achievement: 'BADGES',
};

const worldToIso = (x, y) => ({ x: (x - y) * (TILE_W / 2), y: (x + y) * (TILE_H / 2) });

function diamond(ctx, cx, cy, w, h) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

function poly(ctx, points, fill, stroke = null, lineWidth = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

export class CampusRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.ctx.imageSmoothingEnabled = false;
    this.time = 0;
    this.reduced = false;
    this.camera = { ...SPAWN };
    this.camPx = null;
    this.player = { x: SPAWN.x, y: SPAWN.y, dir: 'down', frame: 0, moving: false, palette: AVATARS[0] };
    this.nextStation = null;
    this.highlight = null;
    this.zoom = 1;
    this.shake = 0;
  }

  setPlayer(state) {
    this.player = { ...this.player, ...state };
  }

  snapCamera() {
    this.camPx = worldToIso(this.player.x, this.player.y);
  }

  update(dt) {
    this.time += dt;
    const target = worldToIso(this.player.x, this.player.y);
    if (!this.camPx) this.camPx = { ...target };
    const k = this.reduced ? 1 : Math.min(1, dt * 6.5);
    this.camPx.x += (target.x - this.camPx.x) * k;
    this.camPx.y += (target.y - this.camPx.y) * k;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
  }

  project(wx, wy) {
    const p = worldToIso(wx, wy);
    const shakeX = this.shake ? Math.sin(this.time * 80) * this.shake : 0;
    return {
      x: p.x - this.camPx.x + VIEW_W / 2 + shakeX,
      y: p.y - this.camPx.y + VIEW_H / 2 - 26,
    };
  }

  render() {
    const ctx = this.ctx;
    const t = this.time;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#070c1c';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.drawGround(ctx, t);
    this.drawPads(ctx, t);
    this.drawEntities(ctx, t);
    this.drawBeacon(ctx, t);
    this.drawWeather(ctx, t);
  }

  drawGround(ctx, t) {
    for (let sum = 0; sum <= MAP_W + MAP_H; sum++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const ty = sum - tx;
        if (ty < 0 || ty >= MAP_H) continue;
        const p = this.project(tx + 0.5, ty + 0.5);
        if (p.x < -80 || p.x > VIEW_W + 80 || p.y < -60 || p.y > VIEW_H + 60) continue;
        const key = `${tx},${ty}`;
        const isPlaza = tx >= PLAZA.x1 && tx <= PLAZA.x2 && ty >= PLAZA.y1 && ty <= PLAZA.y2;
        const isPath = PATH_TILES.has(key);
        const checker = (tx + ty) % 2 === 0;
        let color = PALETTE.grassA;
        if (isPlaza) color = checker ? PALETTE.plazaA : PALETTE.plazaB;
        else if (isPath) color = checker ? PALETTE.pathA : PALETTE.pathB;
        else color = checker ? PALETTE.grassA : PALETTE.grassB;
        diamond(ctx, p.x, p.y, TILE_W + 1, TILE_H + 1);
        ctx.fillStyle = color;
        ctx.fill();
        // subtle tile seam
        ctx.strokeStyle = isPath || isPlaza ? 'rgba(20,26,44,.18)' : 'rgba(10,20,16,.22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (!isPath && !isPlaza) {
          const h = hashString(key);
          if (h % 7 === 0) {
            ctx.fillStyle = '#3c7a58';
            ctx.fillRect(p.x - 8, p.y + 3, 3, 2);
            ctx.fillRect(p.x + 5, p.y - 4, 2, 2);
          }
          if (h % 11 === 0) {
            ctx.fillStyle = '#d8c26a';
            ctx.fillRect(p.x + 10, p.y + 2, 2, 2);
          }
        }
      }
    }
    // soft outer vignette-ish gradient at map borders
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, 'rgba(7,12,28,.35)');
    g.addColorStop(0.4, 'rgba(7,12,28,0)');
    g.addColorStop(1, 'rgba(7,12,28,.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawPads(ctx, t) {
    for (const station of STATIONS) {
      const isNext = this.nextStation === station.id;
      const p = this.project(station.entrance.x, station.entrance.y);
      if (p.x < -60 || p.x > VIEW_W + 60) continue;
      const pulse = 0.5 + Math.sin(t * 3 + station.x) * 0.5;
      ctx.save();
      ctx.globalAlpha = isNext ? 0.42 + pulse * 0.28 : 0.16;
      diamond(ctx, p.x, p.y, 46, 23);
      ctx.fillStyle = isNext ? station.color : '#9fb3d9';
      ctx.fill();
      if (isNext) {
        ctx.globalAlpha = 0.8;
        diamond(ctx, p.x, p.y, 30 + pulse * 6, 15 + pulse * 3);
        ctx.strokeStyle = station.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawEntities(ctx, t) {
    const items = [];
    for (const station of STATIONS) {
      items.push({
        depth: station.x + station.y + station.w + station.h - 0.05,
        draw: () => this.drawBuilding(ctx, station, t),
      });
    }
    for (const deco of DECORATIONS) {
      items.push({
        depth: deco.x + deco.y,
        draw: () => this.drawDecoration(ctx, deco, t),
      });
    }
    for (const npc of this.npcs || []) {
      items.push({
        depth: npc.x + npc.y,
        draw: () => this.drawNpc(ctx, npc, t),
      });
    }
    items.push({
      depth: this.player.x + this.player.y,
      draw: () => this.drawPlayer(ctx),
    });
    items.sort((a, b) => a.depth - b.depth);
    for (const item of items) item.draw();
  }

  setNpcs(list) {
    this.npcs = list;
  }

  drawShadow(ctx, x, y, w = 22, h = 8) {
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBuilding(ctx, s, t) {
    const p = this.project(s.x, s.y);
    const px = p.x;
    const py = p.y;
    const wallH = 55;
    const beamH = 12;
    const halfW = (s.w * TILE_W) / 2;
    const halfH = (s.h * TILE_H) / 2;

    // footprint corners
    const top = [px, py - halfH];
    const right = [px + halfW, py];
    const bottom = [px, py + halfH];
    const left = [px - halfW, py];

    // ground shadow
    this.drawShadow(ctx, px + 6, py + 8, halfW * 0.92, halfH * 0.9);

    // walls (front-left and front-right faces)
    poly(ctx, [left, bottom, [bottom[0], bottom[1] - wallH], [left[0], left[1] - wallH]], s.accent);
    poly(ctx, [bottom, right, [right[0], right[1] - wallH], [bottom[0], bottom[1] - wallH]], this.shade(s.color, -22));

    // wall pixel shading bands
    for (let i = 0; i < 3; i++) {
      const yy = bottom[1] - 10 - i * 14;
      poly(ctx, [[left[0] + 3, yy - 8], [bottom[0], yy], [bottom[0], yy + 2], [left[0] + 3, yy - 6]], 'rgba(255,255,255,.05)');
      poly(ctx, [[bottom[0], yy], [right[0] - 3, yy - 8], [right[0] - 3, yy - 6], [bottom[0], yy + 2]], 'rgba(0,0,0,.08)');
    }

    // roof slab (thick pixel edge)
    const roofLift = wallH;
    const roofTop = [top[0], top[1] - roofLift - beamH];
    const roofRight = [right[0], right[1] - roofLift - beamH];
    const roofBottom = [bottom[0], bottom[1] - roofLift - beamH];
    const roofLeft = [left[0], left[1] - roofLift - beamH];
    poly(ctx, [left, bottom, bottom, left].map((_, i) => [left, bottom, [bottom[0], bottom[1] - wallH], [left[0], left[1] - wallH]][i]), s.accent);
    // roof side edges
    poly(ctx, [[left[0], left[1] - wallH], [bottom[0], bottom[1] - wallH], roofBottom, roofLeft], this.shade(s.color, -34));
    poly(ctx, [[bottom[0], bottom[1] - wallH], [right[0], right[1] - wallH], roofRight, roofBottom], this.shade(s.color, -44));
    // roof top surface
    poly(ctx, [roofTop, roofRight, roofBottom, roofLeft], s.color, '#0c1226', 1);
    // roof pixels
    ctx.save();
    poly(ctx, [roofTop, roofRight, roofBottom, roofLeft], null);
    ctx.clip();
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 5; i++) {
      const yy = roofTop[1] + 6 + i * 7;
      ctx.fillStyle = i % 2 ? '#ffffff' : '#000000';
      ctx.fillRect(px - halfW, yy, halfW * 2, 2);
    }
    ctx.restore();

    // door with warm light
    const doorY = bottom[1];
    const doorW = 16;
    const doorH = 26;
    poly(ctx, [
      [px - doorW / 2, doorY - 2],
      [px + doorW / 2 - 4, doorY + 6],
      [px + doorW / 2 - 4, doorY + 6 - doorH],
      [px - doorW / 2, doorY - 2 - doorH],
    ], '#2a1a12', '#0b0d18', 1);
    ctx.fillStyle = 'rgba(255, 205, 120, .85)';
    ctx.fillRect(px - 5, doorY + 1 - doorH, 4, 3);
    ctx.fillStyle = 'rgba(255, 205, 120, .18)';
    ctx.beginPath();
    ctx.ellipse(px, doorY + 6, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // windows (lit at night)
    const lit = (hashString(s.id) % 3) !== 0;
    for (let i = 0; i < 2; i++) {
      const wx = px - halfW * 0.55 + i * 16;
      const wy = doorY - 22 + i * 2;
      ctx.fillStyle = lit ? '#ffd98a' : '#27304c';
      ctx.fillRect(wx, wy - 12, 8, 8);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(wx, wy - 6, 8, 2);
    }

    // English signage: icon + short name, readable on the campus map
    const signY = roofLeft[1] - 8;
    const signW = 58;
    const signH = 24;
    ctx.fillStyle = '#0d1428';
    ctx.fillRect(px - signW / 2, signY, signW, signH);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(px - signW / 2, signY, signW, signH);
    drawIcon(ctx, this.stationIcon(s.id), px - signW / 2 + 3, signY + 5, 14);
    ctx.save();
    ctx.fillStyle = '#f2e8d0';
    ctx.font = '700 8px "DejaVu Sans Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(SIGN_LABELS[s.id] || s.short.toUpperCase(), px - signW / 2 + 20, signY + signH / 2);
    ctx.restore();

    // animated roof beacon for the next station
    if (this.nextStation === s.id) {
      const pulse = 0.5 + Math.sin(t * 4) * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.fillStyle = s.color;
      ctx.fillRect(px - 2, roofTop[1] - 18 - pulse * 4, 4, 12);
      ctx.fillRect(px - 7, roofTop[1] - 8 - pulse * 4, 14, 3);
      ctx.restore();
    }
  }

  stationIcon(id) {
    const map = {
      hub: 'flag', vocabulary: 'tree', grammar: 'book',
      reading: 'book', writing: 'pencil', culture: 'globe', arena: 'trophy', achievement: 'trophy',
    };
    return map[id] || 'flag';
  }

  shade(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (num & 255) + amount));
    return `rgb(${r},${g},${b})`;
  }

  drawDecoration(ctx, d, t) {
    const p = this.project(d.x, d.y);
    if (p.x < -60 || p.x > VIEW_W + 60 || p.y < -60 || p.y > VIEW_H + 60) return;
    switch (d.type) {
      case 'tree': {
        this.drawShadow(ctx, p.x, p.y + 6, 16, 6);
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(p.x - 3, p.y - 18, 6, 20);
        const sway = this.reduced ? 0 : Math.sin(t * 1.4 + d.x) * 2;
        const layers = [
          { y: -16, w: 30, h: 12, c: '#2f7a4d' },
          { y: -26, w: 24, h: 12, c: '#3a8f5b' },
          { y: -35, w: 16, h: 10, c: '#4aa86a' },
        ];
        for (const l of layers) {
          ctx.fillStyle = l.c;
          ctx.fillRect(p.x - l.w / 2 + sway, p.y + l.y, l.w, l.h);
          ctx.fillStyle = 'rgba(255,255,255,.08)';
          ctx.fillRect(p.x - l.w / 2 + sway + 2, p.y + l.y + 2, l.w - 6, 2);
        }
        break;
      }
      case 'bench': {
        this.drawShadow(ctx, p.x, p.y + 4, 16, 5);
        ctx.fillStyle = '#8a5a34';
        ctx.fillRect(p.x - 15, p.y - 6, 30, 5);
        ctx.fillRect(p.x - 15, p.y - 12, 30, 4);
        ctx.fillStyle = '#4a4f66';
        ctx.fillRect(p.x - 12, p.y - 1, 3, 6);
        ctx.fillRect(p.x + 9, p.y - 1, 3, 6);
        break;
      }
      case 'lamp': {
        ctx.fillStyle = '#3c435e';
        ctx.fillRect(p.x - 1, p.y - 34, 3, 36);
        ctx.fillStyle = '#ffd98a';
        ctx.fillRect(p.x - 5, p.y - 40, 11, 7);
        if (!this.reduced) {
          const glow = ctx.createRadialGradient(p.x, p.y - 36, 2, p.x, p.y - 36, 26);
          glow.addColorStop(0, 'rgba(255, 216, 130, .22)');
          glow.addColorStop(1, 'rgba(255, 216, 130, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(p.x - 26, p.y - 62, 52, 52);
        }
        break;
      }
      case 'fountain': {
        this.drawShadow(ctx, p.x, p.y + 4, 28, 10);
        ctx.fillStyle = '#6b7691';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 30, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2f6f9e';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 1, 24, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5f6b88';
        ctx.fillRect(p.x - 4, p.y - 22, 8, 20);
        ctx.fillStyle = '#8b97b4';
        ctx.fillRect(p.x - 10, p.y - 26, 20, 5);
        if (!this.reduced) {
          for (let i = 0; i < 5; i++) {
            const ph = (t * 1.4 + i * 0.7) % 1;
            const dx = (i - 2) * 7 * ph;
            const dy = -18 - Math.sin(ph * Math.PI) * 12;
            ctx.fillStyle = `rgba(143, 214, 255, ${0.7 - ph * 0.5})`;
            ctx.fillRect(p.x + dx, p.y + dy, 2, 3);
          }
        }
        break;
      }
      case 'flowers': {
        ctx.fillStyle = '#357a52';
        ctx.fillRect(p.x - 8, p.y - 2, 16, 2);
        const colors = ['#ffd166', '#ff8fd8', '#e8eefc'];
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = colors[i % colors.length];
          ctx.fillRect(p.x - 9 + i * 5, p.y - 6 - (i % 2) * 2, 2, 3);
        }
        break;
      }
      case 'flag': {
        ctx.fillStyle = '#8b93b8';
        ctx.fillRect(p.x, p.y - 40, 2, 42);
        const wave = this.reduced ? 0 : Math.sin(t * 3 + d.x) * 2;
        ctx.fillStyle = '#e04b4b';
        ctx.fillRect(p.x + 2, p.y - 40 + wave, 18, 10);
        ctx.fillStyle = '#f4f1e0';
        ctx.fillRect(p.x + 2, p.y - 35 + wave, 18, 2);
        ctx.fillStyle = '#2b4c9b';
        ctx.fillRect(p.x + 2, p.y - 40 + wave, 7, 5);
        break;
      }
      case 'statue': {
        this.drawShadow(ctx, p.x, p.y + 4, 12, 5);
        ctx.fillStyle = '#7b849e';
        ctx.fillRect(p.x - 8, p.y - 6, 16, 7);
        ctx.fillStyle = '#aeb8cc';
        ctx.fillRect(p.x - 4, p.y - 26, 8, 20);
        ctx.fillRect(p.x - 5, p.y - 32, 10, 7);
        break;
      }
      default:
        break;
    }
  }

  drawNpc(ctx, npc, t) {
    const p = this.project(npc.x, npc.y);
    if (p.x < -50 || p.x > VIEW_W + 50) return;
    const bobFrame = Math.floor(t * 2 + npc.x) % 4 === 0 ? 1 : 0;
    drawPerson(ctx, p.x, p.y, 2, npc.palette, { dir: npc.dir || 'down', frame: bobFrame, shadow: true });
    if (this.highlight === npc.id) {
      const pulse = 0.5 + Math.sin(t * 5) * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.4 + pulse * 0.5;
      ctx.fillStyle = '#ffc857';
      ctx.fillRect(p.x - 7, p.y - 64, 14, 2);
      ctx.fillRect(p.x - 4, p.y - 68, 8, 4);
      ctx.restore();
    }
  }

  drawPlayer(ctx) {
    const p = this.project(this.player.x, this.player.y);
    const frame = this.player.moving ? this.player.frame : 0;
    drawPerson(ctx, p.x, p.y, 2, this.player.palette, {
      dir: this.player.dir,
      frame,
      shadow: true,
    });
  }

  drawBeacon(ctx, t) {
    if (!this.nextStation) return;
    const station = STATIONS.find((s) => s.id === this.nextStation);
    if (!station) return;
    const p = this.project(station.entrance.x, station.entrance.y);
    if (p.x < -20 || p.x > VIEW_W + 20) return;
    const bob = Math.sin(t * 2.6) * 3;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = station.color;
    ctx.fillRect(p.x - 1, p.y - 42 + bob, 2, 10);
    ctx.fillRect(p.x - 5, p.y - 46 + bob, 10, 3);
    ctx.fillRect(p.x - 3, p.y - 49 + bob, 6, 2);
    ctx.globalAlpha = 0.22;
    diamond(ctx, p.x, p.y + bob * 0.3, 30, 15);
    ctx.fillStyle = station.color;
    ctx.fill();
    ctx.restore();
  }

  drawWeather(ctx, t) {
    if (this.reduced) return;
    // fireflies near the garden / fountain
    for (let i = 0; i < 14; i++) {
      const seed = hashString(`fly${i}`);
      const ox = (seed % 100) / 100;
      const oy = ((seed >> 8) % 100) / 100;
      const x = (ox * VIEW_W + Math.sin(t * 0.5 + i) * 14 + VIEW_W) % VIEW_W;
      const y = (oy * VIEW_H * 0.7 + Math.cos(t * 0.7 + i * 1.7) * 10 + VIEW_H) % VIEW_H;
      ctx.globalAlpha = 0.2 + 0.6 * (0.5 + Math.sin(t * 2 + i) * 0.5);
      ctx.fillStyle = '#ffe28a';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}
