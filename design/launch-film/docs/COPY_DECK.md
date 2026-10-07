# Copy deck — Round 2

Why this changed: Round 1's stacked ALL-CAPS slogans ("MAKE IT MAKE SENSE.", "ANSWERS WITH A SOURCE.") read as template marketing copy. Round 2 takes the app's own voice, which is short, plain and a bit dry: `data-say` lines on the landing page ("I read what your teacher handed out.", "Every answer shows its page.", "Hi. I'm coming with you."), companion lines in `companion-logic.ts` ("Nice.", "Ready when you are."), and real UI strings from the code.

Typography rules: sentence case; Bricolage Grotesque at a condensed optical width for display, Figtree for UI; key phrase marked like a student marks a study guide (highlighter swipe, pen underline, pen circle, pen arrow). Handwritten-feel notes use Figtree 800 in the pen colour (berry token). Notebook ruling and paper grain sit under every field. No gradient text, no glow, no all-caps headlines (all-caps appears only where the real app uses it: kickers like "LEARN · FROM YOUR MATERIALS").

| Time | Voice (scratch) | On screen | Source of the words |
|---|---|---|---|
| 0:00–3 | "Oh. You're here early." | none (wordmark on the phone) | brief |
| 3–6 | "Got a test? Hand over the study guide." | "Got a test coming up? Bring the **study guide.**" · tabs Study guides / Slides / Your notes | README: test date on a Study Room; landing: "the study guide, slides and notes you were given" |
| 6–9 | "Whatever your teacher handed out." | "Drop it in." · "Study guide, slides, even photos of handouts." · pen note "it reads all of it" · upload card "Reading, OCR'ing, and indexing…" → "Ready to study" · composer "Ask Studigo" | `materials-panel.tsx` queue strings; README upload types |
| 9–13 | "Ask me something. I'll show you the page." | "Every answer shows its **page.**" · kicker "LEARN · FROM YOUR MATERIALS" · chip "Science study guide · page 2" circled · pen note "page 2. not a guess." | landing `data-say`; `coach-panel.tsx` labels |
| 13–17 | "Stuck? Okay. One step at a time." | "Stuck? Okay." · "One step at a time." · wall of text shoved aside · "COACH · PRACTICE" card · pen notes "nobody reads this", "a nudge, not the whole answer" | `coach-panel.tsx` label; landing: "A tutor that waits for your answer." |
| 17–21 | "Your turn. Tell me how sure you are." | "Your turn." · "QUIZ · MULTIPLE CHOICE" · Melting / Evaporation / Condensation · Guessing (No real idea) / Fairly sure (Think so) / Confident (I know this) · pen note "be honest. guessing is allowed." | `quiz-panel.tsx` CONFIDENCE_LEVELS, KIND_LABELS; landing quiz sample |
| 21–25 | "Nice. You knew that one." | "You knew that **one.**" · "You just didn't trust it yet." · "CORRECT" · "✓ Your answer" · "Next question →" | `quiz-panel.tsx` blind-spot copy: "You knew that one. You just didn't trust it yet." (shown when learner rated Guessing and was right) |
| 25–27.4 | "I'm Studigo. I'm coming with you." | "Built from your class." | landing hero "built from your class"; `data-say` "Hi. I'm coming with you." |
| 27.4–30 | "Come on." | **Studigo** · "Learn your **stuff.**" | brief tagline; wordmark = Bricolage 800 with the orange LED dot |

Open questions for William: (1) the repo guide (`docs/STEADYGO_ANIMATION_VIDEO_GUIDE.md`) names the dragon "SteadyGo" while the brief and the in-app copy say Studigo. The VO says "I'm Studigo" per the brief. Confirm. (2) "Learn your stuff." is from the brief, not found in the repo. Confirm as the tagline.
