#!/usr/bin/env node
/**
 * First real boot check: loads the game in headless Chromium, reports console
 * errors, and walks the splash → menu → level → intro → campus path.
 *
 * Usage: node tools/smoke.mjs [url]
 */
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { launchChromium, listTargets, Client } from './cdp.mjs';

const URL = process.argv[2] || 'http://127.0.0.1:8080/';
const SHOTS = '/tmp/opencode/ec-shots';
const PORT = 9333;

const log = (...args) => console.log(...args);

const PROFILE = '/tmp/opencode/chrome-ec-smoke';
rmSync(PROFILE, { recursive: true, force: true });
const browser = await launchChromium({ port: PORT, userDataDir: PROFILE });
try {
  const targets = await listTargets(PORT);
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  const client = await new Client(page.webSocketDebuggerUrl).connect();
  await client.init();
  await client.viewport(1440, 900);

  await client.goto(URL, { settleMs: 900 });

  const boot = await client.evaluate(`(() => {
    const g = window.__ENGLISH_CLUB__;
    const hasBoot = document.body.classList.contains('is-booted');
    const active = [...document.querySelectorAll('.screen')].filter(s => s.classList.contains('is-active')).map(s => s.id);
    return {
      hasGlobal: Boolean(g),
      keys: g ? Object.keys(g) : [],
      hasBootClass: hasBoot,
      activeScreens: active,
      bootBtnDisabled: document.getElementById('bootBtn')?.disabled,
      canvasCount: document.querySelectorAll('canvas').length,
      gameCanvasSize: (() => { const c = document.getElementById('gameCanvas'); return c ? [c.width, c.height] : null; })(),
      exercises: g ? document.querySelector('#bootStatus')?.textContent : null,
    };
  })()`);
  log('BOOT', JSON.stringify(boot, null, 2));

  await client.screenshot(join(SHOTS, '01-splash.png'));

  // splash → menu
  const menu = await client.evaluate(`(() => {
    document.getElementById('bootBtn').click();
    return {
      active: [...document.querySelectorAll('.screen.is-active')].map(s => s.id),
      profile: document.getElementById('profileName')?.textContent,
      levels: document.querySelectorAll('#levelGrid .level-card').length,
    };
  })()`);
  await new Promise((r) => setTimeout(r, 400));
  log('MENU', JSON.stringify(menu));
  await client.screenshot(join(SHOTS, '02-menu.png'));

  // menu → level select
  const level = await client.evaluate(`(() => {
    document.getElementById('playBtn').click();
    return {
      active: [...document.querySelectorAll('.screen.is-active')].map(s => s.id),
      cards: [...document.querySelectorAll('#levelGrid .level-card')].map(c => ({
        level: c.dataset.level,
        title: c.querySelector('h3')?.textContent,
        selected: c.classList.contains('is-selected'),
      })),
      continueVisible: Boolean(document.getElementById('levelContinueBtn')?.offsetParent),
    };
  })()`);
  await new Promise((r) => setTimeout(r, 400));
  log('LEVEL', JSON.stringify(level, null, 2));
  await client.screenshot(join(SHOTS, '03-level.png'));

  // level → intro
  const intro = await client.evaluate(`(() => {
    document.querySelector('#levelGrid .level-card[data-level="A2"]')?.click();
    document.getElementById('levelContinueBtn').click();
    return {
      active: [...document.querySelectorAll('.screen.is-active')].map(s => s.id),
      name: document.getElementById('playerNameInput')?.value,
      avatarSwatches: document.querySelectorAll('#avatarPicker .avatar-swatch').length,
      storedLevel: window.__ENGLISH_CLUB__.store.get().level,
    };
  })()`);
  await new Promise((r) => setTimeout(r, 400));
  log('INTRO', JSON.stringify(intro));
  await client.screenshot(join(SHOTS, '04-intro.png'));

  // intro → campus
  const campus = await client.evaluate(`(() => {
    document.getElementById('startMissionBtn').click();
    const m = window.__ENGLISH_CLUB__.mission;
    return {
      active: [...document.querySelectorAll('.screen.is-active')].map(s => s.id),
      state: m.state,
      level: m.level,
      plan: Object.fromEntries(Object.entries(m.plan.stations).map(([k, v]) => [k, v.length])),
      player: { x: +m.player.x.toFixed(2), y: +m.player.y.toFixed(2) },
      route: [...document.querySelectorAll('#routeBar .route-chip')].map(c => c.textContent),
      timer: document.getElementById('timerValue')?.textContent,
      hudPhase: document.getElementById('hudPhase')?.textContent,
    };
  })()`);
  await new Promise((r) => setTimeout(r, 900));
  log('CAMPUS', JSON.stringify(campus, null, 2));
  await client.screenshot(join(SHOTS, '05-campus.png'));

  // canvas pixel sanity: is the campus actually drawn?
  const canvas = await client.evaluate(`(() => {
    const c = document.getElementById('gameCanvas');
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    let opaque = 0;
    for (let i = 0; i < data.length; i += 4 * 97) {
      if (data[i + 3] > 0) opaque += 1;
      seen.add((data[i] >> 4) + ',' + (data[i + 1] >> 4) + ',' + (data[i + 2] >> 4));
    }
    return { width: c.width, height: c.height, sampled: opaque, distinctColors: seen.size,
      cssSize: [c.clientWidth, c.clientHeight] };
  })()`);
  log('CANVAS', JSON.stringify(canvas));

  log('CONSOLE_ERRORS', JSON.stringify(client.consoleErrors, null, 2));
  log('EXCEPTIONS', JSON.stringify(client.exceptions, null, 2));
  log('CONSOLE_WARNINGS', JSON.stringify(client.consoleWarnings.slice(0, 10), null, 2));

  await client.close();
} finally {
  browser.proc.kill('SIGKILL');
}
