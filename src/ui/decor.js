/**
 * Small canvas decorations: splash logo, ambient starfield, avatar preview and
 * the results badge. All drawn procedurally, no image files.
 */
import { hashString } from '../core/util.js';

export function drawLogo(canvas, time = 0) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 - 4;
  const r = w * 0.3;
  const u = Math.max(2, Math.round(w / 44));

  // orbit ring
  ctx.strokeStyle = 'rgba(255,200,87,.5)';
  ctx.lineWidth = u;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 1.35, r * 0.55, -0.35, 0, Math.PI * 2);
  ctx.stroke();

  // globe body
  ctx.fillStyle = '#12224d';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#63c5ff';
  ctx.lineWidth = u;
  ctx.stroke();

  // latitude / longitude pixel lines
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - u, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(92,225,166,.35)';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(cx - r, cy + i * r * 0.36 - u / 2, r * 2, Math.max(1, u * 0.6));
  }
  ctx.fillStyle = 'rgba(99,197,255,.4)';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(cx + i * r * 0.34 - u / 2, cy - r, Math.max(1, u * 0.6), r * 2);
  }
  // land masses
  ctx.fillStyle = '#5ce1a6';
  const blobs = [[-0.45, -0.3, 0.4, 0.28], [0.15, -0.05, 0.34, 0.45], [-0.35, 0.35, 0.3, 0.2]];
  for (const [bx, by, bw, bh] of blobs) {
    ctx.fillRect(cx + bx * r, cy + by * r, bw * r, bh * r);
  }
  ctx.restore();

  // small orbiting dot
  const angle = -0.35 + time * 0.6;
  const ox = cx + Math.cos(angle) * r * 1.35;
  const oy = cy + Math.sin(angle) * r * 0.55;
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(ox - u, oy - u, u * 2, u * 2);

  // speech bubble with "EC"
  const bx = cx + r * 0.55;
  const by = cy - r * 1.05;
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(bx, by, u * 14, u * 10);
  ctx.fillStyle = '#0b1026';
  ctx.fillRect(bx + u * 2, by + u * 2, u * 10, u * 6);
  ctx.fillStyle = '#ffc857';
  ctx.font = `${u * 6}px monospace`;
  ctx.textBaseline = 'top';
  ctx.fillText('EC', bx + u * 3, by + u * 2.4);
  ctx.fillRect(bx + u * 3, by + u * 10, u * 3, u * 3);
}

export class AmbientField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.time = 0;
    this.running = false;
    this.reduced = false;
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w;
    this.height = h;
    const target = Math.round(Math.min(70, (w * h) / 22000));
    this.particles = Array.from({ length: Math.max(18, target) }, (_, i) => {
      const seed = hashString(`amb${i}`);
      return {
        x: (seed % 1000) / 1000,
        y: ((seed >> 10) % 1000) / 1000,
        speed: 0.004 + ((seed >> 5) % 100) / 40000,
        size: (seed % 3) + 1,
        tone: seed % 5,
      };
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.time += dt;
      this.render(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  render(dt) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    if (this.reduced) return;
    const colors = ['rgba(99,197,255,', 'rgba(255,200,87,', 'rgba(92,225,166,', 'rgba(167,139,250,', 'rgba(255,255,255,'];
    for (const p of this.particles) {
      p.y -= p.speed * dt * 18;
      if (p.y < -0.02) p.y = 1.02;
      const x = (p.x + Math.sin(this.time * 0.2 + p.size) * 0.004) * this.width;
      const y = p.y * this.height;
      ctx.fillStyle = `${colors[p.tone]}${0.18 + (p.size % 3) * 0.1})`;
      ctx.fillRect(x, y, p.size, p.size);
    }
  }

  setReduced(reduced) { this.reduced = Boolean(reduced); }
}

export function drawResultsBadge(canvas, { grade = 'C', percent = 0 }) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  const u = Math.max(2, Math.round(w / 32));
  const cx = w / 2;
  const cy = h / 2;

  ctx.fillStyle = '#0a1024';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#2e3d75';
  ctx.lineWidth = u;
  ctx.strokeRect(u, u, w - u * 2, h - u * 2);

  // pixel trophy
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(cx - u * 5, cy - u * 10, u * 10, u * 6);
  ctx.fillStyle = '#e09b25';
  ctx.fillRect(cx - u * 3, cy - u * 4, u * 6, u * 2);
  ctx.fillRect(cx - u * 1, cy - u * 2, u * 2, u * 3);
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(cx - u * 4, cy + u * 1, u * 8, u * 2);
  ctx.fillStyle = '#f4f1e0';
  ctx.fillRect(cx - u * 6, cy - u * 12, u * 2, u * 4);
  ctx.fillRect(cx + u * 4, cy - u * 12, u * 2, u * 4);

  const colors = { S: '#ffd166', A: '#5ce1a6', B: '#63c5ff', C: '#a78bfa', D: '#ff6b6b' };
  ctx.fillStyle = colors[grade] || '#eef2ff';
  ctx.font = `bold ${Math.round(w / 3.2)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(grade, cx, cy + h * 0.3);
  ctx.fillStyle = '#7c88b0';
  ctx.font = `${Math.round(w / 12)}px monospace`;
  ctx.fillText(`${percent}%`, cx, h - u * 4);
}
