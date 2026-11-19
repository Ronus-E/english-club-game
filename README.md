# English Club Quiz

**A1 · A2 · B1 — 10 progressive stages per CEFR level** for American Corner English Clubs.
Each level (A1, A2, B1) has 10 stages of 5–9 questions, with difficulty rising stage by stage.
Corrections are held back until the end of each stage, then shown in a clear final dashboard.

Everything is local: HTML, CSS, JavaScript, procedural Canvas decoration, synthesised Web Audio tones and 150 hand-written exercises. **No npm packages, no CDN, no web fonts, no image files, no API calls, no microphone, no speech recognition or synthesis.** Nothing is uploaded; progress stays in the browser.

---

## Quick start

```bash
cd english-club-game
node tools/serve.mjs --port 8080
# open http://127.0.0.1:8080/
```

A static server is required: ES modules and the service worker do not work from `file://`. Any static server works, for example `python3 -m http.server 8080`.

**Requirements:** a modern browser with JavaScript enabled. Node.js 18+ only for the local server and tests. No installation, no build step, no internet after the first load.

---

## Visual identity

English editorial style: serif titles, red / royal blue / parchment accents, and a small procedural emblem. The ambient field, logo and results badge are drawn in code. Green remains reserved for correct answers and red for corrections, so feedback stays unambiguous.

There is no campus, avatar, pixel-art world or moving character. The whole interface is a fast, readable quiz shell.

---

## What is in the quiz

Version 4.0. The former campus game was replaced by one focused quiz.

### One quiz

Choose A1, A2 or B1. Each level has 10 progressive stages. Stage sizes are 5, 5, 6, 6, 7, 7, 7, 8, 8, 9 questions — difficulty rises across stages. Questions interleave five skills (vocabulary, grammar, reading, writing, culture) so the same skill never appears twice in a row within a stage.

| Skill | Per stage | What it checks |
|---|---|---|
| Vocabulary | 1–2 | Words, meanings and everyday use |
| Grammar | 1–2 | Tenses, structures and accuracy |
| Reading | 1–2 | Short texts, notices and details |
| Writing | 1–2 | Build or complete a sentence |
| American culture | 1–2 | Verified cultural facts |

Clearing a stage (60 % or more) unlocks the next one. Finished stages show their best score and can be replayed at any time.

Four exercise types are used: multiple choice, word ↔ picture matching, word order, and short written answers. Multiple-choice options use a deterministic order seeded by the item id — memorising “A” never works.

During the quiz, answers stay neutral: no green tick, no red cross, no explanation is shown while questions remain. The correct answer, your choice and a short explanation are revealed together in the **final dashboard** after the last question. A quiz is locked until it is finished — you cannot leave part-way through without an explicit abandon control.

### Support and progress

- **Practice mode:** 10 exercises per skill per level, no clock. Practice still gives immediate explanations (only the scored quiz is silent). Revision by topic filters the bank by tag.
- **Placement check:** six mixed questions suggest A1, A2 or B1; the learner can override it.
- **Daily challenge:** one stable seed per calendar day per stage — the same questions for everyone playing that stage that day, no account or leaderboard.
- **Levels and stages:** A1 (Beginner), A2 (Elementary), B1 (Intermediate) — 3 levels × 10 stages. The 150 authored exercises feed every stage; stage 1 draws from the easiest authored items and stage 10 from the hardest, so difficulty rises while staying inside the chosen CEFR level.
- **Report:** score out of the stage maximum (50–90), grade, per-skill breakdown, up to two targeted recommendations and a final answer-by-answer dashboard with corrections and explanations.
- **Progress:** XP, club levels, best scores per CEFR level, skill totals, 10 achievements, a mistake book, session history and a configurable weekly goal, saved in `localStorage` (key `ec.profile.v3`).
- **Mistake review:** replay up to ten failed items; a mistake is cleared only when that item is answered correctly.
- **Data portability:** export and import the whole local profile as JSON, with an app marker, size limit and sanitised values.
- **Accessibility:** reduced graphics, reduced motion, high contrast, large text, large targets, keyboard navigation and screen-reader labels.
- **Language:** the interface is 100 % English. There are no French hints and no forced touch-control setting.

### Scoring

- 10 points per correct answer; stage max varies 50–90 (5–9 questions).
- Grade: **S ≥ 90 %**, **A ≥ 75 %**, **B ≥ 60 %**, **C ≥ 40 %**, **D < 40 %**.
- XP = 3 × correct answers. Speed, stations and exploration add nothing.
- The weakest skills receive two concrete suggestions for the next practice session.

---

## Controls

| Action | Desktop / touch |
|---|---|
| Answer | Click or tap an option, a word/picture pair, or a word chip |
| Confirm a sentence | Click **Check sentence** |
| Confirm a short answer | Press **Enter** or click **Check answer** |
| Continue | Click **Continue ▸** — records the answer, no correction until the end |
| Close an overlay | `Esc` or the close button |
| Leave practice | Close button (practice is not locked) |
| Leave a quiz | Not available while answering: finish all questions in the current stage, or use the developer `abandon()` control (an abandoned run is not saved) |

Text fields accept typing without triggering shortcuts. There are no movement keys, joystick or collision.

---

## Tests

```bash
# 65 pure-logic checks: schema, content, stage builder, scoring, achievements,
# storage sanitizers, stage unlocks, mistake book, weekly goal, profile
# import/export, SVG icons
node --test tests/unit.test.mjs

# 24 real-browser checks: boot, navigation, stage grid and unlocks, all exercise
# types, silent quiz with no leaked corrections, final dashboard, replay, stage
# progress, practice, topic revision, placement, progress, daily challenge,
# settings, achievements, responsive layout, offline reload, absence of French
# text and campus elements.
node tools/serve.mjs --port 8080   # in another terminal
node tests/e2e.mjs                 # or: node tests/e2e.mjs http://127.0.0.1:8080/
```

A quick boot-only check is also available: `node tools/smoke.mjs`.

The browser tests use a small built-in CDP client (`tools/cdp.mjs`) and headless Chromium. Reports and screenshots go to `/tmp/opencode/ec-shots/e2e-report.json` and `/tmp/opencode/ec-shots/e2e/`.

Latest verified run: **65/65 unit**, **24/24 browser**, **0 console errors, 0 exceptions, 0 warnings**.

---

## Project layout

```
index.html                 DOM for the nine screens and five overlays
manifest.webmanifest       PWA metadata
sw.js                      offline-first service worker (26 files precached)
assets/icons/              generated PNG icons (192, 512, maskable)
src/main.js                boot, navigation and wiring
src/content/               150 exercises, quiz builder, placement, schema
src/core/                  scoring, achievements, storage, audio, utilities
src/game/quiz.js           stage-aware quiz controller
src/ui/                    screens, exercises, icons, Canvas decoration
src/styles/                design system and screen styles
tools/                     static server, icon generator, CDP client, smoke check
tests/                     unit tests and Chromium end-to-end test
docs/                      exhibition guide and presentation script
```

See `ARCHITECTURE.md` for data flow and design decisions.

---

## Deployment

`.github/workflows/pages.yml` builds a clean `_site/` folder and deploys it to GitHub Pages on a push to `main`. It also verifies that every precached file exists before upload.

> **Status:** no push has been made and no GitHub authentication was available in the development environment. **The quiz is not published.** The intended address is `https://ronus-e.github.io/english-club-game/`; this is a target, not a verified URL.

---

## Known limitations

- `localStorage` can be disabled or cleared by the browser; the quiz then runs without saved progress and says so in the UI.
- Visual rendering was verified programmatically (DOM geometry, overflow and tap targets at seven viewports); a human visual review of the screenshots is still recommended.
- There is deliberately no audio-dependent exercise, no listening or speaking task, no account, no server, no analytics and no network request at runtime.
- The interface is English-only by design: no French translation layer remains in the content or the UI.

---

## Credits

Design, code, exercises, procedural artwork, generated icons and documentation: original work for this project. No third-party assets, fonts or libraries.
