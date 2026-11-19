# Architecture

Technical map of **English Club Quiz** (v4.0). The project uses browser standards only: ES modules, CSS, Canvas 2D for decoration, Web Audio for short interface tones, `localStorage` and a service worker. No build step, no runtime dependency, no audio input or speech output.

## Runtime shape

```
index.html
   └── src/main.js  ── boot + all navigation/wiring
        ├── core/storage.js       ProfileStore (localStorage)
        ├── core/audio.js         AudioEngine (synthesised tones only)
        ├── core/scoring.js       pure session scoring and recommendations
        ├── core/achievements.js  ten quiz-based badges
        ├── core/util.js          RNG, normalisation, storage guard, debounce
        ├── ui/screens.js         UI: screens, overlays, results, settings
        ├── ui/decor.js           ambient field, logo, results badge
        ├── ui/activities.js      ActivityRunner: four exercise renderers
        ├── ui/icons.js           procedural icons for matching exercises
        └── game/quiz.js          stage-aware quiz controller
```

Content is data, separate from logic:

```
src/content/schema.js      LEVEL_INFO, SKILL_INFO, builders, checkAnswer(),
                           validateBank(), arrangeOptions()
src/content/{skill}.js     5 banks × 3 levels × 10 exercises = 150
src/content/index.js       bank registry, placement check, buildQuiz()
```

There is no `world/`, no `dialogue.js`, no `mission.js`, no `input.js` and no timer module.

## Boot sequence

1. `DOMContentLoaded` → `boot()` in `src/main.js`.
2. Build `ProfileStore`, `AudioEngine` and `UI`.
3. Start the ambient Canvas field and the animated splash logo; both stop or slow down with reduced-motion settings.
4. Create `ActivityRunner` with callbacks into `Quiz`.
5. Create `Quiz` with `onEnd`, `onProgress` and `onQuit` handlers.
6. Bind buttons, settings, keyboard closing, PWA events and online/offline events.
7. Expose `window.__ENGLISH_CLUB__` for diagnostics and tests.
8. Mark `document.body` with `is-booted` and enable the START button.

The splash screen does not load a game world. It only waits for the modules and the local profile.

## No clock

There is no mission timer, no time limit and no time bonus. A quiz ends when the learner finishes all questions in the current stage and confirms the last explanation. Leaving a quiz discards that run; only finished quizzes change the profile.

## Quiz data flow

```
startQuiz(level)
    ↓  buildQuiz(level, seed)
    ↓  Quiz.start(level) → activities.open({ items: 15 })
    ↓  onAnswer → recordAnswer(session, { skill, correct, response })
    ↓  onProgress → setQuizStatus(n, 15) + renderQuizPips(session.skills)
    ↓  onFinish → Quiz.finish()
    ↓  computeResults(session, previousBest)
    ↓  evaluateAchievements({ session, result, profile })
    ↓  store.recordSession(result) + store.unlock(badge)
    ↓  UI.renderResults() → results screen
```

`buildStageQuiz(level, stage, seed)` returns 5–9 questions depending on stage. The seed makes a run reproducible in tests; the browser uses `Date.now()`.

The level cards are A1, A2 and B1. Questions change with the level; the quiz format never changes.

## Exercise engine

`ActivityRunner` renders four types from a common contract (`id`, `skill`, `level`, `objective`, `instruction`, `prompt`, `explanation`):

- **choice** — multiple-choice options reordered by `arrangeOptions(id, options, answer)`. The order is deterministic and seeded by the item id; `options[answer]` remains the correct answer, so “A” is not predictable.
- **match** — word ↔ picture grid; the learner taps a word then its icon.
- **order** — word chips, duplicate-aware; the learner rebuilds the sentence, then confirms.
- **short** — normalised text compared with a list of accepted variants.

After each answer: immediate feedback, a short explanation, then an explicit Continue button. No French gloss, dialogue or NPC is involved. `AudioEngine` only produces short Web Audio envelopes for interface feedback and optional background music.

`activities.open()` filters invalid items and calls `onFinish` with an empty summary instead of throwing.

## Skills and levels

| Constant | Values |
|---|---|
| `LEVELS` | `A1`, `A2`, `B1` |
| `SKILLS` | `vocabulary`, `grammar`, `reading`, `writing` |
| `ALL_SKILLS` | the four skills above plus `culture` |
| `QUIZ_STAGES` | `10` |
| `STAGE_SIZES` | `[5, 5, 6, 6, 7, 7, 7, 8, 8, 9]` |

`LEVEL_INFO` and `SKILL_INFO` hold the labels, descriptions, icons and colours used by the level cards, pips, practice screen and skill report. Culture is authored with `fact = true` and optional `note` / `region` fields so classroom simplifications stay distinguishable from verified facts.

## Input

Click and tap are the primary inputs. `Tab` and `Enter` work on every native control; `Escape` closes the topmost overlay in order (confirm → help/about/settings → activity). Text inputs are excluded from global shortcuts. There is no keyboard movement, joystick, action button, collision detection or camera.

## Rendering

The DOM handles all text and controls. Canvas is used only for:

- the ambient starfield behind the interface;
- the splash emblem;
- the procedural results badge;
- procedural icons used by matching exercises.

Everything is generated locally. Titles use a local serif stack (`Georgia` / `DejaVu Serif`); no web font is fetched.

## Storage and settings

`ProfileStore` uses versioned key `ec.profile.v3`. `mergeProfile()` repairs missing fields; `sanitizeSettings()` clamps volumes to 0–100 and coerces booleans because `localStorage` is user-editable. Names are trimmed to 16 characters.

Stored profile fields include `xp`, `missions`, `best`, `achievements`, `skills`, `lastSession` and `settings`. Fields from the campus era (`frenchHints`, `forceTouch`, `usedSeconds`, `stationsVisited`) are gone.

Settings: music volume, effects volume, background music, reduced graphics, reduce motion, high contrast. **Reset local progress** clears everything after an explicit confirmation.

Badge ids from the old profile are preserved so stored progress survives; only the campus exploration badge was replaced by `all_skills` (“Every Skill”).

## Offline operation

`sw.js` precaches 25 files individually (one bad URL cannot abort installation), removes old caches on activation and claims clients. Navigations fall back to cached `index.html`; static assets are cache-first and repopulate on network success. Cache version `ec-v2.0.2`.

After the first online visit, the offline banner appears when the network drops and the quiz still boots from cache.

## Testing design

- `tests/unit.test.mjs` — 45 pure checks with injected storage and seeds.
- `tools/cdp.mjs` — minimal CDP client over Node's global `WebSocket`.
- `tools/smoke.mjs` — quick real-browser boot check up to the first question.
- `tests/e2e.mjs` — 20 browser steps: real clicks, every exercise type, immediate correction, full report, practice, placement, settings, achievements, seven viewports, offline reload, and assertions that French UI and campus elements are absent.

The test model cannot judge aesthetics. Visual verification uses measurable proxies: DOM geometry, overflow, tap-target sizes and computed styles. Human review of `/tmp/opencode/ec-shots/e2e/` remains part of the pre-exhibition checklist.

## Design invariants

1. Accuracy earns points; speed, stations and exploration never do.
2. Every level has 10 progressive stages, 5–9 questions per stage, difficulty rising across stages.
3. The interface is 100 % English; no French content or hint layer remains.
4. Option order is deterministic and the correct answer is not always A.
5. The correct answer and an explanation follow every response immediately.
6. No external request of any kind at runtime.
7. No destructive action without explicit confirmation.
8. A missing or malformed DOM node degrades gracefully rather than throwing.
