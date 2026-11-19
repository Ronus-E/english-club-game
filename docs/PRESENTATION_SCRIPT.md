# Five-minute presentation script

For the American Corner English Clubs exhibition. English only; speak slowly, smile, and let the game speak for itself. Bracketed text is a **stage direction**, not something to read aloud.

Total: **5:00**. Timings are cumulative. If you run long, use the short versions marked *[cut]*.

---

## 0:00 — Hook

*[Stand by the screen. Splash screen visible. Wait two seconds, then begin.]*

> "Three minutes. One campus. Ten places to visit. And one question: can you finish an English mission before the clock runs out?
>
> This is **Mission: English Club**. I built it for you — and everything you see is drawn in code. No photos, no downloads, no internet."

*[Press **START MISSION**. Gesture at the splash animation.]*

> "That logo, the campus, the characters, even the sound — all generated locally by the browser."

---

## 0:25 — Choose a level

*[Menu appears. Point at the three level cards.]*

> "A learner starts with six quick questions. They suggest A1, A2 or B1 — but the learner always has the final say."

*[Click **Check my level** if time allows; otherwise click **PLAY** → A1. *[cut]* Skip the check and go straight to A1.]*

> "Today I'll show A1, beginner level. Pick a name, pick a face — nothing is uploaded. It stays on this machine."

*[Type a name, choose an avatar, click **START MISSION**.]*

---

## 1:15 — The campus

*[Campus appears. Move with **WASD** for a few seconds. Let the audience see the camera follow.]*

> "Here is the English Club campus. I walk with the keyboard — or with a joystick on a phone. The glowing tile tells me where to go next."

*[Walk to Miss Rivera and press **E**.]*

> "Six club members give hints. Listen to the guide..."

*[Let the dialogue appear for three seconds, then advance and close it.]*

> "...then it's to work."

---

## 1:45 — Vocabulary Garden

*[Enter the Vocabulary Garden with **E**. Solve the match task by clicking, then the choice task.]*

> "First stop: vocabulary. Match the word to the picture. Then use a word in a sentence.
>
> Notice what happens after every answer — the game tells you immediately if you were right, and *why*. No red cross with no explanation."

*[Point at the explanation line. *[cut]* Answer only the first item and continue.]*

> "Three tasks here. Each correct answer gives three seconds back — but only up to a limit. Speed never earns points."

---

## 2:30 — Grammar and Listening

*[Finish vocabulary. Walk or use the HUD route to the Grammar Classroom; answer two items.]*

> "Grammar: two decisions about real sentences, not abstract rules."

*[Enter the Listening Lounge. Click **play**, answer, then click **Show transcript**.]*

> "Listening: a short recording, synthesized by the browser in English. And if you can't hear it — or there's no English voice — the transcript opens. Accessibility isn't an afterthought here."

---

## 3:15 — Speaking Stage

*[Enter the Speaking Stage. Let the model sentence play. Use the checklist alternative if the microphone is unavailable.]*

> "Speaking is the delicate one. The model sentence plays; the learner says it aloud. Speech recognition works where the browser supports it.
>
> But we **never grade an accent**. There's always a checklist or a typed answer. The learner participates and gets credit for trying — full stop."

---

## 3:45 — Culture and Final Challenge

*[Complete Culture — two questions about the United States. Then enter the Final Challenge Arena.]*

> "Two culture questions — real, checkable facts. Then the arena: two mixed questions to close the mission."

*[Solve the final two items. Let the results screen appear. Pause.]*

---

## 4:10 — Results

*[Point at each region of the report in turn: grade, numbers, skill rows, recommendations.]*

> "And here is the payoff. A grade — S, A, B, C or D. Ten points per correct answer; speaking is reported separately, so it can't distort the score.
>
> A breakdown by skill: vocabulary, grammar, listening, speaking, reading, writing, culture. Two recommendations that point at the weakest area.
>
> XP, a personal best, and badges — twelve of them. Everything saved locally, in this browser only."

---

## 4:35 — Closing

*[Open **Achievements** from the menu; show the badges. Then open **Settings** and switch on **French help**. Return to a task and show a translated instruction. *[cut]* Show the badge screen only.]*

> "Instructions can appear in French. Reduced motion, high contrast, forced touch controls — all in settings."

*[If Wi-Fi is on, turn it off now and reload. Let the offline banner appear.]*

> "And one last thing. We are now offline. Reload — it still works. The whole game is cached after one visit.
>
> No account. No analytics. No server. Just English practice that works anywhere."

*[Smile. Stop talking.]*

---

## If something goes wrong

| Problem | Say / do |
|---|---|
| Microphone denied | "Exactly the point — I'll use the checklist instead." |
| No English voice | Click the transcript: "The fallback works as designed." |
| Wi-Fi can't be disabled | Show the service worker in DevTools → Application → Service Workers, then say "registered and controlling". |
| Time running out | Skip placement, skip the NPC, answer one item per station, jump to results. |
| Page goes blank | Hard reload; if still blank, start `node tools/serve.mjs --port 8080` from the project root. |

## Delivery notes

- Do **not** read the script word for word. Use the bold phrases as anchors.
- Leave two seconds of silence after each screen change; the audience needs time to look.
- Never apologise for the pixel art. Call it **deliberate**: it loads fast and works offline.
- End on the offline reload if possible. It is the most memorable claim, and it is verifiable.
