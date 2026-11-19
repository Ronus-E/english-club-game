# Five-minute presentation script

For the American Corner English Clubs exhibition. English only; speak slowly, smile, and let the quiz speak for itself. Bracketed text is a **stage direction**, not something to read aloud.

Total: **5:00**. Timings are cumulative. If you run long, use the short versions marked *[cut]*.

---

## 0:00 — Hook

*[Stand by the screen. Splash screen visible. Wait two seconds, then begin.]*

> "Ten progressive stages, five–nine questions each. No clock, no pressure, just calm music. And one question: can you show what you know in English?
>
> This is **English Club Quiz**. I built it for you — and everything you see and hear is generated in code. No photos, no downloads, no internet."

*[Press **START**. Gesture at the emblem.]*

> "That logo, the background, the badge at the end — all generated locally by the browser."

---

## 0:25 — Choose a level

*[Menu appears. Point at the three level cards.]*

> "A learner starts with six quick questions. They suggest A1, A2 or B1 — but the learner always has the final say."

*[Click **Find my level** if time allows; otherwise click **START A QUIZ** → A1. *[cut]* Skip the check and go straight to A1.]*

> "Today I'll show A1, beginner level. I type a name — nothing is uploaded. It stays on this machine."

*[Type a name, click **START A STAGE** → A1. *[cut]* Skip the check and go straight to A1.]*

> "Before the questions, the welcome panel names the level, the stage and how many questions await. The learner confirms and begins."

*[Click **Start stage 1**. The question panel opens.]*

---

## 1:15 — The first question

*[Question panel opens. Answer the first item slowly; let the audience notice the calm neutrality.]*

> "Here is the question panel. Tap a word and its picture, or choose an option — the task changes, but the rhythm does not.
>
> During the stage, answers stay neutral: no green tick, no red cross, no explanation yet. Everything is revealed together at the end, so the learner is never interrupted."

*[Click **Continue ▸**. *[cut]* Answer only the first item and continue.]*

> "There is no timer. Accuracy is the only thing that counts."

---

## 1:45 — Five skills

*[Point at the five pips when they appear. Answer one grammar, one reading and one writing question.]*

> "Every stage mixes five areas: vocabulary, grammar, reading, writing and American culture. The pips fill as you go, so you always know where you are.
>
> Sometimes you type a short answer. Sometimes you rebuild a sentence. Every task checks understanding, not speed."

---

## 2:30 — Culture and the final questions

*[Finish the culture items. Answer the last question, then click **See my report**.]*

> "Culture items are checked facts, with sources kept in the documentation. Stage answers, not trivia guesses. Five to nine answers per stage."

---

## 3:30 — Results

*[Point at the score, the grade, the three actions, then the folded sections.]*

> "And here is the payoff — kept short on purpose. A grade from S to D, ten points per correct answer, per stage.
>
> Five compact skill bars. A clear next step: **Next level**, replay, or main menu.
>
> Every correction, explanation, recommendation and badge is folded below. Open it only when you want the full debrief."

---

## 4:10 — Practice, achievements and next level

*[Click **Next level** to show the welcome of stage 2, then close it with **Not yet**. Open **Achievements** from the menu.]*

> "Clearing a stage unlocks the next one, and the Next level button takes the learner straight there.
>
> The report also leads to focused practice: ten exercises per skill and level, still with immediate explanations.
>
> The badges reward real behaviour — finishing a quiz, mastering a skill, beating your own best. No speed ranking."

---

## 4:35 — Closing

*[Open **Settings**; show **Reduce motion** and **High contrast**. Close it. *[cut]* Show the badge screen only.]*

> "Reduced motion, high contrast, adjustable sound — all in settings. The interface is English on every device: no translation layer, no hidden menu."

*[If Wi-Fi is on, turn it off now and reload. Let the offline banner appear; wait a few seconds.]*

> "And one last thing. We are now offline. Reload — it still works. The whole quiz is cached after one visit.
>
> No account. No analytics. No server. No microphone. Just English practice that works anywhere."

*[Smile. Stop talking.]*

---

## If something goes wrong

| Problem | Say / do |
|---|---|
| Running out of time | Skip the placement check and the practice detour; answer one item per skill and go to the report. |
| French text appears | Not expected: hard reload to discard an older cached build. |
| Wi-Fi can't be disabled | Show DevTools → Application → Service Workers: "registered and controlling". |
| Offline reload seems stuck | Wait a few seconds for cached ES modules, then say "cached modules take a moment." |
| Page goes blank | Hard reload; if still blank, start `node tools/serve.mjs --port 8080` from the project root. |

## Delivery notes

- Do **not** read the script word for word. Use the bold phrases as anchors.
- Leave two seconds of silence after each screen change; the audience needs time to look.
- Call the visual style **editorial**: it loads fast and stays readable.
- Do not apologise for the absence of a game world. Say the quiz is **deliberate**: less distraction, more practice.
- End on the offline reload if possible. It is the most memorable claim, and it is verifiable.
