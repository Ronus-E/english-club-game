#!/usr/bin/env node
/**
 * Quick real-browser check: boot the quiz, reach the first question and verify
 * that the 15-question setup is intact. Full coverage lives in tests/e2e.mjs.
 *
 * Usage: node tools/smoke.mjs [url]
 */
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { launchChromium, listTargets, Client } from './cdp.mjs';

const URL = process.argv[2] || 'http://127.0.0.1:8080/';
const SHOTS = '/tmp/opencode/ec-shots';
const PORT = 9333;
const PROFILE = '/tmp/opencode/chrome-ec-smoke';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...args) => console.log(...args);

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });
const browser = await launchChromium({ port: PORT, userDataDir: PROFILE, width: 1366, height: 768 });

let client = null;
try {
  const targets = await listTargets(PORT);
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  client = await new Client(page.webSocketDebuggerUrl).connect();
  await client.init();
  await client.viewport(1366, 768);
  client.resetLogs();

  await client.goto(URL, { settleMs: 1000 });

  const boot = await client.evaluate(`(() => {
    const g = window.__ENGLISH_CLUB__;
    const counts = g ? g.countExercises() : {};
    const total = Object.values(counts).reduce(
      (n, byLevel) => n + Object.values(byLevel).reduce((a, b) => a + b, 0), 0,
    );
    return {
      title: document.title,
      booted: document.body.classList.contains('is-booted'),
      hasGlobal: Boolean(g),
      splash: document.getElementById('screen-splash')?.classList.contains('is-active'),
      exercises: total,
      campus: ['gameCanvas', 'joystick', 'timerValue', 'screen-game', 'screen-intro']
        .filter((id) => document.getElementById(id)),
    };
  })()`);
  log('BOOT', JSON.stringify(boot, null, 2));
  if (!boot.booted || !boot.hasGlobal || !boot.splash) throw new Error('quiz did not boot');
  if (boot.exercises !== 150) throw new Error(`expected 150 exercises, got ${boot.exercises}`);
  if (boot.campus.length) throw new Error(`campus elements remain: ${boot.campus.join(', ')}`);
  await client.screenshot(join(SHOTS, '01-smoke-splash.png'));

  await client.evaluate(`document.getElementById('bootBtn').click()`);
  await sleep(200);
  await client.evaluate(`document.getElementById('playBtn').click()`);
  await sleep(200);
  const level = await client.evaluate(`(() => {
    document.querySelector('#levelGrid .level-card[data-level="A1"]').click();
    const input = document.getElementById('playerNameInput');
    input.value = 'Smoke';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('levelContinueBtn').click();
    return true;
  })()`);
  await sleep(400);

  const quiz = await client.evaluate(`(() => {
    const g = window.__ENGLISH_CLUB__;
    const items = g.activities.config.items;
    const counts = {};
    for (const item of items) counts[item.skill] = (counts[item.skill] || 0) + 1;
    return {
      screen: document.getElementById('screen-quiz')?.classList.contains('is-active'),
      overlay: !document.getElementById('overlay-activity')?.hidden,
      level: g.quiz.level,
      answers: g.quiz.session?.answers.length,
      total: items.length,
      counts,
      counter: document.getElementById('activityCounter')?.textContent,
      status: document.getElementById('quizStatus')?.textContent,
    };
  })()`);
  log('QUIZ', JSON.stringify(quiz, null, 2));
  await client.screenshot(join(SHOTS, '02-smoke-question.png'));

  if (!quiz.screen || !quiz.overlay) throw new Error('question panel did not open');
  if (quiz.level !== 'A1' || quiz.answers !== 0) throw new Error('quiz session is wrong');
  if (quiz.total !== 15 || Object.values(quiz.counts).some((n) => n !== 3)) {
    throw new Error('quiz is not 3 questions per skill');
  }
  if (!/Question 1 of 15/.test(quiz.status || '')) throw new Error('quiz status is wrong');

  const errors = client.consoleErrors;
  const exceptions = client.exceptions;
  log('CONSOLE_ERRORS', JSON.stringify(errors, null, 2));
  log('EXCEPTIONS', JSON.stringify(exceptions, null, 2));
  log('CONSOLE_WARNINGS', JSON.stringify(client.consoleWarnings.slice(0, 10), null, 2));
  if (errors.length || exceptions.length) throw new Error('browser reported errors');
  log('SMOKE OK');
} catch (error) {
  log('SMOKE FAILED:', error.message);
  process.exitCode = 1;
} finally {
  try { await client?.close(); } catch { /* ignore */ }
  browser.proc.kill('SIGKILL');
}
