# Mission: English Club

**The 180-Second English Challenge** — a single-player, offline-first pixel-art English game built for an American Corner English Clubs exhibition.

Everything is original and local: procedural Canvas art, CSS, Web Audio sound, and 210 hand-written exercises. **No npm packages, no CDN, no fonts, no images, no API calls.** Nothing is uploaded; progress stays in the browser.

---

## Quick start

```bash
cd english-club-game
node tools/serve.mjs --port 8080
# open http://127.0.0.1:8080/
```

A static server is required: ES modules and the service worker do not work from `file://`.

Any static server works, for example `python3 -m http.server 8080`.

**Requirements:** a modern browser (Chromium/Chrome, Firefox, Edge, Safari) with JavaScript enabled. Node.js 18+ only for the local server and tests. No installation, no build step, no internet connection after the first load.

---

## What is in the game

### The mission

Three minutes on an isometric campus. Walk between ten locations, talk to six club members, and complete **11 graded interactions**:

| Stop | Tasks | Skill |
|---|---|---|
| Vocabulary Garden | 3 | word ↔ picture, multiple choice |
| Grammar Classroom | 2 | form and accuracy decisions |
| Listening Lounge | 1 | short audio + transcript fallback |
| Speaking Stage | 1 | model sentence, recording or text alternative |
| American Culture Zone | 2 | facts about the United States |
| Final Challenge Arena | 2 | mixed grammar + reading |

Two optional bonus stations (Reading Library, Writing Office) can be visited without penalty. The clock keeps running during exercises; it pauses only for menus, progress, settings and help.

**Accuracy, not speed:** each correct answer returns +3 seconds, capped at 210 seconds. Finishing early is never rewarded.

### Practice and support

- **Practice mode:** 10 exercises per skill per level, no timer, no score pressure, explanations on every answer.
- **Placement check:** six mixed questions suggest A1, A2 or B1; the player can override it.
- **Levels:** A1 (Beginner), A2 (Elementary), B1 (Intermediate).
- **French help:** translated instructions for all 210 exercises, plus item-specific glosses where useful. Off by default.
- **Accessibility:** reduced graphics, reduced motion, high contrast, forced touch controls, large targets, keyboard-only play, listening transcripts, speaking participation without auto-grading.
- **Progress:** XP, club levels, personal bests per CEFR level, skill totals and 12 achievements, saved in `localStorage` (key `ec.profile.v3`).

### Scoring

- 10 points per correct graded answer. Speaking is recorded as participation, never scored as proficiency.
- Grade: **S ≥ 90 %**, **A ≥ 75 %**, **B ≥ 60 %**, **C ≥ 40 %**, **D < 40 %**.
- XP = 3 × correct answers + 2 × completed stations (max 7) + 4 for speaking. Speed adds nothing.
- The report gives a per-skill breakdown and up to two targeted recommendations.

---

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | `WASD` or arrow keys | drag the on-screen joystick |
| Interact / continue | `E`, `Enter`, `Space` | press the round action button |
| Pause / close | `Esc` | pause button or close buttons |

Fields accept typing without triggering game shortcuts.

---

## Tests

```bash
# 41 pure-logic checks: timer, scoring, achievements, storage, content, plans
node --test tests/unit.test.mjs

# 30 real-browser checks: navigation, movement, collision, dialogue, every
# station, results, pause, practice, settings, touch, 7 viewports, offline.
node tools/serve.mjs --port 8080   # in another terminal
node tests/e2e.mjs
```

The browser test uses a small built-in CDP client (`tools/cdp.mjs`) and headless Chromium. It writes JSON results and screenshots to `/tmp/opencode/ec-shots/e2e-report.json` and `/tmp/opencode/ec-shots/e2e/`.

Latest verified run: **41/41 unit**, **30/30 browser**, **0 console errors, 0 exceptions, 0 warnings**.

---

## Project layout

```
index.html                 DOM for all 8 screens and 8 overlays
manifest.webmanifest       PWA metadata
sw.js                      offline-first service worker
assets/icons/              generated PNG icons (192, 512, maskable)
src/main.js                boot and wiring
src/content/              210 exercises, dialogues, mission plan builder
src/core/                 timer, scoring, achievements, storage, audio, utilities
src/game/                 input controller, mission orchestration
src/ui/                   screens, exercises, dialogue, canvas decorations, icons
src/world/                isometric campus, collision, sprites, renderer
src/styles/               design system and screen styles
tools/serve.mjs            zero-dependency static server
tools/make-icons.mjs       deterministic pixel-art PNG generator
tools/cdp.mjs              minimal Chrome DevTools Protocol client
tools/smoke.mjs            quick boot check
tests/unit.test.mjs        Node unit tests
tests/e2e.mjs              Chromium end-to-end test
docs/                      exhibition guide and presentation script
```

See `ARCHITECTURE.md` for data flow and design decisions.

---

## Deployment

`.github/workflows/pages.yml` builds a clean `_site/` folder and deploys it to GitHub Pages on a push to `main`.

> **Status:** no commit or push has been made from this build, and no authentication was available in the development environment. **The game is not published yet.** The intended address after a successful push is `https://ronus-e.github.io/english-club-game/`; this is a target, not a verified URL.

To deploy manually from a clone with Pages enabled, push `main`; the workflow handles the rest.

---

## Known limitations

- Speech recognition works only in browsers that expose the Web Speech API; every speaking task has a text/self-check alternative.
- The listening audio uses the browser's English speech synthesis. If no English voice exists, the transcript is shown automatically.
- `localStorage` can be disabled or cleared by the browser; the game then runs without saved progress and says so in the UI.
- Visual rendering was verified programmatically (canvas pixels, layout geometry, tap targets at 7 viewports); a human visual review of the screenshots is still recommended before the exhibition.
- French help translates instructions and selected glosses; it is not a full translation of every explanation.
- No account, server, analytics or network feature: there is nothing to sync and nothing to leak.

---

## Credits

Design, code, exercises, pixel art, generated icons and documentation: original work for this project. No third-party assets, fonts or libraries are bundled.
