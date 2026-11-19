# Architecture

Technical map of **Mission: English Club**. The project deliberately uses browser standards only: ES modules, Canvas 2D, CSS, Web Audio, `localStorage`, and a service worker. There is no build step and no runtime dependency.

## Runtime shape

```
index.html
   └── src/main.js  ── boot + all navigation/wiring
        ├── core/storage.js      ProfileStore (localStorage)
        ├── core/audio.js        AudioEngine (Web Audio + speech synthesis)
        ├── ui/screens.js        UI: screens, overlays, HUD, results, settings
        ├── ui/decor.js          logo, ambient particles, avatar, badge
        ├── ui/activities.js     ActivityRunner: 5 exercise renderers
        ├── ui/dialogue.js       DialogueRunner: NPC conversations
        ├── game/input.js        keyboard + joystick → world axis
        ├── game/mission.js      Mission: loop, movement, stations, clock, report
        ├── world/campus.js      10 stations, 6 NPCs, collision, route
        └── world/renderer.js    isometric canvas renderer
```

Content is data, separate from logic:

```
src/content/schema.js      builders, answer checking, validation, French instruction table
src/content/{skill}.js     7 banks × 3 levels × 10 exercises = 210
src/content/dialogues.js   6 NPC scripts
src/content/index.js       bank registry, placement check, buildMissionPlan()
```

## Boot sequence

1. `DOMContentLoaded` → `boot()` in `src/main.js`.
2. Build `ProfileStore` (injectable storage), `AudioEngine` (lazy `AudioContext`), `UI`.
3. Start the ambient canvas and the splash logo animation.
4. Create `ActivityRunner` and `DialogueRunner` with callbacks into the mission.
5. Create `Mission`, which constructs the `CampusRenderer` and places NPCs.
6. Create `InputController`; inject `worldAxis()` and `reset()` into the mission.
7. Bind every button, settings input, PWA event and visibility handler.
8. Expose `window.__ENGLISH_CLUB__` for diagnostics and tests.

The global is assigned before the informational log so a late logging error cannot hide it from tests.

## The 3-minute clock

`MissionTimer` derives time from a monotonic clock (`performance.now`), not from accumulated animation frames. Pausing banks elapsed time; resuming restarts the interval. `extend(seconds)` adds an accuracy credit, capped at 210 s. This makes the clock independent of frame rate, background throttling and machine speed.

The clock runs during exercises. It stops for the pause menu, progress panel, settings, help, about and confirmation overlays; it is frozen on `visibilitychange` and on `beforeunload`.

## Mission data flow

```
buildMissionPlan(level)
    ↓  stations: vocabulary(3) grammar(2) listening(1)
                speaking(1) culture(2) writing(1) final(2)
Mission.openStation(id)
    ↓  planKeyFor(id)        // world 'arena' ↔ plan 'final'
    ↓  ActivityRunner.open(items)
    ↓  onAnswer → recordAnswer / recordParticipation → timer.extend(+3)
    ↓  onFinish → completeStation → next station, renderer highlight
Mission.end()
    ↓  computeResults → evaluateAchievements → store.recordSession()
    ↓  UI.renderResults → results screen
```

`MISSION_ROUTE` uses the **world** station id `arena`; the plan and scoring code call the same stop `final`. `PLAN_KEY` / `planKeyFor()` in `campus.js` are the single translation point. A previous version mixed the two names and crashed while rendering the route.

Speaking is recorded with `correct: null`, so it never enters the accuracy denominator or the maximum score. It still unlocks the speaking achievement and adds XP.

## Exercise engine

`ActivityRunner` owns one overlay and renders five types from a common contract: every item has `id`, `skill`, `level`, `type`, `objective`, `instruction`, `prompt` and `explanation`. Answer checking is centralized in `checkAnswer()`.

- **choice** — immediate right/wrong highlighting, correct option always revealed.
- **match** — word↔icon grid drawn with `drawIcon()`; mistakes counted, full completion required.
- **order** — word chips, duplicate-aware; `answerText` must be a permutation of `words` (validated in unit tests).
- **short** — normalised text comparison against accepted variants.
- **speak** — Web Speech recognition when available, model TTS, checklist and text alternative. Participation only.
- **listening** — choice + playable script + transcript toggle; transcript is forced open when no speech voice exists.

After each answer: feedback, explanation, optional French gloss, then an explicit Continue button. No answer is silently skipped.

`activities.open()` filters invalid items and calls `onFinish` with an empty summary instead of throwing.

## French help

`FR_INSTRUCTIONS` in `schema.js` maps the eight distinct instruction strings to French. Each builder uses `frInstruction(instruction, explicit)` as the default for `instructionFr`, so all 210 exercises have a translated instruction. Item-level `fr` glosses remain data, supplied where a word needs explanation. The UI shows both only when `frenchHints` is enabled.

## Input and isometric movement

`InputController` normalises keyboard and joystick axes to screen space (length ≤ 1) and converts them to isometric world direction:

```
wx = x + y
wy = y - x
normalise(wx, wy)
```

Typing targets are excluded from movement keys. `E`, `Enter` and `Space` trigger interaction; `Escape` is routed through `handlePause()` in `main.js` and resolves nested overlays (confirm → dialogue → activity → pause → info overlays) in that order.

Collision uses five sample points around the player and `canStand()` in `campus.js`. Movement is axis-separated, so sliding along walls works.

## Rendering

The canvas is fixed at **480 × 270 logical pixels** and scaled with CSS `object-fit: contain`, preserving the pixel-art grid on any viewport. `CampusRenderer` draws tiles, buildings, paths, NPC sprites, the player, a smooth camera and a highlighted next station. Reduced-graphics mode lowers animation work. Sprites and icons are procedural (`world/sprites.js`, `ui/icons.js`).

DOM handles all text and controls; the canvas handles the world. This keeps text selectable, translatable and accessible.

## Storage and settings

`ProfileStore` uses versioned key `ec.profile.v3`. `mergeProfile()` repairs missing fields; `sanitizeSettings()` clamps volumes to 0–100 and coerces boolean flags, because `localStorage` is user-editable. `sessions` store XP, best scores, achievements with dates, skill totals and the last report. `reset()` clears everything after confirmation.

## Offline operation

`sw.js` precaches 34 app files individually (one bad URL cannot abort installation), removes old caches on activation and claims clients. Navigations fall back to cached `index.html`; static assets are cache-first and repopulate the cache on network success. A successful first load is enough for a completely offline exhibition.

Icons are generated by `tools/make-icons.mjs` with a hand-written PNG encoder (IHDR/IDAT/IEND, CRC32, zlib deflate), so the repository stays binary-light and reproducible.

## Testing design

- `tests/unit.test.mjs` — pure logic, injected clocks and storage, no DOM.
- `tools/cdp.mjs` — minimal CDP client over Node's global `WebSocket`; enables Runtime, Page, Log, Network; disables HTTP cache and forces service-worker updates.
- `tests/e2e.mjs` — 30 browser steps, including real keyboard events, real pointer events on the joystick, every exercise type, offline reload and seven viewports.

**Testing trap:** a service worker serving stale files makes a green test meaningless. Every browser run starts from a fresh profile and disables caching before navigation.

The test model cannot read screenshots. Visual verification therefore uses measurable proxies: canvas colour/coverage sampling, DOM geometry, overflow checks and tap-target sizes. A human review of the captures in `/tmp/opencode/ec-shots/e2e/` remains part of the pre-exhibition checklist.

## Design invariants

1. Speed never earns points; only accuracy does.
2. Speaking is participation, never an accent or proficiency judgement.
3. No external request of any kind at runtime.
4. No destructive action without an explicit confirmation.
5. A missing or malformed DOM node degrades gracefully rather than throwing.
6. Overlay visibility is mirrored to `#overlayRoot` from one place (`UI.syncOverlayRoot()`).
7. Dialogue completion callbacks fire exactly once.
