/**
 * End-to-end test in real Chromium, driven over CDP (no Playwright).
 * Covers the quiz-only product: boot, navigation, every exercise type,
 * immediate correction, results, practice, placement, settings, achievements,
 * responsive layout and offline reload.
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
      throw new Error(`page did not load (${health.title || 'no title'}, ${health.htmlLength} bytes)`);
    }
    const boot = await ev(() => ({
      booted: document.body.classList.contains('is-booted'),
      global: Boolean(window.__ENGLISH_CLUB__),
      splash: document.getElementById('screen-splash').classList.contains('is-active'),
      title: document.title,
      displayFont: getComputedStyle(document.getElementById('mainMenu')).fontFamily,
      campus: ['gameCanvas', 'joystick', 'timer', 'hud', 'screen-game', 'screen-intro']
        .filter((id) => document.getElementById(id)),
      frenchOverlay: Boolean(document.getElementById('overlay-dialogue')),
      exerciseCount: window.__ENGLISH_CLUB__.countExercises(),
    }));
    if (client.consoleErrors.length) throw new Error(`console errors: ${client.consoleErrors.join(' | ')}`);
    if (client.exceptions.length) throw new Error(`exceptions: ${client.exceptions.join(' | ')}`);
    if (!boot.booted || !boot.global || !boot.splash) throw new Error(`boot failed: ${JSON.stringify(boot)}`);
    if (!/serif|Georgia/i.test(boot.displayFont)) throw new Error(`display font missing: ${boot.displayFont}`);
    if (boot.campus.length) throw new Error(`campus elements remain: ${boot.campus.join(', ')}`);
    if (boot.frenchOverlay) throw new Error('dialogue overlay remains');
    const total = Object.values(boot.exerciseCount).reduce(
      (n, byLevel) => n + Object.values(byLevel).reduce((a, b) => a + b, 0), 0,
    );
    if (total !== 150) throw new Error(`expected 150 exercises, got ${total}`);
    return { title: boot.title, font: boot.displayFont, exercises: total };
  });
  await shot('01-boot.png');

  // Shared in-page solver: correct and wrong answers for all four exercise types.
  await ev(() => {
    const wordTokens = (text) => text
      .replace(/[.!?]+$/, '')
      .split(/\s+/)
      .map((word) => word.replace(/[.,!?;:]+$/, ''));
    window.__E2E__ = {
      correct(item, ar) {
        if (item.type === 'choice') ar.optionButtons[item.answer].click();
        else if (item.type === 'match') {
          for (const pair of item.pairs) {
            ar.selectWord(pair.term, ar.matchWordCells.find((c) => c.dataset.term === pair.term));
            ar.selectPicture(pair.icon, ar.matchPicCells.find((c) => c.dataset.icon === pair.icon));
          }
        } else if (item.type === 'order') {
          ar.orderPicked = wordTokens(item.answerText);
          ar.submitOrder();
        } else {
          ar.shortInput.value = item.accepted[0];
          ar.submitShort();
        }
      },
      wrong(item, ar) {
        if (item.type === 'choice') ar.optionButtons[(item.answer + 1) % item.options.length].click();
        else if (item.type === 'match') {
          item.pairs.forEach((pair, index) => {
            const wrongIcon = item.pairs[(index + 1) % item.pairs.length].icon;
            ar.selectWord(pair.term, ar.matchWordCells.find((c) => c.dataset.term === pair.term));
            ar.selectPicture(wrongIcon, ar.matchPicCells.find((c) => c.dataset.icon === wrongIcon));
          });
        } else if (item.type === 'order') {
          ar.orderPicked = wordTokens(item.answerText).reverse();
          ar.submitOrder();
        } else {
          ar.shortInput.value = 'definitely wrong answer';
          ar.submitShort();
        }
      },
    };
  });

  /* ======================================================= 2. NAVIGATION */
  await step('splash → menu → level selection with real clicks', async () => {
    await ev(() => document.getElementById('bootBtn').click());
    await sleep(200);
    const menu = await ev(() => ({
      menu: document.getElementById('screen-menu').classList.contains('is-active'),
      title: document.getElementById('mainMenu').textContent.trim(),
      buttons: document.querySelectorAll('#screen-menu button').length,
    }));
    if (!menu.menu) throw new Error('menu not shown');
    if (!/QUIZ/i.test(menu.title)) throw new Error(`wrong title: ${menu.title}`);
    await ev(() => document.getElementById('playBtn').click());
    await sleep(200);
    const level = await ev(() => ({
      level: document.getElementById('screen-level').classList.contains('is-active'),
      cards: document.querySelectorAll('#levelGrid .level-card').length,
      levels: [...document.querySelectorAll('#levelGrid .level-card')].map((c) => c.dataset.level),
    }));
    if (!level.level || level.cards !== 3) throw new Error(`level screen invalid: ${JSON.stringify(level)}`);
    if (level.levels.join(',') !== 'A1,A2,B1') throw new Error(`wrong levels: ${level.levels}`);
    return { menu: menu.title, levels: level.levels };
  });
  await shot('02-levels.png');

  /* ======================================================== 3. STAGE PICK */
  await step('choosing A2 opens ten progressive stages with only stage 1 unlocked', async () => {
    const out = await ev(async () => {
      document.querySelector('#levelGrid .level-card[data-level="A2"]').click();
      const input = document.getElementById('playerNameInput');
      input.value = 'Tester';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('levelContinueBtn').click();
      await new Promise((r) => setTimeout(r, 250));
      const cards = [...document.querySelectorAll('#stageGrid .stage-card')];
      return {
        screen: document.getElementById('screen-stages').classList.contains('is-active'),
        title: document.getElementById('stagesTitle').textContent,
        lead: document.getElementById('stagesLead').textContent,
        cards: cards.length,
        stages: cards.map((card) => Number(card.dataset.stage)),
        sizes: cards.map((card) => card.querySelector('.stage-size').textContent),
        locked: cards.filter((card) => card.disabled).length,
        current: cards.filter((card) => card.classList.contains('is-current')).map((card) => Number(card.dataset.stage)),
        level: window.__ENGLISH_CLUB__.store.get().level,
        name: window.__ENGLISH_CLUB__.store.get().name,
      };
    });
    if (!out.screen) throw new Error(`stage screen not shown: ${JSON.stringify(out)}`);
    if (out.cards !== 10 || out.stages.join(',') !== '1,2,3,4,5,6,7,8,9,10') {
      throw new Error(`stage grid invalid: ${JSON.stringify(out)}`);
    }
    if (out.locked !== 9 || out.current.join(',') !== '1') {
      throw new Error(`stage locks invalid: ${JSON.stringify(out)}`);
    }
    if (!/10 quiz stages/.test(out.title) || !/Level A2/.test(out.lead) || out.level !== 'A2' || out.name !== 'Tester') {
      throw new Error(`wrong level or name: ${JSON.stringify(out)}`);
    }
    return out;
  });
  await shot('03-stages.png');

  /* ============================================================= 4. QUIZ */
  await step('stage 1 starts a five-question quiz across five skills', async () => {
    const out = await ev(async () => {
      document.querySelector('#stageGrid .stage-card[data-stage="1"]').click();
      await new Promise((r) => setTimeout(r, 300));
      const g = window.__ENGLISH_CLUB__;
      const items = g.quiz.session ? g.activities.config.items : [];
      const counts = {};
      for (const item of items) counts[item.skill] = (counts[item.skill] || 0) + 1;
      return {
        screen: document.getElementById('screen-quiz').classList.contains('is-active'),
        overlay: !document.getElementById('overlay-activity').hidden,
        level: g.quiz.level,
        stage: g.quiz.stage,
        total: items.length,
        counts,
        counter: document.getElementById('activityCounter').textContent,
        pips: document.querySelectorAll('#quizPips .skill-pip').length,
        status: document.getElementById('quizStatus').textContent,
        kicker: document.getElementById('quizKicker').textContent,
      };
    });
    if (!out.screen || !out.overlay) throw new Error(`quiz did not start: ${JSON.stringify(out)}`);
    if (out.level !== 'A2' || out.stage !== 1) throw new Error(`wrong level or stage: ${JSON.stringify(out)}`);
    if (out.total !== 5) throw new Error(`expected 5 questions: ${JSON.stringify(out)}`);
    if (Object.values(out.counts).some((n) => n !== 1) || Object.keys(out.counts).length !== 5) {
      throw new Error(`wrong skill mix: ${JSON.stringify(out.counts)}`);
    }
    if (out.pips !== 5 || !/1 of 5/.test(out.status) || !/Stage 1/.test(out.kicker)) {
      throw new Error(`quiz UI invalid: ${JSON.stringify(out)}`);
    }
    return out;
  });
  await shot('04-question.png');

  await step('an answer stays neutral during the quiz', async () => {
    const out = await ev(async () => {
      const g = window.__ENGLISH_CLUB__;
      const ar = g.activities;
      const item = ar.item;
      window.__E2E__.correct(item, ar);
      await new Promise((r) => setTimeout(r, 100));
      return {
        type: item.type,
        feedback: document.querySelector('#activityBody .feedback')?.className || '',
        feedbackText: document.querySelector('#activityBody .feedback')?.textContent || '',
        leaks: document.querySelectorAll('#activityBody .is-good, #activityBody .is-bad, #activityBody .why').length,
        session: g.quiz.session.answers.length,
        status: document.getElementById('quizStatus').textContent,
        continueBtn: [...document.querySelectorAll('#activityFoot button')].map((b) => b.textContent.trim()),
      };
    });
    if (!/is-neutral/.test(out.feedback)) throw new Error(`feedback is not neutral: ${JSON.stringify(out)}`);
    if (!/Answer recorded/.test(out.feedbackText)) throw new Error(`missing neutral message: ${JSON.stringify(out)}`);
    if (out.leaks !== 0) throw new Error(`correction leaked during quiz: ${JSON.stringify(out)}`);
    if (out.session !== 1) throw new Error(`answer not recorded: ${JSON.stringify(out)}`);
    if (!/2 of 5/.test(out.status)) throw new Error(`quiz counter not updated: ${out.status}`);
    return out;
  });

  await step('a wrong answer is recorded without revealing the correction', async () => {
    const out = await ev(async () => {
      const g = window.__ENGLISH_CLUB__;
      const ar = g.activities;
      ar.advance();
      await new Promise((r) => setTimeout(r, 80));
      const item = ar.item;
      window.__E2E__.wrong(item, ar);
      await new Promise((r) => setTimeout(r, 100));
      return {
        type: item.type,
        feedback: document.querySelector('#activityBody .feedback')?.className || '',
        leaks: document.querySelectorAll('#activityBody .is-good, #activityBody .is-bad, #activityBody .why').length,
        recorded: g.quiz.session.answers.at(-1)?.correct,
      };
    });
    if (!/is-neutral/.test(out.feedback)) throw new Error(`feedback is not neutral: ${JSON.stringify(out)}`);
    if (out.leaks !== 0) throw new Error(`correction leaked during quiz: ${JSON.stringify(out)}`);
    if (out.recorded !== false) throw new Error(`wrong answer not recorded as wrong: ${JSON.stringify(out)}`);
    return out;
  });

  await step('finishing the five questions shows a complete quiz report', async () => {
    const out = await ev(async () => {
      const g = window.__ENGLISH_CLUB__;
      const ar = g.activities;
      let guard = 0;
      while (g.quiz.session && guard++ < 25) {
        const item = ar.item;
        if (!ar.answered) window.__E2E__.correct(item, ar);
        ar.advance();
        await new Promise((r) => setTimeout(r, 30));
      }
      const stage = g.store.stageState('A2');
      return {
        results: document.getElementById('screen-results').classList.contains('is-active'),
        score: document.getElementById('resultScore').textContent,
        max: document.getElementById('resultMax').textContent,
        grade: document.getElementById('resultGrade').textContent,
        correct: document.getElementById('resultCorrect').textContent,
        wrong: document.getElementById('resultWrong').textContent,
        xp: document.getElementById('resultXp').textContent,
        subtitle: document.getElementById('resultsSubtitle').textContent,
        skills: document.querySelectorAll('#skillReport .skill-row').length,
        recs: document.querySelectorAll('#recommendations li').length,
        badges: document.querySelectorAll('#sessionAchievements .badge').length,
        reviewItems: document.querySelectorAll('#answerReview .review-item').length,
        reviewCorrect: document.querySelectorAll('#answerReview .review-item.is-correct').length,
        reviewWrong: document.querySelectorAll('#answerReview .review-item.is-wrong').length,
        reviewCorrections: [...document.querySelectorAll('#answerReview .review-line.is-fix')]
          .filter((p) => p.textContent.includes('Correction:')).length,
        reviewExplanations: document.querySelectorAll('#answerReview .micro').length,
        signature: document.body.textContent.includes('Developed by RONUS Eldo')
          && document.body.textContent.includes('Game Develloper : Ronus Eldo'),
        missions: g.store.get().missions,
        best: g.store.get().best.A2,
        stageUnlocked: stage.unlocked,
        stageBest: stage.best[1],
        achievements: Object.keys(g.store.get().achievements),
      };
    });
    if (!out.results) throw new Error(`results not shown: ${JSON.stringify(out)}`);
    if (out.score !== '40' || out.max !== '50') throw new Error(`wrong score: ${JSON.stringify(out)}`);
    if (out.grade !== 'A') throw new Error(`wrong grade: ${out.grade}`);
    if (out.correct !== '4' || out.wrong !== '1') throw new Error(`wrong counts: ${JSON.stringify(out)}`);
    if (out.skills !== 5 || out.recs < 1 || out.badges < 1) throw new Error(`incomplete report: ${JSON.stringify(out)}`);
    if (out.reviewItems !== 5 || out.reviewCorrect !== 4 || out.reviewWrong !== 1) {
      throw new Error(`final dashboard incomplete: ${JSON.stringify(out)}`);
    }
    if (out.reviewCorrections !== 1 || out.reviewExplanations < 5 || !out.signature) {
      throw new Error(`dashboard corrections or signatures missing: ${JSON.stringify(out)}`);
    }
    if (!/Stage 1/.test(out.subtitle)) throw new Error(`stage missing from report: ${out.subtitle}`);
    if (out.missions !== 1 || out.best !== 80) throw new Error(`profile not updated: ${JSON.stringify(out)}`);
    if (out.stageUnlocked !== 2 || out.stageBest !== 80) throw new Error(`stage progress not saved: ${JSON.stringify(out)}`);
    if (!out.achievements.includes('first_mission')) throw new Error('first quiz badge missing');
    return out;
  });
  await shot('05-results.png');

  /* ====================================================== 5. REPLAY/QUIT */
  await step('replay restarts the same stage as a fresh locked quiz', async () => {
    const out = await ev(async () => {
      document.getElementById('replayBtn').click();
      await new Promise((r) => setTimeout(r, 250));
      const g = window.__ENGLISH_CLUB__;
      const quit = document.getElementById('activityQuit');
      const reopened = {
        active: g.quiz.isActive,
        level: g.quiz.level,
        stage: g.quiz.stage,
        total: g.activities.config.items.length,
        answers: g.quiz.session.answers.length,
        silent: g.activities.config.silent,
        noQuit: g.activities.config.noQuit,
        quitHidden: quit.hidden,
        kicker: document.getElementById('quizKicker').textContent,
      };
      quit.click();
      await new Promise((r) => setTimeout(r, 150));
      const stillOpen = {
        active: g.quiz.isActive,
        overlay: !document.getElementById('overlay-activity').hidden,
      };
      g.quiz.abandon();
      await new Promise((r) => setTimeout(r, 150));
      return {
        reopened,
        stillOpen,
        menu: document.getElementById('screen-menu').classList.contains('is-active'),
        active: g.quiz.isActive,
        missions: g.store.get().missions,
      };
    });
    if (!out.reopened.active || out.reopened.level !== 'A2' || out.reopened.stage !== 1 || out.reopened.answers !== 0) {
      throw new Error(`replay failed: ${JSON.stringify(out)}`);
    }
    if (out.reopened.total !== 5 || !/Stage 1/.test(out.reopened.kicker)) {
      throw new Error(`replay used the wrong stage: ${JSON.stringify(out)}`);
    }
    if (out.reopened.silent !== true || out.reopened.noQuit !== true || out.reopened.quitHidden !== true) {
      throw new Error(`replay is not locked: ${JSON.stringify(out)}`);
    }
    if (!out.stillOpen.active || !out.stillOpen.overlay || out.active || !out.menu) {
      throw new Error(`early quit should be blocked: ${JSON.stringify(out)}`);
    }
    if (out.missions !== 1) throw new Error('a left quiz was saved');
    return out;
  });
  await shot('06-replay.png');

  await step('the stage grid shows stage 1 cleared and stage 2 unlocked', async () => {
    const out = await ev(async () => {
      document.getElementById('playBtn').click();
      await new Promise((r) => setTimeout(r, 150));
      document.getElementById('levelContinueBtn').click();
      await new Promise((r) => setTimeout(r, 200));
      const cards = [...document.querySelectorAll('#stageGrid .stage-card')];
      const first = cards.find((card) => card.dataset.stage === '1');
      const second = cards.find((card) => card.dataset.stage === '2');
      return {
        screen: document.getElementById('screen-stages').classList.contains('is-active'),
        locked: cards.filter((card) => card.disabled).length,
        firstCleared: first.classList.contains('is-cleared'),
        firstBest: first.querySelector('.stage-meta').textContent,
        secondEnabled: !second.disabled,
        secondCurrent: second.classList.contains('is-current'),
      };
    });
    if (!out.screen || out.locked !== 8) throw new Error(`stage grid did not unlock: ${JSON.stringify(out)}`);
    if (!out.firstCleared || !/80%/.test(out.firstBest)) {
      throw new Error(`cleared stage not marked: ${JSON.stringify(out)}`);
    }
    if (!out.secondEnabled || !out.secondCurrent) {
      throw new Error(`stage 2 is not the current unlocked stage: ${JSON.stringify(out)}`);
    }
    return out;
  });

  /* ========================================================= 6. PRACTICE */
  await step('free practice opens ten exercises and can be left safely', async () => {
    await ev(() => document.getElementById('practiceBtn').click());
    await sleep(200);
    const out = await ev(async () => {
      const g = window.__ENGLISH_CLUB__;
      document.querySelector('#skillGrid .skill-card[data-skill="grammar"]').click();
      await new Promise((r) => setTimeout(r, 250));
      const open = { items: g.activities.config.items.length, title: document.getElementById('activityTitle').textContent };
      document.getElementById('activityQuit').click();
      await new Promise((r) => setTimeout(r, 150));
      return { open, back: document.getElementById('screen-practice').classList.contains('is-active') };
    });
    if (out.open.items !== 10) throw new Error(`practice set wrong: ${JSON.stringify(out)}`);
    if (!out.back) throw new Error('practice did not return to the practice screen');
    return out;
  });

  await step('revision by topic opens a filtered offline exercise set', async () => {
    const out = await ev(async () => {
      const select = document.getElementById('practiceTag');
      select.selectedIndex = 1;
      const chosen = select.value;
      document.getElementById('practiceTagBtn').click();
      await new Promise((r) => setTimeout(r, 200));
      const g = window.__ENGLISH_CLUB__;
      const open = {
        title: document.getElementById('activityTitle').textContent,
        count: g.activities.config?.items.length || 0,
        chosen,
        options: select.options.length,
      };
      document.getElementById('activityQuit').click();
      await new Promise((r) => setTimeout(r, 120));
      return { open, back: document.getElementById('screen-practice').classList.contains('is-active') };
    });
    if (out.open.options < 2 || !out.open.chosen) throw new Error(`topic list empty: ${JSON.stringify(out)}`);
    if (out.open.count < 1 || !/revision/i.test(out.open.title)) throw new Error(`topic revision failed: ${JSON.stringify(out)}`);
    if (!out.back) throw new Error('topic revision did not return to practice');
    return out;
  });

  await step('placement check suggests a level and returns to level selection', async () => {
    await ev(() => document.getElementById('placementBtn').click());
    await sleep(200);
    const out = await ev(async () => {
      const g = window.__ENGLISH_CLUB__;
      const count = g.activities.config.items.length;
      document.getElementById('activityQuit').click();
      await new Promise((r) => setTimeout(r, 150));
      return {
        count,
        level: document.getElementById('screen-level').classList.contains('is-active'),
      };
    });
    if (out.count !== 6 || !out.level) throw new Error(`placement failed: ${JSON.stringify(out)}`);
    return out;
  });

  /* ======================================================== 7. SETTINGS */
  await step('settings change the DOM, persist and can be reset', async () => {
    await ev(() => document.querySelector('[data-back="menu"]').click());
    await sleep(150);
    await ev(() => document.getElementById('settingsBtn').click());
    await sleep(150);
    const out = await ev(async () => {
      const box = document.getElementById('highContrast');
      box.checked = true;
      box.dispatchEvent(new Event('input', { bubbles: true }));
      const large = document.getElementById('largeText');
      large.checked = true;
      large.dispatchEvent(new Event('input', { bubbles: true }));
      const goal = document.getElementById('weeklyGoal');
      goal.value = '7';
      goal.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 80));
      const saved = JSON.parse(localStorage.getItem('ec.profile.v3')).settings;
      document.querySelector('#overlay-settings [data-close-overlay]').click();
      return {
        applied: document.documentElement.classList.contains('high-contrast'),
        large: document.documentElement.classList.contains('large-text'),
        goalOut: document.getElementById('weeklyGoalOut').textContent,
        saved: { highContrast: saved.highContrast, largeText: saved.largeText, weeklyGoal: saved.weeklyGoal },
        closed: document.getElementById('overlay-settings').hidden,
      };
    });
    if (!out.applied || !out.large || !out.closed) throw new Error(`settings failed: ${JSON.stringify(out)}`);
    if (out.goalOut !== '7' || out.saved.weeklyGoal !== 7 || !out.saved.largeText) {
      throw new Error(`new settings failed: ${JSON.stringify(out)}`);
    }
    return out;
  });

  await step('progress dashboard and daily challenge are reachable', async () => {
    await ev(() => document.getElementById('progressBtn').click());
    await sleep(150);
    const progress = await ev(() => ({
      screen: document.getElementById('screen-progress').classList.contains('is-active'),
      cards: document.querySelectorAll('#progressContent .progress-card').length,
      stages: [...document.querySelectorAll('#progressContent .progress-card')]
        .map((card) => card.textContent).filter((text) => /Quiz stages/.test(text)).length,
      signature: document.body.textContent.includes('Developed by RONUS Eldo'),
    }));
    await ev(() => document.querySelector('#screen-progress [data-back="menu"]').click());
    await sleep(120);
    await ev(() => document.getElementById('dailyBtn').click());
    await sleep(200);
    const daily = await ev(() => {
      const g = window.__ENGLISH_CLUB__;
      const out = {
        active: g.quiz.isActive,
        stage: g.quiz.stage,
        silent: g.activities.config?.silent,
        noQuit: g.activities.config?.noQuit,
        kicker: document.getElementById('quizKicker').textContent,
        count: g.activities.config?.items.length || 0,
      };
      g.quiz.abandon();
      return out;
    });
    await sleep(120);
    if (progress.screen !== true || progress.cards !== 5 || progress.stages !== 1 || !progress.signature) {
      throw new Error(`progress dashboard failed: ${JSON.stringify(progress)}`);
    }
    if (!daily.active || daily.stage !== 2 || daily.count !== 5
      || !/Daily challenge/.test(daily.kicker) || !/Stage 2/.test(daily.kicker)) {
      throw new Error(`daily challenge failed: ${JSON.stringify(daily)}`);
    }
    if (daily.silent !== true || daily.noQuit !== true) throw new Error(`daily not locked: ${JSON.stringify(daily)}`);
    return { progress, daily };
  });

  await step('the interface contains no French help left', async () => {
    const out = await ev(() => {
      const body = document.body.textContent;
      const bad = ['Choisissez', 'Réponse correcte', 'Pas tout à fait', 'Explication', 'Niveau']
        .filter((word) => body.includes(word));
      return { bad, frHints: document.querySelectorAll('.fr-hint, .dialogue-fr').length };
    });
    if (out.bad.length || out.frHints) throw new Error(`French UI remains: ${JSON.stringify(out)}`);
    return out;
  });

  await step('achievement hall lists all ten quiz badges', async () => {
    await ev(() => document.getElementById('achievementsBtn').click());
    await sleep(200);
    const out = await ev(() => ({
      screen: document.getElementById('screen-achievements').classList.contains('is-active'),
      cards: document.querySelectorAll('#achievementGrid .achievement-card').length,
      unlocked: document.querySelectorAll('#achievementGrid .achievement-card:not(.is-locked)').length,
      name: document.getElementById('achievementName').textContent,
      summary: document.getElementById('achievementXp').textContent,
      campusBadge: document.body.textContent.includes('Campus Explorer'),
    }));
    if (!out.screen || out.cards !== 10) throw new Error(`achievement hall invalid: ${JSON.stringify(out)}`);
    if (out.campusBadge) throw new Error('campus badge remains');
    if (out.unlocked < 1) throw new Error('earned badge not displayed');
    return out;
  });

  /* ==================================================== 8. RESPONSIVE */
  for (const [w, h] of [[320, 568], [360, 640], [390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]) {
    await step(`responsive layout fits ${w}×${h}`, async () => {
      await client.viewport(w, h);
      await ev(() => document.querySelector('[data-back="menu"]').click());
      await sleep(120);
      const out = await ev(() => {
        const title = document.getElementById('mainMenu');
        const buttons = [...document.querySelectorAll('#screen-menu button')];
        return {
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
          titleWidth: Math.round(title.getBoundingClientRect().width),
          buttons: buttons.length,
          smallTargets: buttons.filter((b) => {
            const r = b.getBoundingClientRect();
            return r.height > 0 && r.height < 40;
          }).length,
          innerWidth: window.innerWidth,
        };
      });
      if (out.overflowX > 1) throw new Error(`horizontal overflow: ${JSON.stringify(out)}`);
      if (!out.buttons || out.smallTargets) throw new Error(`touch targets invalid: ${JSON.stringify(out)}`);
      return out;
    });
  }
  await shot('05-mobile.png');
  await client.viewport(1440, 900);

  /* ========================================================= 9. OFFLINE */
  await step('the quiz reloads with the network switched off', async () => {
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
    if (!controlled.supported || !controlled.registered || !controlled.controller) {
      throw new Error(`service worker not controlling: ${JSON.stringify(controlled)}`);
    }
    await client.send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
    });
    client.resetLogs();
    await client.send('Page.reload', { ignoreCache: false });
    await sleep(3500);
    const offline = await ev(() => ({
      readyState: document.readyState,
      url: location.href,
      htmlLength: document.documentElement?.outerHTML?.length || 0,
      booted: document.body.classList.contains('is-booted'),
      global: Boolean(window.__ENGLISH_CLUB__),
      banner: !document.getElementById('offlineBanner').hidden,
      canStart: Boolean(document.getElementById('bootBtn')),
      exercises: window.__ENGLISH_CLUB__?.countExercises
        ? Object.values(window.__ENGLISH_CLUB__.countExercises())
          .reduce((n, byLevel) => n + Object.values(byLevel).reduce((a, b) => a + b, 0), 0)
        : 0,
    }));
    if (client.exceptions.length) throw new Error(`exceptions offline: ${client.exceptions[0]}`);
    const fatal = client.consoleErrors.filter((e) => !/Failed to load resource/i.test(e));
    if (fatal.length) throw new Error(`console errors offline: ${fatal.join(' | ')}`);
    if (!offline.booted || !offline.global || !offline.banner || offline.exercises !== 150) {
      throw new Error(`offline boot failed: ${JSON.stringify(offline)}`);
    }
    await client.send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    });
    return { ...controlled, ...offline };
  });
  await shot('06-offline.png');

  /* ========================================================== 10. SUMMARY */
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
