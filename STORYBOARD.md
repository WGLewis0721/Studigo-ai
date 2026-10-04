# Studigo — Waitlist Promo Video Storyboard

Replaces the current 4s silent Higgsfield loop in the homepage waitlist section (`apps/web/components/home/waitlist.tsx`). Target: a warm, confidence-building cutdown — the feeling of a student finally *getting it*, not a feature tour of an LMS.

## The one thing this video proves

**Give Studigo your own class materials, and it becomes a tutor that actually knows your class — not the internet's idea of your class.** The emotional arc is: overwhelmed → grounded → understood. The reward is the moment a real, cited answer appears from the student's *own* uploaded page, and mastery visibly moves. Warm and personal — a "companion," not an admin panel (per `AGENTS.md`'s own UX discipline: optimize every screen around "what do I need to know, do I understand it, what should I practice next?").

Tone: warm, calm, encouraging. Soft light, handwriting/paper texture mixed with clean digital UI. Never clinical, never gamified-to-the-point-of-childish — this spans a student studying for a real test.

## Production note (read first)

Generative video cannot render legible study material, citations, or quiz text. **Split the work:**

- **Real screen capture** for every shot showing an actual upload, a cited answer, a flashcard, or the mastery ring — these must be legible and true to the product.
- **Higgsfield-generated b-roll** only for atmosphere: the opening "scattered materials" chaos-to-order motion, soft bokeh/light sweeps, and the paper-grain texture behind title cards.
- Composite in an editor; don't let generated video stand in for real UI.

## Reference videos

1. **Duolingo app-store/ad reels** — the streak/mastery payoff moment, confetti-adjacent but still tasteful, clear "you did it" beat. Borrow: the mastery-ring-filling payoff structure, not the owl mascot energy.
2. **Khan Academy / Khanmigo tutor demos** — a student asks a confused question, gets a patient, specific, sourced answer on screen. Borrow: the "confused → clarified" two-shot structure almost verbatim — it's Studigo's exact Coach loop.
3. **Quizlet flashcard promo spots** — fast, satisfying card-flip rhythm, bright and energetic without being juvenile. Borrow: the flashcard flip timing/easing for the Practice scene.
4. **Notion AI product videos** — calm, confident, "it already knows your stuff" messaging, clean typography over soft gradients. Borrow: the restrained, grown-up tone — Studigo serves high schoolers through adults, not just kids.
5. **Headspace brand films** — soft color washes, gentle camera drift, breathing room between beats, warm voiceover-adjacent pacing even when silent. Borrow: the calm pacing and soft light treatment for the opening "overwhelmed" beat, so it reads as empathy, not stress.

## Spec sheet

- Length: 18–22s hero cut; seamless 4–6s loop cutdown for the homepage slot.
- Resolution: 1920×1080 min, H.264 mp4 + webp poster matching `apps/web/public/waitlist/studigo-*` naming.
- No voiceover; captions/on-screen text only.
- Palette/type: pull from the "Personal Learning Device" design system (`docs/DESIGN_SYSTEM.md`) and existing `apps/web/app/waitlist.css` — do not invent a new look.
- Texture: a little paper/handwriting grain is appropriate (the product literally starts from physical study materials) but should resolve into clean digital UI — that transition *is* the story.
- Loop seam: end on the same soft-light empty-desk composition the video opens on.

## Storyboard

| # | Time | Visual | Motion / camera | On-screen text | Why |
|---|---|---|---|---|---|
| 1 | 0:00–0:03 | Overhead/desk-level shot: a scattered pile — textbook, handwritten notes, a worksheet, a laptop closed — warm desk-lamp light | Slow, slightly handheld drift, soft focus pull | — | The real, relatable "before" state — overwhelmed, not dramatized |
| 2 | 0:03–0:06 | Real screen capture: the materials get dragged/dropped into a Study Room upload zone (actual product UI) | Cut to clean digital frame; drag gesture is a real captured interaction | small label: "Your study guide. Your notes. Your textbook." | Grounds the fantasy-to-real transition — this is the product's actual first step |
| 3 | 0:06–0:09 | Higgsfield b-roll: the scattered paper textures from Scene 1 dissolve/reassemble into soft glowing nodes forming a connected map shape (standing for the topic map) | Gentle morph/dissolve transition, warm light | — | Visual metaphor for "your materials become a structured topic map" — abstract, not literal UI |
| 4 | 0:09–0:13 | Real screen capture: a student types a confused, casual question ("wait why does this work") into Coach; a beat; a cited answer streams in with a small page-citation chip that's clearly clickable | Camera holds on the chat, text streams at real app speed (don't speed-ramp into illegibility) | — | This is Studigo's actual core promise — grounded, cited, patient |
| 5 | 0:13–0:16 | Real screen capture: quick cut to Flashcards/Quiz — 2–3 fast card flips, one correct answer registers | Quick, punchy cuts timed to card-flip snaps (Quizlet-style rhythm) | — | Shows the range of the product in a few beats without slowing the pace |
| 6 | 0:16–0:19 (**the reward**) | Real screen capture: the mastery ring on the Progress page animates filling from a low value up to a strong, confident number, with a soft warm glow as it completes | Ring fill is the hero motion — ease into a satisfying stop, soft bloom of light on completion | **"Real materials. Real answers. Real progress."** | The reward is *earned mastery made visible* — the emotional payoff of the whole video, echoing Duolingo's payoff structure but grounded in an actual metric the product computes from real practice |
| 7 | 0:19–0:22 | Settle on Studigo wordmark over a soft warm gradient (same palette as Scene 1's desk light) | Static hold, gentle breathing-room pacing | **"Bring what you're learning. Join the beta."** | Matches the live CTA; echoes opening desk-lamp warmth for the loop seam |

## Reward design note

The ring-fill in Scene 6 is the whole video's reason for existing — it must feel *earned*, tied to the specific cited answer and flashcard flips the viewer just watched, not a generic progress bar. If budget allows only one "polish pass," spend it there: soft bloom, a tiny satisfying chime-adjacent visual pulse (no audio needed, but the motion should imply one).

## Higgsfield production guidance

- Use **generate_video** for Scene 3's paper-to-node-map morph only — prompt for "scattered paper and handwritten note textures gently dissolving into soft glowing connected light nodes, warm desk-lamp color palette, no text, no logos, calm slow motion."
- Do not attempt to generate the Coach chat text, citations, or flashcard content — these must be real captures to stay accurate and legible.
- The desk-lamp opening (Scene 1) can be either a real staged shot or Higgsfield b-roll of a generic desk/lamp/paper scene — either works since no product UI is on screen yet.
