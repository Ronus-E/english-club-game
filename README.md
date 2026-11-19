# English Club Quiz

**A1 · A2 · B1 — a 15-question offline English quiz** for American Corner English Clubs. One level, five skills, immediate explanations, and a clear report at the end.

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

Choose A1, A2 or B1. Each quiz contains **15 questions**: three each in vocabulary, grammar, reading, writing and American culture. The three questions of a skill are interleaved with the others, so the same skill never appears three times in a row.

| Skill | Questions | What it checks |
|---|---|---|
| Vocabulary | 3 | Words, meanings and everyday use |
| Grammar | 3 | Tenses, structures and accuracy |
| Reading | 3 | Short texts, notices and details |
| Writing | 3 | Build or complete a sentence |
| American culture | 3 | Verified cultural facts |

Four exercise types are used: multiple choice, word ↔ picture matching, word order, and short written answers. Multiple-choice options use a deterministic order seeded by the item id — memorising “A” never works.

After every answer, the correct answer and a short explanation appear immediately, followed by an explicit **Continue** button.

### Support and progress

- **Practice mode:** 10 exercises per skill per level, no clock, explanations on every answer.
- **Placement check:** six mixed questions suggest A1, A2 or B1; the learner can override it.
- **Levels:** A1 (Beginner), A2 (Elementary), B1 (Intermediate) — 150 exercises total (5 skills × 3 levels × 10).
- **Report:** score out of 150, grade, per-skill breakdown and up to two targeted recommendations.
- **Progress:** XP, club levels, best scores per CEFR level, skill totals and 10 achievements, saved in `localStorage` (key `ec.profile.v3`).
- **Accessibility:** reduced graphics, reduced motion, high contrast, large targets, keyboard navigation and screen-reader labels.
- **Language:** the interface is 100 % English. There are no French hints and no forced touch-control setting.

### Scoring

- 10 points per correct answer; maximum 150.
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
| Continue | Click **Continue ▸** after the explanation |
| Close an overlay | `Esc` or the close button |
| Leave a quiz | Back button, then **Leave quiz** (the unfinished run is not saved) |

Text fields accept typing without triggering shortcuts. There are no movement keys, joystick or collision.

---

## Tests

```bash
# 45 pure-logic checks: schema, content, buildQuiz, scoring, achievements, storage
node --test tests/unit.test.mjs

# 20 real-browser checks: boot, navigation, all exercise types, immediate
# correction, report, practice, placement, settings, achievements, responsive
# layout, offline reload, absence of French text and campus elements.
node tools/serve.mjs --port 8080   # in another terminal
node tests/e2e.mjs                 # or: node tests/e2e.mjs http://127.0.0.1:8080/
```

A quick boot-only check is also available: `node tools/smoke.mjs`.

The browser tests use a small built-in CDP client (`tools/cdp.mjs`) and headless Chromium. Reports and screenshots go to `/tmp/opencode/ec-shots/e2e-report.json` and `/tmp/opencode/ec-shots/e2e/`.

Latest verified run: **45/45 unit**, **20/20 browser**, **0 console errors, 0 exceptions, 0 warnings**.

---

## Project layout

```
index.html                 DOM for the six screens and five overlays
manifest.webmanifest       PWA metadata
sw.js                      offline-first service worker (25 files precached)
assets/icons/              generated PNG icons (192, 512, maskable)
src/main.js                boot, navigation and wiring
src/content/               150 exercises, quiz builder, placement, schema
src/core/                  scoring, achievements, storage, audio, utilities
src/game/quiz.js           15-question quiz controller
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
