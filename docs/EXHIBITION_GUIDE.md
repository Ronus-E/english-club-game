# Exhibition guide

Use this at the American Corner stand. The whole quiz runs locally; the internet is not needed after the first load.

## Before visitors arrive

1. Copy the project folder to the demo machine. Do **not** run it with `sudo`.
2. Start the local server:
   ```bash
   cd english-club-game
   node tools/serve.mjs --port 8080
   ```
3. Open **http://127.0.0.1:8080/** in Chromium once. This lets the service worker cache all 25 files.
4. Optional: browser menu → **Install app / Add to Home Screen**, then launch once.
5. Turn off Wi-Fi, reload. The offline banner appears and the quiz still starts. Allow a few seconds for the cached modules to load.
6. Reset the demo profile before each presentation: menu → **Settings** → **Reset local progress** → confirm.

There is no audio setup, microphone permission or voice check to perform. Sound is optional and synthesised in the browser.

## Suggested five-minute demonstration

The display uses an English editorial style: serif titles, red / blue / parchment accents and a small procedural emblem. Feedback colours are unchanged — green means correct, red means correction.

| Time | Action | What to say |
|---|---|---|
| 0:00–0:25 | Splash → menu | "Fifteen questions. Five skills. No clock. Everything you see is drawn in code." |
| 0:25–0:50 | **Find my level** (or skip) | "Six questions suggest A1, A2 or B1. A learner can change it any time." |
| 0:50–1:15 | Choose A1 → enter a name → start | "One name, stored on this device only. Nothing is uploaded." |
| 1:15–1:45 | First question: match or choice | "Every answer is corrected straight away — and the reason is shown immediately." |
| 1:45–2:45 | Grammar, reading and writing questions | "Three questions per skill, mixed together. The five pips show what is covered." |
| 2:45–3:30 | Culture questions, then the last explanations | "Verified cultural facts, not trivia guesses." |
| 3:30–4:10 | Results | "Score out of 150, grade, five-skill breakdown, two suggestions, XP and badges." |
| 4:10–4:35 | **Practice weak skill** + achievement hall | "The report leads straight to focused practice. Ten badges, all local." |
| 4:35–5:00 | Settings + offline reload | "Reduced motion, high contrast, no trackers — and we are offline right now." |

If time is short, skip the placement check and the practice detour. Never skip the results screen: it is the pedagogical payoff.

## Running it without a mouse

Phones and tablets work with taps. Short-answer fields have a **Check answer** button as well as the Enter key. There is no joystick, no action button and no movement to demonstrate.

## Accessibility switches (Settings)

- **Reduced graphics** / **Reduce motion** — calmer animation on modest devices.
- **High contrast** — stronger edges and text.
- **Music volume** / **Sound effects** / **Background music** — synthesised tones only.
- **Reset local progress** — deletes XP, badges, best scores and settings after confirmation.

There is no French-help switch and no force-touch option: the interface is English-only on every device.

## Troubleshooting

| Symptom | Check |
|---|---|
| Blank page on `file://` | Use the local server; ES modules require `http://`. |
| Console 404 for `sw.js` or icons | Start the server from the **project root**. |
| French text appears | Not expected: hard reload to discard an older cached build. |
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
- [ ] Touch check on the actual device, if used.
- [ ] Five-minute run timed once, end to end.
