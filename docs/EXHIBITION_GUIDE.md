# Exhibition guide

Use this at the American Corner stand. The whole game runs locally; the internet is not needed after the first load.

## Before visitors arrive

1. Copy the project folder to the demo machine. Do **not** run it with `sudo`.
2. Start the local server:
   ```bash
   cd english-club-game
   node tools/serve.mjs --port 8080
   ```
3. Open **http://127.0.0.1:8080/** in Chromium. Press **START MISSION** once. This lets the service worker cache the app and lets the browser choose an English voice.
4. Optional: use the browser menu → **Install app / Add to Home Screen**. Launch the installed app once so it is fully offline-ready.
5. Turn off Wi-Fi. Reload. The offline banner should appear and the game should still start.
6. Reset the demo profile before each presentation: menu → **Settings** → **Reset local progress** → confirm. This restores A1, `Explorer`, zero XP.

## Suggested five-minute demonstration

| Time | Action | What to say |
|---|---|---|
| 0:00–0:25 | Splash → menu | "One player, three minutes, one campus. Everything you see is drawn in code." |
| 0:25–0:50 | **Placement check** (or skip) | "Six questions suggest a level. A learner can change it any time." |
| 0:50–1:15 | Choose A1 → character → start | "Pick a name and a look. Nothing is sent anywhere." |
| 1:15–1:45 | Walk with WASD; talk to Miss Rivera | "Ten locations, six club members. The glowing pad shows the next stop." |
| 1:45–2:30 | Vocabulary Garden (3 tasks) | "Word to picture, then a sentence. Every answer gets an explanation immediately." |
| 2:30–3:15 | Grammar + Listening | "Two accuracy decisions, then a short recording with a transcript if you need it." |
| 3:15–3:45 | Speaking Stage | "Say the model aloud. Speech recognition is optional; a checklist works too. We never grade an accent." |
| 3:45–4:10 | Culture + Final Arena | "Two culture facts, then two mixed questions and the report." |
| 4:10–4:35 | Results | "Grade, per-skill breakdown, recommendations, XP and badges." |
| 4:35–5:00 | Achievements + French help + offline | "Twelve badges. Instructions can be shown in French. And we are offline right now." |

If time is short, skip placement and the NPC conversation. Never skip the results screen: it is the pedagogical payoff.

## Running it without a keyboard

Phones and tablets show a joystick and an action button. In settings, **Force touch controls** makes them visible on a laptop or touch screen for demonstration.

## Accessibility switches (Settings)

- **Reduced graphics** / **Reduced motion** — less animation, calmer display.
- **High contrast** — stronger edges and text.
- **French help** — translated instructions plus word glosses.
- **Music / effects volume** and **music on/off**.
- **Force touch controls** — always show the joystick and action button.

## Troubleshooting

| Symptom | Check |
|---|---|
| Blank page on `file://` | Use the local server; ES modules require `http://`. |
| Console 404 for `sw.js` or icons | Start the server from the **project root**, not a parent folder. |
| French text does not appear | Settings → French help must be on; glosses appear after answering. |
| No listening audio | The machine needs an English speech voice; the transcript opens automatically. |
| Microphone does not work | Browser permission or Web Speech API unavailable; use the checklist alternative. |
| Progress seems lost | The browser may have cleared `localStorage`; the app states this in the menu. |
| Old version after an edit | Hard reload; during development the service worker may keep a previous cache. |
| Service worker will not register | Use `http://127.0.0.1` or HTTPS, not `file://`. |

## Privacy and safety

- No account, no login, no analytics, no network request at runtime.
- Progress stays in the browser on that device.
- Reset local progress removes it permanently.
- The speaking task is opt-in participation; nothing is recorded or uploaded.

## Pre-exhibition checklist

- [ ] First load completed while online, service worker registered.
- [ ] Offline reload verified, banner visible, mission playable.
- [ ] Demo profile reset.
- [ ] English voice available, or transcript fallback verified.
- [ ] Human visual check at the exhibition screen resolution.
- [ ] Touch controls checked on the actual device, if used.
- [ ] Five-minute run timed once, end to end.
