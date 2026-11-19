# Architecture

Technical map of **Mission: English Club** (v3.1). The project uses browser standards only: ES modules, Canvas 2D, CSS, Web Audio, `localStorage` and a service worker. No build step, no runtime dependency, no audio input or output beyond short synthesized tones.

## Runtime shape

```
index.html
   └── src/main.js  ── boot + all navigation/wiring
        ├── core/storage.js      ProfileStore (localStorage)
        ├── core/audio.js        AudioEngine (Web Audio tones only)
        ├── ui/screens.js        UI: screens, overlays, HUD, results, settings
        ├── ui/decor.js          logo, ambient particles, avatar, badge
        ├── ui/activities.js     ActivityRunner: 4 exercise renderers
        ├── ui/dialogue.js       DialogueRunner: NPC conversations
        ├── game/input.js        keyboard + joystick → world axis
        ├── game/mission.js      Mission: loop, movement, stations, clock, report
        ├── world/campus.js      8 stations, 6 NPCs, collision, route
        └── world/renderer.js    isometric canvas renderer
```

Content is data, separate from logic:

```
src/content/schema.js      builders, answer checking, validation, French table
src/content/{skill}.js     5 banks × 3 levels × 10 exercises = 150
src/content/dialogues.js   6 NPC scripts
src/content/index.js       bank registry, placement check, buildMissionPlan()
```

## Boot sequence

1. `DOMContentLoaded` → `boot()` in `src/main.js`.
2. Build `ProfileStore`, `AudioEngine`, `UI`.
3. Start ambient canvas and splash animation.
4. Create `ActivityRunner` and `DialogueRunner` with callbacks into the mission.
5. Create `Mission`, which builds the `CampusRenderer` and places NPCs.
6. Create `InputController`; inject `worldAxis()` and `reset()` into the mission.
7. Bind buttons, settings, PWA events and visibility handlers.
8. Expose `window.__ENGLISH_CLUB__` for diagnostics and tests.

## The 3-minute clock

`MissionTimer` derives time from a monotonic clock (`performance.now`), not from accumulated frames. Pausing banks elapsed time. `extend(seconds)` adds an accuracy credit capped at 210 s. The clock is independent of frame rate and background throttling.

It runs during exercises and stops for pause, progress, settings, help, about, confirmation overlays, `visibilitychange` and `beforeunload`.

## Mission data flow

```
buildMissionPlan(level)
    ↓  vocabulary(3) grammar(2) culture(2) writing(1 bonus) final(2)
Mission.openStation(id)
    ↓  planKeyFor(id)        // world 'arena' ↔ plan 'final'
    ↓  ActivityRunner.open(items)
    ↓  onAnswer → recordAnswer → timer.extend(+3)
    ↓  onFinish → completeStation → next station, renderer highlight
Mission.end()
    ↓  computeResults → evaluateAchievements → store.recordSession()
    ↓  UI.renderResults → results screen
```

`MISSION_ROUTE` uses the **world** id `arena`; the plan calls the same stop `final`. `PLAN_KEY` / `planKeyFor()` in `campus.js` are the single translation point.

The route has four required stops: `vocabulary → grammar → culture → arena`. Reading supplies one of the two final questions; Writing is optional. Total: **9 graded answers**.

## Exercise engine

`ActivityRunner` renders four types from a common contract (`id`, `skill`, `level`, `objective`, `instruction`, `prompt`, `explanation`):

- **choice** — deterministic seeded option shuffle at build time (`arrangeOptions()` in `schema.js`); the correct answer stays consistent with options and explanations, and is never always A.
- **match** — word ↔ icon grid drawn with `drawIcon()`; mistakes counted.
- **order** — word chips, duplicate-aware; `answerText` must be a permutation of `words`.
- **short** — normalised text against accepted variants.

After each answer: feedback, explanation, optional French gloss, then an explicit Continue button. There is no speaking renderer, audio player, transcript toggle, microphone or speech recognition. `AudioEngine` only produces short Web Audio envelopes for interface feedback and background music.

`activities.open()` filters invalid items and calls `onFinish` with an empty summary instead of throwing.

## French help

`FR_INSTRUCTIONS` in `schema.js` maps the distinct instruction strings to French. Each builder uses `frInstruction(instruction, explicit)` as the default for `instructionFr`, so all 150 exercises have a translated instruction. Item-level `fr` glosses remain optional data. The UI shows both only when `frenchHints` is enabled.

## Input and isometric movement

`InputController` normalises keyboard and joystick axes to screen space (length ≤ 1) and converts to isometric world direction (`wx = x + y`, `wy = y - x`, then normalise). Typing targets are excluded. `E`, `Enter`, `Space` interact; `Escape` resolves nested overlays in order (confirm → dialogue → activity → pause → info).

Collision samples five points around the player; movement is axis-separated so sliding along walls works.

## Rendering

Campus signs use the `SIGN_LABELS` table in `renderer.js`: short English names (`VOCAB`, `GRAMMAR`, `FINAL`) drawn beside the procedural icon. Titles use a local serif stack (`Georgia` / `DejaVu Serif`); no web font is fetched.

Canvas fixed at **480 × 270 logical pixels**, scaled with CSS `object-fit: contain` to preserve the pixel grid. `CampusRenderer` draws tiles, buildings, paths, NPCs, player, smooth camera and highlighted next station. Reduced-graphics mode lowers animation work. Sprites and icons are procedural. DOM handles all text and controls; the canvas handles the world.

## Storage and settings

`ProfileStore` uses versioned key `ec.profile.v3`. `mergeProfile()` repairs missing fields; `sanitizeSettings()` clamps volumes to 0–100 and coerces booleans because `localStorage` is user-editable. `reset()` clears everything after confirmation.

## Offline operation

`sw.js` precaches 32 files individually (one bad URL cannot abort installation), removes old caches on activation and claims clients. Navigations fall back to cached `index.html`; static assets are cache-first and repopulate on network success. Cache version `ec-v1.3.0`.

## Testing design

- `tests/unit.test.mjs` — 42 pure checks with injected clocks and storage.
- `tools/cdp.mjs` — minimal CDP client over Node's global `WebSocket`; disables HTTP cache and forces service-worker updates.
- `tests/e2e.mjs` — 27 browser steps: real keyboard and pointer events, every exercise type, offline reload, seven viewports.

The test model cannot read screenshots. Visual verification uses measurable proxies: canvas sampling, DOM geometry, overflow checks and tap-target sizes. Human review of `/tmp/opencode/ec-shots/e2e/` remains part of the pre-exhibition checklist.

## Design invariants

1. Speed never earns points; only accuracy does.
2. No audio dependency: no microphone, no speech synthesis, no transcript.
3. No external request of any kind at runtime.
4. No destructive action without explicit confirmation.
5. A missing or malformed DOM node degrades gracefully rather than throwing.
6. Overlay visibility is mirrored to `#overlayRoot` from one place.
7. Dialogue completion callbacks fire exactly once.
