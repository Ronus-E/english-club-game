/**
 * End-to-end test in real Chromium, driven over CDP (no Playwright).
 * Covers: boot, navigation, keyboard movement, collision, NPC dialogue,
 * every remaining station and exercise type, final arena, results, achievements,
 * pause, practice, settings, responsive layout and offline reload.
 *
 * Run: node tests/e2e.mjs [url]
 */
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchChromium, listTargets, Client } from '../tools/cdp.mjs';

const URL = process.argv[2] || 'http://127.0.0.1:8080/';
const PORT = 9334;
const PROFILE = '/tmp/opencode/chrome-ec-e2e';
const SHOTS = '/tmp/opencode/ec-shots/e2e';

const results = [];
const log = (...args) => console.log(...args);

const browser = await launchChromium({ port: PORT, userDataDir: PROFILE, width: 1440, height: 900 });
let client = null;

try {
  rmSync(PROFILE, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  const targets = await listTargets(PORT);
  const page = targets.find((t) => t.type === 'page');
  client = await new Client(page.webSocketDebuggerUrl).connect();
  await client.init();
  await client.viewport(1440, 900);

  const ev = (fn, ...args) => client.evaluate(
    `(${fn.toString()})(${args.map((a) => JSON.stringify(a === undefined ? null : a)).join(',')})`,
  );

  async function step(name, fn) {
    try {
      const value = await fn();
      results.push({ name, ok: true, value });
      log(`✔ ${name}${value === undefined ? '' : ` — ${JSON.stringify(value)}`}`);
      return value;
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
      log(`✖ ${name} — ${error.message}`);
      throw error;
    }
  }

  const shot = (name) => client.screenshot(join(SHOTS, name)).catch(() => {});
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function key(type, code, keyName, vk) {
    await client.send('Input.dispatchKeyEvent', {
      type, code, key: keyName, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
    });
  }

  /* ================================================================ 1. BOOT */
  await step('page loads without console errors or exceptions', async () => {
    await client.goto(URL, { settleMs: 1200 });
    const health = await ev(() => ({
      title: document.title,
      readyState: document.readyState,
      htmlLength: document.documentElement?.outerHTML?.length || 0,
      hasSplash: Boolean(document.getElementById('screen-splash')),
    }));
    if (!health.hasSplash) {
      throw new Error(`page did not load (${health.title || 'no title'}, ${health.htmlLength} bytes) — is the static server running?`);
    }
    const boot = await ev(async () => ({
      booted: document.body.classList.contains('is-booted'),
      global: Boolean(window.__ENGLISH_CLUB__),
      splash: document.getElementById('screen-splash').classList.contains('is-active'),
      canvas: (() => {
        const c = document.getElementById('gameCanvas');
        return c ? [c.width, c.height] : null;
      })(),
      title: document.title,
    }));
    if (client.consoleErrors.length) throw new Error(`console errors: ${client.consoleErrors.join(' | ')}`);
    if (client.exceptions.length) throw new Error(`exceptions: ${client.exceptions.join(' | ')}`);
    if (!boot.global) throw new Error('window.__ENGLISH_CLUB__ missing');
    if (!boot.splash) throw new Error('splash screen not active');
    return boot;
  });
  await shot('01-splash.png');

  /* ============================================================ 2. NAVIGATION */
  await step('splash → menu → level → intro with real clicks', async () => {
    const out = await ev(async () => {
      const click = (id) => document.getElementById(id).click();
      click('bootBtn');
      await new Promise((r) => setTimeout(r, 120));
      const menuActive = document.querySelector('#screen-menu').classList.contains('is-active');
      click('playBtn');
      await new Promise((r) => setTimeout(r, 120));
      const cards = document.querySelectorAll('#levelGrid .level-card').length;
      document.querySelector('#levelGrid .level-card[data-level="A1"]').click();
      click('levelContinueBtn');
      await new Promise((r) => setTimeout(r, 120));
      const introActive = document.querySelector('#screen-intro').classList.contains('is-active');
      const swatches = document.querySelectorAll('#avatarPicker .avatar-swatch').length;
      document.getElementById('playerNameInput').value = 'Test Runner';
      document.getElementById('playerNameInput').dispatchEvent(new Event('input', { bubbles: true }));
      const storedName = window.__ENGLISH_CLUB__.store.get().name;
      return { menuActive, cards, introActive, swatches, storedName };
    });
    if (!out.menuActive || !out.introActive) throw new Error('navigation failed');
    if (out.cards !== 3) throw new Error(`expected 3 level cards, got ${out.cards}`);
    if (out.swatches < 4) throw new Error(`avatar picker empty (${out.swatches})`);
    if (out.storedName !== 'Test Runner') throw new Error(`name not stored: ${out.storedName}`);
    return out;
  });
  await shot('02-intro.png');

  /* ============================================================== 3. MISSION */
  await step('mission starts with the advertised plan and a running clock', async () => {
    const out = await ev(async () => {
      document.getElementById('startMissionBtn').click();
      await new Promise((r) => setTimeout(r, 400));
      const m = window.__ENGLISH_CLUB__.mission;
      return {
        screen: document.querySelector('#screen-game').classList.contains('is-active'),
        state: m.state,
        level: m.level,
        plan: Object.fromEntries(Object.entries(m.plan.stations).map(([k, v]) => [k, v.length])),
        routeChips: document.querySelectorAll('#routeBar .route-chip').length,
        timer: document.getElementById('timerValue').textContent,
        timerRunning: m.timer.running,
      };
    });
    if (out.state !== 'playing') throw new Error(`state ${out.state}`);
    if (JSON.stringify(out.plan) !== JSON.stringify({ vocabulary: 3, grammar: 2, writing: 1, culture: 2, final: 2 })) {
      throw new Error(`plan shape ${JSON.stringify(out.plan)}`);
    }
    if (out.routeChips !== 4) throw new Error(`route chips ${out.routeChips}`);
    if (!out.timerRunning) throw new Error('timer not running');
    return out;
  });
  await sleep(700);
  await shot('03-campus.png');

  /* ============================================================ 4. MOVEMENT */
  await step('keyboard moves the player and the clock keeps counting', async () => {
    const before = await ev(() => {
      const m = window.__ENGLISH_CLUB__.mission;
      return { x: m.player.x, y: m.player.y, remaining: m.timer.remainingSeconds() };
    });
    await key('rawKeyDown', 'KeyD', 'd', 68);
    await sleep(600);
    await key('keyUp', 'KeyD', 'd', 68);
    await sleep(120);
    const after = await ev(() => {
      const m = window.__ENGLISH_CLUB__.mission;
      return { x: m.player.x, y: m.player.y, remaining: m.timer.remainingSeconds() };
    });
    const moved = Math.hypot(after.x - before.x, after.y - before.y);
    if (moved < 0.5) throw new Error(`player barely moved (${moved.toFixed(2)} tiles)`);
    if (!(after.remaining < before.remaining)) throw new Error('timer did not count down');
    return { moved: +moved.toFixed(2), secondsUsed: +(before.remaining - after.remaining).toFixed(2) };
  });

  await step('collision blocks the player inside a building', async () => {
    const out = await ev(async () => {
      const campus = await import('/src/world/campus.js');
      const m = window.__ENGLISH_CLUB__.mission;
      const station = campus.STATION_BY_ID.grammar;
      const insideX = station.x + station.w / 2;
      const insideY = station.y + station.h / 2;
      const canStandInside = campus.canStand(insideX, insideY);
      // approach from the left edge and push right for ~2 s of simulated time
      m.player.x = station.x - 0.7;
      m.player.y = station.y + station.h / 2;
      const originalAxis = m.inputAxis;
      m.inputAxis = () => ({ x: 1, y: 0, active: true });
      for (let i = 0; i < 40; i += 1) m.movePlayer(0.05);
      m.inputAxis = originalAxis;
      return {
        canStandInside,
        finalX: m.player.x,
        stationX: station.x,
        penetration: m.player.x - station.x,
      };
    });
    if (out.canStandInside) throw new Error('solid building tile is walkable');
    if (out.penetration > 0.02) throw new Error(`player entered the building by ${out.penetration.toFixed(2)} tiles`);
    return out;
  });

  /* ============================================================== 5. DIALOGUE */
  await step('NPC dialogue opens, advances and closes', async () => {
    const opened = await ev(async () => {
      const campus = await import('/src/world/campus.js');
      const m = window.__ENGLISH_CLUB__.mission;
      const npc = campus.NPCS.find((n) => n.id === 'guide');
      m.player.x = npc.x;
      m.player.y = npc.y + 0.25;
      m.detectNearby();
      const nearest = m.nearest;
      m.interact();
      await new Promise((r) => setTimeout(r, 120));
      return {
        nearest,
        open: !document.getElementById('overlay-dialogue').hidden,
        name: document.getElementById('dialogueName').textContent,
        text: document.getElementById('dialogueText').textContent.slice(0, 40),
        choices: document.querySelectorAll('#dialogueChoices button').length,
      };
    });
    if (opened.nearest?.kind !== 'npc') throw new Error(`nearest is ${JSON.stringify(opened.nearest)}`);
    if (!opened.open) throw new Error('dialogue did not open');
    if (!opened.name || !opened.text) throw new Error('dialogue content empty');
    await shot('04-dialogue.png');

    const closed = await ev(async () => {
      for (let i = 0; i < 12; i += 1) {
        const overlay = document.getElementById('overlay-dialogue');
        if (overlay.hidden) break;
        const choice = document.querySelector('#dialogueChoices button:last-of-type');
        const next = document.getElementById('dialogueNext');
        if (!next.hidden) next.click();
        else if (choice) choice.click();
        else break;
        await new Promise((r) => setTimeout(r, 60));
      }
      return {
        closed: document.getElementById('overlay-dialogue').hidden,
        overlayRootHidden: document.getElementById('overlayRoot').hidden,
      };
    });
    if (!closed.closed) throw new Error('dialogue never closed');
    if (!closed.overlayRootHidden) throw new Error('overlay root stayed visible');
    return { ...opened, ...closed, nearest: opened.nearest.kind };
  });

  /* ============================================================== 6. STATIONS */
  await client.evaluate(`window.__solveStation = async () => {
    const g = window.__ENGLISH_CLUB__;
    const body = document.getElementById('activityBody');
    const foot = document.getElementById('activityFoot');
    const overlay = document.getElementById('overlay-activity');
    const log = [];
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ']/g, '').replace(/\\s+/g, ' ').trim();
    let guard = 0;
    while (!overlay.hidden && guard < 80) {
      guard += 1;
      const runner = g.activities;
      const item = runner.item;
      if (!item) { await new Promise((r) => setTimeout(r, 40)); continue; }
      if (runner.answered) {
        const btn = foot.querySelector('button');
        if (btn) btn.click();
        await new Promise((r) => setTimeout(r, 40));
        continue;
      }
      if (item.type === 'choice') {
        const buttons = [...body.querySelectorAll('.option-btn')];
        buttons[item.answer].click();
        log.push(item.id + ':choice');
      } else if (item.type === 'match') {
        for (const pair of item.pairs) {
          const words = [...body.querySelectorAll('.match-cell[data-term]')];
          const pics = [...body.querySelectorAll('.match-cell[data-icon]')];
          const w = words.find((c) => c.dataset.term === pair.term);
          const p = pics.find((c) => c.dataset.icon === pair.icon);
          if (!w || !p) throw new Error('match cell missing for ' + item.id);
          w.click();
          p.click();
        }
        log.push(item.id + ':match');
      } else if (item.type === 'order') {
        const tokens = norm(item.answerText || item.words.join(' ')).split(' ');
        for (const token of tokens) {
          const chips = [...body.querySelectorAll('.word-bank .word-chip')].filter((c) => !c.disabled);
          const chip = chips.find((c) => norm(c.textContent) === token)
            || chips.find((c) => norm(c.textContent).startsWith(token) || token.startsWith(norm(c.textContent)));
          if (!chip) throw new Error('no chip for "' + token + '" in ' + item.id);
          chip.click();
        }
        const check = foot.querySelector('button');
        if (!check || check.disabled) throw new Error('check button disabled for ' + item.id);
        check.click();
        log.push(item.id + ':order');
      } else if (item.type === 'short') {
        const input = body.querySelector('input[type="text"]');
        input.value = (item.accepted && item.accepted[0]) || '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        foot.querySelector('button').click();
        log.push(item.id + ':short');
      } else {
        throw new Error('unhandled exercise type ' + item.type);
      }
      await new Promise((r) => setTimeout(r, 40));
    }
    return { solved: log, closed: overlay.hidden, guard };
  };`);

  const stationOrder = ['vocabulary', 'grammar', 'culture'];

  for (const stationId of stationOrder) {
    await step(`station "${stationId}" can be entered and fully answered`, async () => {
      const entered = await ev(async (id) => {
        const campus = await import('/src/world/campus.js');
        const m = window.__ENGLISH_CLUB__.mission;
        const station = campus.STATION_BY_ID[id];
        m.player.x = station.entrance.x;
        m.player.y = station.entrance.y;
        m.detectNearby();
        const nearest = m.nearest;
        m.interact();
        await new Promise((r) => setTimeout(r, 150));
        return {
          nearest,
          open: !document.getElementById('overlay-activity').hidden,
          title: document.getElementById('activityTitle').textContent,
          counter: document.getElementById('activityCounter').textContent,
          objective: document.querySelector('#activityBody .objective')?.textContent?.slice(0, 50) || '',
        };
      }, stationId);
      if (entered.nearest?.kind !== 'station' || entered.nearest.id !== stationId) {
        throw new Error(`could not stand at ${stationId}: ${JSON.stringify(entered.nearest)}`);
      }
      if (!entered.open) throw new Error('activity overlay did not open');
      if (!entered.objective) throw new Error('exercise shows no objective');

      const solved = await client.evaluate('window.__solveStation()');
      if (!solved.closed) throw new Error(`activity did not close (${solved.guard} iterations)`);
      if (!solved.solved.length) throw new Error('no exercise was answered');

      const after = await ev((id) => {
        const m = window.__ENGLISH_CLUB__.mission;
        return {
          completed: m.session.stationsCompleted.includes(id),
          score: m.session.score,
          summary: m.stationScores[id] || null,
          next: document.getElementById('hudPhase').textContent,
          routeDone: document.querySelectorAll('#routeBar .route-chip.is-done').length,
        };
      }, stationId);
      if (!after.completed) throw new Error(`${stationId} not marked complete`);
      if (after.summary && after.summary.total > 0 && after.summary.correct !== after.summary.total) {
        throw new Error(`${stationId} scored ${after.summary.correct}/${after.summary.total} on correct answers`);
      }
      return { title: entered.title, counter: entered.counter, solved: solved.solved.length, ...after };
    });
    if (stationId === 'vocabulary') await shot(`05-station-${stationId}.png`);
  }

  /* ============================================================ 7. FINAL + RESULTS */
  await step('final arena completes the mission and shows a report', async () => {
    const entered = await ev(async () => {
      const campus = await import('/src/world/campus.js');
      const m = window.__ENGLISH_CLUB__.mission;
      const station = campus.STATION_BY_ID.arena;
      m.player.x = station.entrance.x;
      m.player.y = station.entrance.y;
      m.detectNearby();
      m.interact();
      await new Promise((r) => setTimeout(r, 150));
      return {
        nearest: m.nearest,
        open: !document.getElementById('overlay-activity').hidden,
        isFinal: document.querySelector('#overlay-activity .activity-panel')?.classList.contains('is-final'),
        finishLabel: document.getElementById('activityFoot').textContent.trim(),
      };
    });
    if (entered.nearest?.kind !== 'station') throw new Error('arena not reachable');
    if (!entered.open) throw new Error('arena did not open');
    if (!entered.isFinal) throw new Error('final challenge is not flagged as final');

    await client.evaluate('window.__solveStation()');
    const done = await ev(async () => {
      await new Promise((r) => setTimeout(r, 250));
      const g = window.__ENGLISH_CLUB__;
      const store = g.store.get();
      return {
        screen: document.querySelector('#screen-results').classList.contains('is-active'),
        state: g.mission.state,
        grade: document.getElementById('resultGrade').textContent,
        percentShown: document.getElementById('resultScore').textContent + '/' + document.getElementById('resultMax').textContent,
        xp: document.getElementById('resultXp').textContent,
        correct: document.getElementById('resultCorrect').textContent,
        wrong: document.getElementById('resultWrong').textContent,
        skillRows: document.querySelectorAll('#skillReport .skill-row').length,
        recommendations: document.querySelectorAll('#recommendations li').length,
        badges: [...document.querySelectorAll('#sessionAchievements .badge')].map((b) => b.textContent.trim()),
        storedBest: store.best.A1,
        storedXp: store.xp,
        storedMissions: store.missions,
        achievements: Object.keys(store.achievements),
      };
    });
    if (!done.screen) throw new Error('results screen not shown');
    if (done.state !== 'ended') throw new Error(`mission state ${done.state}`);
    if (done.skillRows < 5) throw new Error(`expected 5 skill rows, got ${done.skillRows}`);
    if (done.recommendations < 1) throw new Error('no recommendations');
    if (done.storedBest !== 100) throw new Error(`best score not stored (${done.storedBest})`);
    if (!done.achievements.includes('first_mission')) throw new Error('first mission achievement missing');
    if (!done.badges.length) throw new Error('no badge shown on results');
    return done;
  });
  await shot('06-results.png');

  /* ================================================================ 8. PAUSE */
  await step('Escape pauses the mission and freezes the clock', async () => {
    const started = await ev(async () => {
      document.getElementById('replayBtn').click();
      await new Promise((r) => setTimeout(r, 350));
      return window.__ENGLISH_CLUB__.mission.state;
    });
    if (started !== 'playing') throw new Error(`replay state ${started}`);
    await key('rawKeyDown', 'Escape', 'Escape', 27);
    await key('keyUp', 'Escape', 'Escape', 27);
    await sleep(200);
    const before = await ev(() => ({
      state: window.__ENGLISH_CLUB__.mission.state,
      pauseOpen: !document.getElementById('overlay-pause').hidden,
      remaining: window.__ENGLISH_CLUB__.mission.timer.remainingSeconds(),
    }));
    if (!before.pauseOpen) throw new Error('pause overlay did not open');
    if (before.state !== 'paused') throw new Error(`state ${before.state}`);
    await sleep(700);
    const after = await ev(() => window.__ENGLISH_CLUB__.mission.timer.remainingSeconds());
    if (Math.abs(after - before.remaining) > 0.12) throw new Error('clock kept running while paused');
    await shot('07-pause.png');
    await ev(() => document.getElementById('resumeBtn').click());
    await sleep(150);
    const resumed = await ev(() => window.__ENGLISH_CLUB__.mission.state);
    if (resumed !== 'playing') throw new Error(`resume state ${resumed}`);
    return { frozenFor: 0.7, drift: +(after - before.remaining).toFixed(3) };
  });

  await step('mission progress panel opens with real station status', async () => {
    await ev(async () => {
      window.__ENGLISH_CLUB__.mission.pause();
      await new Promise((r) => setTimeout(r, 100));
      document.getElementById('progressBtn').click();
    });
    await sleep(150);
    const out = await ev(() => ({
      open: !document.getElementById('overlay-progress').hidden,
      title: document.getElementById('progressTitle').textContent,
      rows: document.querySelectorAll('#progressList .progress-item').length,
    }));
    if (!out.open) throw new Error('progress overlay did not open');
    if (out.rows < 8) throw new Error(`expected the full station list, got ${out.rows} rows`);
    await shot('08-progress.png');
    await ev(() => {
      document.querySelector('#overlay-progress [data-close-overlay]')?.click();
      window.__ENGLISH_CLUB__.mission.resume();
    });
    return out;
  });

  /* ============================================================== 9. PRACTICE */
  await step('practice mode works without a timer', async () => {
    const out = await ev(async () => {
      const g = window.__ENGLISH_CLUB__;
      g.mission.abandon();
      await new Promise((r) => setTimeout(r, 200));
      document.getElementById('resultsMenuBtn').click();
      await new Promise((r) => setTimeout(r, 120));
      document.getElementById('practiceBtn').click();
      await new Promise((r) => setTimeout(r, 120));
      const cards = document.querySelectorAll('#skillGrid .skill-card').length;
      document.querySelector('#skillGrid .skill-card').click();
      await new Promise((r) => setTimeout(r, 150));
      return {
        screen: document.querySelector('#screen-practice').classList.contains('is-active'),
        cards,
        activityOpen: !document.getElementById('overlay-activity').hidden,
        kicker: document.getElementById('activityKicker').textContent,
        timerStopped: !g.mission.timer || g.mission.timer.finished || !g.mission.timer.running,
      };
    });
    if (out.cards !== 5) throw new Error(`expected 5 skill cards, got ${out.cards}`);
    if (!out.activityOpen) throw new Error('practice activity did not open');
    if (!out.timerStopped) throw new Error('mission clock still running in practice');
    await shot('09-practice.png');
    await client.evaluate('window.__solveStation()');
    return out;
  });

  /* ============================================================== 10. SETTINGS */
  await step('settings persist and change the DOM', async () => {
    const out = await ev(async () => {
      const g = window.__ENGLISH_CLUB__;
      g.ui.closeAllOverlays();
      g.ui.showScreen('menu');
      document.getElementById('settingsBtn').click();
      await new Promise((r) => setTimeout(r, 120));
      const french = document.getElementById('frenchHints');
      const motion = document.getElementById('reduceMotion');
      const contrast = document.getElementById('highContrast');
      french.checked = true; french.dispatchEvent(new Event('input', { bubbles: true }));
      motion.checked = true; motion.dispatchEvent(new Event('input', { bubbles: true }));
      contrast.checked = true; contrast.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 80));
      return {
        open: !document.getElementById('overlay-settings').hidden,
        stored: g.store.getSettings(),
        reduceMotionClass: document.documentElement.classList.contains('reduce-motion'),
        contrastClass: document.documentElement.classList.contains('high-contrast'),
        persisted: JSON.parse(localStorage.getItem('ec.profile.v3')).settings,
      };
    });
    if (!out.open) throw new Error('settings overlay did not open');
    if (!out.stored.frenchHints || !out.stored.reduceMotion || !out.stored.highContrast) {
      throw new Error('settings not stored');
    }
    if (!out.reduceMotionClass || !out.contrastClass) throw new Error('accessibility classes not applied');
    if (!out.persisted.frenchHints) throw new Error('settings not written to localStorage');
    await shot('10-settings.png');

    const hint = await ev(async () => {
      const g = window.__ENGLISH_CLUB__;
      g.ui.closeAllOverlays();
      g.ui.showScreen('practice');
      g.ui.onPracticeSkill('vocabulary', 'A1');
      await new Promise((r) => setTimeout(r, 150));
      const hasFr = [...document.querySelectorAll('#activityBody .fr-hint, #activityBody p')]
        .some((n) => /=\s|livre|crayon|pomme|eau|maison/i.test(n.textContent));
      const anyFrench = Boolean(document.querySelector('#activityBody .fr-hint'));
      g.activities.close();
      g.ui.closeAllOverlays();
      return { anyFrench, hasFr };
    });
    return { ...out, frenchHintVisible: hint.anyFrench || hint.hasFr };
  });

  /* ========================================================== 11. TOUCH INPUT */
  await step('on-screen joystick and action button work', async () => {
    const setup = await ev(async () => {
      const g = window.__ENGLISH_CLUB__;
      g.store.setSetting('forceTouch', true);
      g.ui.applyA11yClasses();
      g.ui.closeAllOverlays();
      g.ui.showScreen('menu');
      await new Promise((r) => setTimeout(r, 80));
      document.getElementById('playBtn').click();
      await new Promise((r) => setTimeout(r, 80));
      document.getElementById('levelContinueBtn').click();
      await new Promise((r) => setTimeout(r, 80));
      document.getElementById('startMissionBtn').click();
      await new Promise((r) => setTimeout(r, 400));
      const joy = document.getElementById('joystick');
      const btn = document.getElementById('actionBtn');
      const jr = joy.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      return {
        state: g.mission.state,
        display: getComputedStyle(document.getElementById('touchControls')).display,
        joy: { cx: jr.left + jr.width / 2, cy: jr.top + jr.height / 2, size: Math.round(jr.width) },
        action: { cx: br.left + br.width / 2, cy: br.top + br.height / 2, h: Math.round(br.height) },
        start: { x: g.mission.player.x, y: g.mission.player.y },
      };
    });
    if (setup.state !== 'playing') throw new Error(`mission not running (${setup.state})`);
    if (setup.display === 'none') throw new Error('touch controls hidden despite forceTouch');
    if (setup.joy.size < 96) throw new Error(`joystick too small: ${setup.joy.size}px`);
    if (setup.action.h < 48) throw new Error(`action button too small: ${setup.action.h}px`);

    await client.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: setup.joy.cx, y: setup.joy.cy, button: 'left', clickCount: 1,
    });
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: setup.joy.cx + 30, y: setup.joy.cy - 12, button: 'left', buttons: 1,
    });
    await sleep(700);
    const mid = await ev(() => {
      const m = window.__ENGLISH_CLUB__.mission;
      return {
        x: m.player.x,
        y: m.player.y,
        knob: document.getElementById('joystickKnob').style.transform,
      };
    });
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: setup.joy.cx + 30, y: setup.joy.cy - 12, button: 'left', clickCount: 1,
    });
    await sleep(150);
    const moved = Math.hypot(mid.x - setup.start.x, mid.y - setup.start.y);
    if (moved < 0.3) throw new Error(`joystick did not move the player (${moved.toFixed(2)} tiles)`);
    if (!/translate\(-50%, -50%\) translate/.test(mid.knob)) throw new Error(`knob did not follow the finger: ${mid.knob}`);

    // now use the action button itself to enter a station
    await ev(async () => {
      const campus = await import('/src/world/campus.js');
      const m = window.__ENGLISH_CLUB__.mission;
      const station = campus.STATION_BY_ID.vocabulary;
      m.player.x = station.entrance.x;
      m.player.y = station.entrance.y;
      m.detectNearby();
      await new Promise((r) => setTimeout(r, 60));
    });
    await client.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: setup.action.cx, y: setup.action.cy, button: 'left', clickCount: 1,
    });
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: setup.action.cx, y: setup.action.cy, button: 'left', clickCount: 1,
    });
    await sleep(250);
    const opened = await ev(() => ({
      open: !document.getElementById('overlay-activity').hidden,
      title: document.getElementById('activityTitle').textContent,
    }));
    if (!opened.open) throw new Error('action button did not open the station');
    await ev(() => window.__ENGLISH_CLUB__.activities.close());
    return { joystick: setup.joy.size, action: setup.action.h, moved: +moved.toFixed(2), station: opened.title };
  });

  /* ======================================================= 12. CORRECTION PATH */
  await step('a wrong answer is corrected immediately, with the explanation', async () => {
    const out = await ev(async () => {
      const { getExercises } = await import('/src/content/index.js');
      const g = window.__ENGLISH_CLUB__;
      g.mission.pause();
      g.ui.closeOverlay('pause');
      const item = getExercises('grammar', 'A1').find((i) => i.type === 'choice');
      g.activities.open({
        stationId: 'test', title: 'Correction test', kicker: 'test', icon: '★',
        skill: 'grammar', items: [item], onAnswer: () => {}, onFinish: () => {},
      });
      await new Promise((r) => setTimeout(r, 80));
      const wrong = (item.answer + 1) % item.options.length;
      const buttons = [...document.querySelectorAll('#activityBody .option-btn')];
      buttons[wrong].click();
      await new Promise((r) => setTimeout(r, 60));
      const feedback = document.querySelector('#activityBody .feedback');
      const result = {
        itemId: item.id,
        wrongIndex: wrong,
        correctIndex: item.answer,
        feedbackClass: feedback?.className || '',
        heading: feedback?.querySelector('strong')?.textContent || '',
        explanation: feedback?.querySelector('.why')?.textContent || '',
        expected: feedback?.textContent?.includes('Model answer') || false,
        recorded: g.activities.answers[0]?.correct,
        correctOptionMarked: document.querySelectorAll('#activityBody .option-btn.is-correct').length,
        wrongOptionMarked: document.querySelectorAll('#activityBody .option-btn.is-wrong').length,
        disabled: [...document.querySelectorAll('#activityBody .option-btn')].every((b) => b.disabled),
      };
      g.activities.close();
      return result;
    });
    if (out.heading !== 'Not quite') throw new Error(`feedback heading "${out.heading}"`);
    if (!out.feedbackClass.includes('is-bad')) throw new Error('feedback not styled as an error');
    if (out.explanation.length < 10) throw new Error('explanation missing');
    if (out.recorded !== false) throw new Error('wrong answer not recorded as incorrect');
    if (out.correctOptionMarked !== 1 || out.wrongOptionMarked !== 1) throw new Error('correction highlight missing');
    if (!out.disabled) throw new Error('options still clickable after answering');
    return out;
  });

  await step('French help covers instructions and item glosses', async () => {
    const out = await ev(async () => {
      const { getExercises } = await import('/src/content/index.js');
      const g = window.__ENGLISH_CLUB__;
      const item = getExercises('vocabulary', 'A1').find((i) => i.fr && i.fr.trim());
      if (!item) throw new Error('no vocabulary item carries a French gloss');

      const solve = async () => {
        const body = document.getElementById('activityBody');
        if (item.type === 'choice') {
          body.querySelectorAll('.option-btn')[item.answer].click();
        } else if (item.type === 'match') {
          for (const pair of item.pairs) {
            [...body.querySelectorAll('.match-cell[data-term]')].find((c) => c.dataset.term === pair.term).click();
            [...body.querySelectorAll('.match-cell[data-icon]')].find((c) => c.dataset.icon === pair.icon).click();
          }
        } else {
          throw new Error(`cannot drive ${item.type} in this check`);
        }
        await new Promise((r) => setTimeout(r, 50));
      };

      const probe = async (french) => {
        g.store.setSetting('frenchHints', french);
        g.activities.open({
          stationId: 'test', title: 'Hint test', kicker: 'test', icon: '★',
          skill: 'vocabulary', items: [item], onAnswer: () => {}, onFinish: () => {},
        });
        await new Promise((r) => setTimeout(r, 60));
        const instructionFrShown = [...document.querySelectorAll('#activityBody p')]
          .some((p) => p.textContent.trim() === item.instructionFr && item.instructionFr);
        await solve();
        const hint = document.querySelector('#activityBody .fr-hint');
        const result = {
          hint: Boolean(hint && hint.offsetParent !== null && hint.textContent.trim()),
          hintText: hint?.textContent || '',
          instructionFrShown,
          feedback: Boolean(document.querySelector('#activityBody .feedback')),
        };
        g.activities.close();
        return result;
      };

      const off = await probe(false);
      const on = await probe(true);
      g.store.setSetting('frenchHints', true);
      return { itemId: item.id, fr: item.fr, instructionFr: item.instructionFr, off, on };
    });
    if (out.off.hint) throw new Error('French gloss shown while French help is disabled');
    if (out.off.instructionFrShown) throw new Error('French instruction shown while French help is disabled');
    if (!out.on.hint) throw new Error('French gloss missing while French help is enabled');
    if (!out.on.instructionFrShown) throw new Error('French instruction missing while French help is enabled');
    if (!out.on.feedback) throw new Error('feedback did not appear, so the gloss was never reached');
    if (out.on.hintText.trim() !== out.fr.trim()) throw new Error('gloss text does not match the content');
    return out;
  });

  await step('achievement hall lists every badge and the profile summary', async () => {
    const out = await ev(async () => {
      const g = window.__ENGLISH_CLUB__;
      g.ui.closeAllOverlays();
      g.ui.showScreen('menu');
      document.getElementById('achievementsBtn').click();
      await new Promise((r) => setTimeout(r, 120));
      return {
        active: document.querySelector('#screen-achievements').classList.contains('is-active'),
        cards: document.querySelectorAll('#achievementGrid .achievement-card').length,
        unlocked: document.querySelectorAll('#achievementGrid .achievement-card:not(.is-locked)').length,
        level: document.getElementById('achievementLevel').textContent,
        xp: document.getElementById('achievementXp').textContent,
        best: document.getElementById('bestScore').textContent,
        progressWidth: document.getElementById('levelProgressBar').style.width,
      };
    });
    if (!out.active) throw new Error('achievements screen not shown');
    if (out.cards !== 10) throw new Error(`expected 10 badges, got ${out.cards}`);
    if (out.unlocked < 5) throw new Error(`unlocked badges not displayed (${out.unlocked})`);
    await shot('13-achievements.png');
    return out;
  });

  await step('B1 mission keeps the same 9-graded-answer structure', async () => {
    const out = await ev(async () => {
      const g = window.__ENGLISH_CLUB__;
      g.mission.start('B1');
      await new Promise((r) => setTimeout(r, 300));
      const plan = Object.fromEntries(Object.entries(g.mission.plan.stations).map(([k, v]) => [k, v.length]));
      const levels = new Set(Object.values(g.mission.plan.stations).flat().map((i) => i.level));
      const hud = document.getElementById('hudLevel').textContent;
      g.mission.abandon();
      await new Promise((r) => setTimeout(r, 150));
      return { plan, levels: [...levels], hud };
    });
    const expected = { vocabulary: 3, grammar: 2, writing: 1, culture: 2, final: 2 };
    if (JSON.stringify(out.plan) !== JSON.stringify(expected)) throw new Error(`plan ${JSON.stringify(out.plan)}`);
    if ('listening' in out.plan || 'speaking' in out.plan) {
      throw new Error(`removed skills present in plan ${JSON.stringify(out.plan)}`);
    }
    if (out.levels.length !== 1 || out.levels[0] !== 'B1') throw new Error(`mixed levels: ${out.levels}`);
    return out;
  });

  /* =========================================================== 11. VIEWPORTS */
  const viewports = [
    [320, 568], [360, 640], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080],
  ];
  const viewportReports = [];
  for (const [w, h] of viewports) {
    await step(`responsive layout fits ${w}×${h}`, async () => {
      await client.viewport(w, h);
      const out = await ev(async () => {
        const g = window.__ENGLISH_CLUB__;
        g.ui.closeAllOverlays();
        g.ui.showScreen('menu');
        await new Promise((r) => setTimeout(r, 220));
        const doc = document.documentElement;
        const overflowX = doc.scrollWidth - window.innerWidth;
        const visibleButtons = [...document.querySelectorAll('#screen-menu button')]
          .filter((b) => b.offsetParent !== null);
        const small = visibleButtons.filter((b) => {
          const r = b.getBoundingClientRect();
          return r.height > 0 && r.height < 40;
        }).map((b) => `${b.id || b.textContent.trim().slice(0, 14)}:${Math.round(b.getBoundingClientRect().height)}`);
        const title = document.querySelector('#screen-menu h1')?.getBoundingClientRect();
        return {
          overflowX,
          menuTitleWidth: title ? Math.round(title.width) : 0,
          buttons: visibleButtons.length,
          smallTargets: small,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        };
      });
      viewportReports.push({ size: `${w}x${h}`, ...out });
      if (out.overflowX > 1) throw new Error(`horizontal overflow ${out.overflowX}px`);
      await shot(`11-viewport-${w}x${h}.png`);
      return out;
    });
  }

  /* ============================================================== 12. OFFLINE */
  await step('the game reloads with the network switched off', async () => {
    await client.viewport(1440, 900);
    const controlled = await ev(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false };
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await navigator.serviceWorker.ready;
      return {
        supported: true,
        registered: Boolean(reg),
        controller: Boolean(navigator.serviceWorker.controller),
      };
    });
    if (!controlled.supported) throw new Error('service workers unsupported');
    if (!controlled.registered) throw new Error('service worker not registered');
    if (!controlled.controller) throw new Error('service worker not controlling the page');

    await client.send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
    });
    client.resetLogs();
    await client.send('Page.reload', { ignoreCache: false });
    await sleep(4000);
    const offline = await ev(() => ({
      readyState: document.readyState,
      url: location.href,
      htmlLength: document.documentElement?.outerHTML?.length || 0,
      scripts: [...document.querySelectorAll('script')].map((n) => n.src || 'inline'),
      booted: document.body.classList.contains('is-booted'),
      global: Boolean(window.__ENGLISH_CLUB__),
      banner: !document.getElementById('offlineBanner').hidden,
      canStart: (() => {
        document.getElementById('bootBtn').click();
        return document.querySelector('#screen-menu').classList.contains('is-active');
      })(),
      exercises: window.__ENGLISH_CLUB__ ? Object.keys(window.__ENGLISH_CLUB__.store.get().best).length : 0,
    }));
    await shot('12-offline.png');
    await client.send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    });
    if (client.exceptions.length) throw new Error(`exceptions offline: ${client.exceptions[0]}`);
    const fatal = client.consoleErrors.filter((e) => !/Failed to load resource/i.test(e));
    if (fatal.length) throw new Error(`console errors offline: ${fatal.join(' | ')}`);
    if (!offline.booted || !offline.global) throw new Error(`game did not boot offline ${JSON.stringify(offline)} errors=${JSON.stringify(client.consoleErrors)} exceptions=${JSON.stringify(client.exceptions)}`);
    if (!offline.banner) throw new Error('offline banner not shown');
    if (!offline.canStart) throw new Error('menu unreachable offline');
    return { ...controlled, ...offline };
  });

  /* ====================================================== 13. EXHIBITION DEMO */
  await step('exhibition demo starts a clean A1 mission in one click', async () => {
    const out = await ev(async () => {
      const g = window.__ENGLISH_CLUB__;
      g.store.patch({ xp: 999, missions: 7, best: { A1: 88, A2: 77, B1: 66 } });
      document.getElementById('demoBtn').click();
      await new Promise((r) => setTimeout(r, 400));
      const profile = g.store.get();
      const result = {
        game: document.querySelector('#screen-game').classList.contains('is-active'),
        state: g.mission.state,
        level: g.mission.level,
        name: profile.name,
        xp: profile.xp,
        missions: profile.missions,
        bestA1: profile.best.A1,
        highContrast: document.documentElement.classList.contains('high-contrast'),
        routeChips: document.querySelectorAll('#routeBar .route-chip').length,
        answers: Object.values(g.mission.plan.stations).reduce((n, list) => n + list.length, 0),
        timerRunning: g.mission.timer.running,
      };
      g.mission.abandon();
      await new Promise((r) => setTimeout(r, 120));
      return result;
    });
    if (!out.game || out.state !== 'playing') throw new Error(`demo did not start: ${JSON.stringify(out)}`);
    if (out.level !== 'A1' || out.name !== 'Guest') throw new Error(`preset not applied: ${JSON.stringify(out)}`);
    if (out.xp !== 0 || out.missions !== 0 || out.bestA1 !== 0) throw new Error(`progress not reset: ${JSON.stringify(out)}`);
    if (!out.highContrast) throw new Error('readable preset not applied');
    if (out.routeChips !== 4 || out.answers < 9 || !out.timerRunning) throw new Error(`mission plan invalid: ${JSON.stringify(out)}`);
    return out;
  });
  await shot('13-exhibition-demo.png');

  /* ============================================================== 13. SUMMARY */
  log('\n--- CONSOLE ---');
  log('errors:', JSON.stringify(client.consoleErrors, null, 1));
  log('exceptions:', JSON.stringify(client.exceptions, null, 1));
  log('warnings:', JSON.stringify(client.consoleWarnings.slice(0, 8), null, 1));
} catch (error) {
  log('\nE2E ABORTED:', error.message);
} finally {
  const failed = results.filter((r) => !r.ok);
  log(`\n=== ${results.length - failed.length}/${results.length} steps passed ===`);
  for (const r of failed) log(`FAILED: ${r.name} — ${r.error}`);
  writeFileSync('/tmp/opencode/ec-shots/e2e-report.json', JSON.stringify({
    url: URL,
    passed: results.length - failed.length,
    total: results.length,
    results,
    consoleErrors: client?.consoleErrors || [],
    exceptions: client?.exceptions || [],
    warnings: client?.consoleWarnings || [],
  }, null, 2));
  try { await client?.close(); } catch { /* ignore */ }
  browser.proc.kill('SIGKILL');
  process.exitCode = failed.length ? 1 : 0;
}
