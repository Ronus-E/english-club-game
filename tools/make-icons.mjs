#!/usr/bin/env node
/**
 * Generates the PWA icons as real PNG files with a tiny hand-written encoder.
 * No external tools, no dependencies, fully deterministic pixel art.
 *
 * Usage: node tools/make-icons.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';

const OUT = join(process.cwd(), 'assets', 'icons');
mkdirSync(OUT, { recursive: true });

const COLORS = {
  bg: '#0b1026',
  bgDeep: '#060a18',
  globe: '#12224d',
  globeEdge: '#63c5ff',
  land: '#5ce1a6',
  landDark: '#1f9d72',
  amber: '#ffc857',
  amberDeep: '#e09b25',
  ink: '#0b1026',
  white: '#eef2ff',
};

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* 32 × 32 logical pixel grid; every cell is painted exactly once. */
const GRID = 32;
const cells = [];

function fillGrid(color) {
  cells.length = 0;
  for (let i = 0; i < GRID * GRID; i += 1) cells.push(color);
}
const set = (x, y, color) => {
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
  cells[y * GRID + x] = color;
};
const rect = (x0, y0, w, h, color) => {
  for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) set(x, y, color);
};

const GLYPH_E = [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [1, 2], [0, 3], [0, 4], [1, 4], [2, 4]];
const GLYPH_C = [[1, 0], [2, 0], [0, 1], [0, 2], [0, 3], [1, 4], [2, 4]];

function draw() {
  fillGrid(COLORS.bg);

  // subtle frame so the icon reads on light and dark backgrounds
  rect(0, 0, GRID, 1, COLORS.bgDeep);
  rect(0, GRID - 1, GRID, 1, COLORS.bgDeep);
  rect(0, 0, 1, GRID, COLORS.bgDeep);
  rect(GRID - 1, 0, 1, GRID, COLORS.bgDeep);

  const cx = 15.5;
  const cy = 17.5;
  const R = 10.6;

  // globe body + outline
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= R - 1.1) set(x, y, COLORS.globe);
      else if (d <= R) set(x, y, COLORS.globeEdge);
    }
  }

  // pixel continents inside the globe
  const land = [
    [9, 12, 4, 2], [8, 14, 3, 3], [10, 17, 4, 2],
    [16, 11, 3, 3], [17, 14, 3, 4], [15, 18, 4, 3],
    [11, 22, 3, 2], [19, 19, 2, 3], [13, 24, 2, 2],
  ];
  for (const [x, y, w, h] of land) {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        const d = Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy);
        if (d <= R - 2) set(xx, yy, (xx + yy) % 7 === 0 ? COLORS.landDark : COLORS.land);
      }
    }
  }

  // orbit dots
  set(3, 13, COLORS.amber);
  set(4, 13, COLORS.amberDeep);
  set(27, 22, COLORS.amber);
  set(26, 22, COLORS.amberDeep);

  // speech bubble
  rect(17, 2, 13, 9, COLORS.amber);
  rect(18, 3, 11, 7, COLORS.ink);
  for (const [x, y] of GLYPH_E) set(20 + x, 4 + y, COLORS.amber);
  for (const [x, y] of GLYPH_C) set(24 + x, 4 + y, COLORS.amber);
  rect(18, 11, 3, 1, COLORS.amber);
  rect(18, 12, 2, 1, COLORS.amberDeep);

  // base speech marks
  rect(6, 26, 2, 2, COLORS.white);
  rect(10, 26, 2, 2, COLORS.amber);
  rect(14, 26, 2, 2, COLORS.white);
  void GRID;
}

/* --------------------------------------------------------------- PNG writer */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // no filter
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Rasterise the logical grid into a size × size RGBA buffer (nearest neighbour). */
function rasterise(size, contentScale = 1) {
  draw();
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // normalised coordinates, then shrunk towards the centre for maskable icons
      const u = (((x + 0.5) / size) - 0.5) / contentScale + 0.5;
      const v = (((y + 0.5) / size) - 0.5) / contentScale + 0.5;
      const inside = u >= 0 && u < 1 && v >= 0 && v < 1;
      const gx = Math.min(GRID - 1, Math.floor(u * GRID));
      const gy = Math.min(GRID - 1, Math.floor(v * GRID));
      const color = inside ? cells[gy * GRID + gx] : COLORS.bg;
      const [r, g, b] = hexToRgb(color);
      const i = (y * size + x) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return px;
}

const targets = [
  ['icon-512.png', 512, 1],
  ['icon-192.png', 192, 1],
  ['icon-maskable-512.png', 512, 0.78],
];

for (const [name, size, scale] of targets) {
  const file = join(OUT, name);
  writeFileSync(file, encodePng(size, rasterise(size, scale)));
  console.log(`wrote ${name} (${size}px${scale !== 1 ? `, content ${Math.round(scale * 100)}%` : ''})`);
}
void dirname;
