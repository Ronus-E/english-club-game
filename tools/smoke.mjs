#!/usr/bin/env node
/**
 * Quick real-browser check: boot the quiz, open the stage grid, start stage 1
 * and verify the progressive stage setup. Full coverage lives in tests/e2e.mjs.
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
      signature: document.body.textContent.includes('Developed by RONUS Eldo'),
      lang: document.documentElement.lang,
      translate: document.documentElement.getAttribute('translate'),
      googleNotranslate: Boolean(document.querySelector('meta[name="google"][content="notranslate"]')),
      campus: ['gameCanvas', 'joystick', 'timerValue', 'screen-game', 'screen-intro']
        .filter((id) => document.getElementById(id)),
      newControls: [
        'progressBtn', 'dailyBtn', 'reviewMistakesBtn', 'practiceTag', 'answerReview',
        'updateBanner', 'largeText', 'weeklyGoal', 'exportBtn', 'importBtn',
      ].filter((id) => !document.getElementById(id)),
      weeklyOptions: document.getElementById('weeklyGoal')?.options.length || 0,
    };
  })()`);
  log('BOOT', JSON.stringify(boot, null, 2));
  log('BOOT_ERRORS', JSON.stringify({
    errors: client.consoleErrors,
    exceptions: client.exceptions,
    warnings: client.consoleWarnings.slice(0, 10),
  }, null, 2));
  if (!boot.booted || !boot.hasGlobal || !boot.splash) throw new Error('quiz did not boot');
  if (boot.exercises !== 210) throw new Error(`expected 210 exercises, got ${boot.exercises}`);
  if (boot.campus.length) throw new Error(`campus elements remain: ${boot.campus.join(', ')}`);
  if (!boot.signature) throw new Error('developer signature is missing');
  if (boot.lang !== 'en' || boot.translate !== 'no' || !boot.googleNotranslate) {
    throw new Error(`page language is not locked to English: ${JSON.stringify({ lang: boot.lang, translate: boot.translate, googleNotranslate: boot.googleNotranslate })}`);
  }
  if (boot.newControls.length) throw new Error(`new controls missing: ${boot.newControls.join(', ')}`);
  if (boot.weeklyOptions !== 14) throw new Error(`weekly goal options: ${boot.weeklyOptions}`);
  await client.screenshot(join(SHOTS, '01-smoke-splash.png'));

  await client.evaluate(`document.getElementById('bootBtn').click()`);
  await sleep(200);
  const startWelcome = await client.evaluate(`!document.getElementById('overlay-stage').hidden`);
  if (startWelcome) throw new Error('START must not open a welcome message');
  await client.evaluate(`document.getElementById('playBtn').click()`);
  await sleep(250);

  const stages = await client.evaluate(`(() => {
    const cards = [...document.querySelectorAll('#stageGrid .stage-card')];
    return {
      screen: document.getElementById('screen-stages')?.classList.contains('is-active'),
      cards: cards.length,
      locked: cards.filter((card) => card.disabled).length,
      current: cards.filter((card) => card.classList.contains('is-current')).map((card) => card.dataset.stage),
      sizes: cards.map((card) => card.querySelector('.stage-size')?.textContent),
    };
  })()`);
  log('STAGES', JSON.stringify(stages, null, 2));
  if (!stages.screen || stages.cards !== 10) throw new Error('stage grid did not open');
  if (stages.locked !== 9 || stages.current.join(',') !== '1') throw new Error('stage locks are wrong');
  if (stages.sizes[0] !== '5 questions' || stages.sizes[9] !== '9 questions') {
    throw new Error(`stage sizes are wrong: ${stages.sizes.join(', ')}`);
  }
  await client.screenshot(join(SHOTS, '02-smoke-stages.png'));

  await client.evaluate(`document.querySelector('#stageGrid .stage-card[data-stage="1"]').click()`);
  await sleep(250);

  const welcome = await client.evaluate(`(() => ({
    open: !document.getElementById('overlay-stage')?.hidden,
    title: document.getElementById('stageWelcomeTitle')?.textContent,
    kicker: document.getElementById('stageWelcomeKicker')?.textContent,
    lead: document.getElementById('stageWelcomeLead')?.textContent,
  }))()`);
  log('WELCOME', JSON.stringify(welcome, null, 2));
  if (!welcome.open || !/Welcome to stage 1/.test(welcome.title || '')) {
    throw new Error('stage welcome message did not open');
  }
  if (!/Stage 1 of 10/.test(welcome.kicker || '') || !/5 questions/.test(welcome.lead || '')) {
    throw new Error(`stage welcome content is wrong: ${JSON.stringify(welcome)}`);
  }

  await client.evaluate(`document.getElementById('stageContinueBtn').click()`);
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
      stage: g.quiz.stage,
      answers: g.quiz.session?.answers.length,
      total: items.length,
      counts,
      counter: document.getElementById('activityCounter')?.textContent,
      status: document.getElementById('quizStatus')?.textContent,
      kicker: document.getElementById('quizKicker')?.textContent,
      silent: g.activities.config?.silent,
      noQuit: g.activities.config?.noQuit,
      quitHidden: document.getElementById('activityQuit')?.hidden,
    };
  })()`);
  log('QUIZ', JSON.stringify(quiz, null, 2));
  await client.screenshot(join(SHOTS, '03-smoke-question.png'));

  if (!quiz.screen || !quiz.overlay) throw new Error('question panel did not open');
  if (quiz.level !== 'A1' || quiz.stage !== 1 || quiz.answers !== 0) throw new Error('quiz session is wrong');
  if (quiz.total !== 5 || Object.values(quiz.counts).some((n) => n !== 1) || Object.keys(quiz.counts).length !== 5) {
    throw new Error('stage 1 is not five questions across five skills');
  }
  if (!/Question 1 of 5/.test(quiz.status || '')) throw new Error('quiz status is wrong');
  if (!/Stage 1/.test(quiz.kicker || '')) throw new Error('quiz kicker is wrong');
  if (quiz.silent !== true || quiz.noQuit !== true || quiz.quitHidden !== true) {
    throw new Error(`quiz must be silent and locked: ${JSON.stringify(quiz)}`);
  }

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
