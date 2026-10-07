# Claim sheet — Round 1 (inspected main @ 2e75006, landing page fetched 2026-10-07)

Status: LIVE = copy/behavior verified in repo or on studigo-ai.vercel.app. UNVERIFIED = not yet seen in an authenticated session.

| On-screen claim | UI state that proves it | Status |
|---|---|---|
| "Your material." — learner brings study guide, slides, notes | Landing hero: "Drop in the study guide, slides and notes you were given." Source chips Study guides / Slides / Your notes | LIVE (landing copy) |
| Study Room with Learn / Coach / Quiz / Flashcards | `apps/web/app/page.tsx` mode list; landing "Coach, Learn, Quiz, Flashcards." | LIVE (landing + code) |
| Answer with source reference ("Science study guide · page 2") | Landing Learn demo + `msTicket` chip; "Every answer comes with the page it came from." | LIVE (landing demo). Authenticated flow UNVERIFIED |
| Coach asks, waits for the learner (hint + guiding question) | Landing: "A tutor that waits for your answer." | LIVE (concept). Exact hint wording in film is ILLUSTRATIVE |
| Quiz: "A liquid changes into a gas" → Melting / Evaporation / Condensation | Landing Quiz demo | LIVE (landing demo) |
| Quiz confidence rating (Guessing / Fairly sure / Confident) | Landing: "Say how sure you are." | LIVE but NOT shown in Round 1 cut — decide in Round 2 |
| Result "Exactly." + explanation | Landing Coach sample reply "Exactly. You can freeze it back into ice." | Wording ILLUSTRATIVE; verify against `quiz-panel.tsx` feedback state |
| "NOT IN YOUR MATERIALS / Studigo won't guess" | Landing evidence section | LIVE; candidate for Round 2 trust beat |
| Progress / readiness / mastery % | — | NOT SHOWN. Unverified; never invent |
| Coins, rewards, evolution, game carryover | — | NOT SHOWN (not in release) |

Open: the water-cycle sample in the brief is replaced by the app's own change-of-state sample ("evaporation") so every shot matches landing-page demo content. The answer sentence "Evaporation is when a liquid changes into a gas…" is paraphrased demo content, not a recorded session.
