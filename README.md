# Mission: English Club

**The 180-Second English Challenge** — a single-player, offline-first pixel-art English game built for an American Corner English Clubs exhibition.

Everything is original and local: procedural Canvas art, CSS, Web Audio sound effects and 150 hand-written exercises. **No npm packages, no CDN, no fonts, no images, no API calls, no microphone, no speech synthesis.** Nothing is uploaded; progress stays in the browser.

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

## What is in the game

Version 3.1. The listening and speaking modes were removed: the game is entirely visual and text-based, with no audio dependency.

### The mission

Three minutes on an isometric campus. Walk between eight locations, talk to six club members, and complete **9 graded interactions**:

| Stop | Tasks | Skill |
|---|---|---|
| Vocabulary Garden | 3 | word ↔ picture, multiple choice |
| Grammar Classroom | 2 | form and accuracy decisions |
| American Culture Zone | 2 | verified facts about the United States |
| Final Challenge Arena | 2 | mixed grammar + reading |

The Reading Library and Writing Office are bonus stations, visited without penalty. The clock runs during exercises; it pauses only for menus, progress, settings and help.

**Accuracy, not speed:** each correct answer returns +3 seconds, capped at 210 seconds. Finishing early is never rewarded.

### Practice and support

- **Practice mode:** 10 exercises per skill per level, no timer, explanations on every answer.
- **Placement check:** six mixed questions suggest A1, A2 or B1; the player can override it.
- **Levels:** A1 (Beginner), A2 (Elementary), B1 (Intermediate).
- **Five skill areas:** vocabulary, grammar, reading, writing and American culture — 150 exercises total (5 × 3 levels × 10).
- **French help:** translated instructions for all 150 exercises, plus optional item-specific glosses. Off by default.
- **Accessibility:** reduced graphics, reduced motion, high contrast, forced touch controls, large targets, keyboard-only play and screen-reader labels.
- **Progress:** XP, club levels, best scores per CEFR level, skill totals and 10 achievements, saved in `localStorage` (key `ec.profile.v3`).

### Scoring

- 10 points per correct graded answer.
- Grade: **S ≥ 90 %**, **A ≥ 75 %**, **B ≥ 60 %**, **C ≥ 40 %**, **D < 40 %**.
- XP = 3 × correct answers + 2 × completed stations (max 5). Speed adds nothing.
- The report gives a per-skill breakdown and up to two targeted recommendations.

---

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | `WASD` or arrow keys | drag the on-screen joystick |
| Interact / continue | `E`, `Enter`, `Space` | press the round action button |
| Pause / close | `Esc` | pause button or close buttons |

Text fields accept typing without triggering game shortcuts.

---

## Tests

```bash
# 40 pure-logic checks: timer, scoring, achievements, storage, content, plans
node --test tests/unit.test.mjs

# 27 real-browser checks: navigation, movement, collision, dialogue, every
# station, results, pause, practice, settings, touch, 7 viewports, offline.
node tools/serve.mjs --port 8080   # in another terminal
node tests/e2e.mjs
```

The browser test uses a built-in CDP client (`tools/cdp.mjs`) and headless Chromium. Results and screenshots go to `/tmp/opencode/ec-shots/e2e-report.json` and `/tmp/opencode/ec-shots/e2e/`.

Latest verified run: **40/40 unit**, **27/27 browser**, **0 console errors, 0 exceptions, 0 warnings**.

---

## Project layout

```
index.html                 DOM for all screens and overlays
manifest.webmanifest       PWA metadata
sw.js                      offline-first service worker (32 files precached)
assets/icons/              generated PNG icons (192, 512, maskable)
src/main.js                boot and wiring
src/content/               150 exercises, dialogues, mission plan builder
src/core/                  timer, scoring, achievements, storage, Web Audio, utilities
src/game/                  input controller, mission orchestration
src/ui/                    screens, exercises, dialogue, canvas decorations, icons
src/world/                 isometric campus, collision, sprites, renderer
src/styles/                design system and screen styles
tools/                     static server, icon generator, CDP client, smoke check
tests/                     unit tests and Chromium end-to-end test
docs/                      exhibition guide and presentation script
```

See `ARCHITECTURE.md` for data flow and design decisions.

---

## Deployment

`.github/workflows/pages.yml` builds a clean `_site/` folder and deploys it to GitHub Pages on a push to `main`.

> **Status:** no push has been made and no authentication was available in the development environment. **The game is not published.** The intended address is `https://ronus-e.github.io/english-club-game/`; this is a target, not a verified URL.

---

## Known limitations

- `localStorage` can be disabled or cleared by the browser; the game then runs without saved progress and says so in the UI.
- Visual rendering was verified programmatically (canvas pixels, layout geometry, tap targets at 7 viewports); a human visual review of the screenshots is still recommended.
- French help translates instructions and selected glosses; it is not a full translation of every explanation.
- There is deliberately no audio, listening or speaking exercise, no account, no server, no analytics and no network request at runtime.

---

## Credits

Design, code, exercises, pixel art, generated icons and documentation: original work for this project. No third-party assets, fonts or libraries.
