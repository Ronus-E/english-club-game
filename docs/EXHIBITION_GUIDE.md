# Exhibition guide

Use this at the American Corner stand. The whole game runs locally; the internet is not needed after the first load.

## Before visitors arrive

1. Copy the project folder to the demo machine. Do **not** run it with `sudo`.
2. Start the local server:
   ```bash
   cd english-club-game
   node tools/serve.mjs --port 8080
   ```
3. Open **http://127.0.0.1:8080/** in Chromium once. This lets the service worker cache all 32 files.
4. Optional: browser menu → **Install app / Add to Home Screen**, then launch once.
5. Turn off Wi-Fi, reload. The offline banner appears and the game still starts. Allow a few seconds for the cached modules to load.
6. Reset the demo profile before each presentation: menu → **Settings** → **Reset local progress** → confirm.

There is no audio setup, microphone permission or voice check to perform — the game has no listening or speaking mode.

## Suggested five-minute demonstration

The display uses an English editorial style: serif titles, red / blue / parchment accents and English station names on the campus signs. Feedback colours are unchanged — green means correct, red means correction.

| Time | Action | What to say |
|---|---|---|
| 0:00–0:25 | Splash → menu | "One player, three minutes, one campus. Everything you see is drawn in code." |
| 0:25–0:50 | **Placement check** (or skip) | "Six questions suggest a level. A learner can change it any time." |
| 0:50–1:15 | Choose A1 → character → start | "Pick a name and a face. Nothing is uploaded." |
| 1:15–1:45 | Walk with WASD; talk to Miss Rivera | "Eight locations, six club members. The glowing pad shows the next stop." |
| 1:45–2:30 | Vocabulary Garden (3 tasks) | "Word to picture, then a sentence. Every answer gets an explanation immediately." |
| 2:30–3:10 | Grammar + Culture | "Two accuracy decisions, then two culture facts. Nine answers make the mission." |
| 3:10–3:40 | Bonus: Writing Office or Reading Library | "Optional stations. No penalty for skipping them." |
| 3:40–4:10 | Final Arena → results | "Two mixed questions, then the report." |
| 4:10–4:35 | Results | "Grade, five-skill breakdown, recommendations, XP and badges." |
| 4:35–5:00 | Achievements + French help + offline | "Ten badges. Instructions can be shown in French. And we are offline right now." |

If time is short, skip placement and the NPC conversation. Never skip the results screen: it is the pedagogical payoff.

## Running it without a keyboard

Phones and tablets show a joystick and an action button. In settings, **Force touch controls** makes them visible on a laptop for demonstration.

## Accessibility switches (Settings)

- **Reduced graphics** / **Reduced motion** — less animation, calmer display.
- **High contrast** — stronger edges and text.
- **French help** — translated instructions plus word glosses.
- **Music / effects volume** and **music on/off** — synthesized tones only.
- **Force touch controls** — always show joystick and action button.

## Troubleshooting

| Symptom | Check |
|---|---|
| Blank page on `file://` | Use the local server; ES modules require `http://`. |
| Console 404 for `sw.js` or icons | Start the server from the **project root**. |
| French text does not appear | Settings → French help must be on; glosses appear after answering. |
| Progress seems lost | The browser may have cleared `localStorage`; the app says so in the menu. |
| Old version after an edit | Hard reload; during development the service worker may keep a previous cache. |
| Offline reload is slow | Cached ES modules need a few seconds; wait before judging. |
| Service worker will not register | Use `http://127.0.0.1` or HTTPS, not `file://`. |

## Privacy and safety

- No account, no login, no analytics, no microphone, no network request at runtime.
- Progress stays in the browser on that device.
- Reset local progress removes it permanently.

## Pre-exhibition checklist

- [ ] First load completed while online; service worker registered and controlling.
- [ ] Offline reload verified with a few seconds of patience.
- [ ] Demo profile reset.
- [ ] Human visual check at the exhibition screen resolution.
- [ ] Touch controls checked on the actual device, if used.
- [ ] Five-minute run timed once, end to end.
