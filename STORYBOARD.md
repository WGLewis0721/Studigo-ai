# Studigo waitlist product film

## Purpose

Create one polished, silent 20-second product film for the Studigo waitlist section. It must make a student feel the payoff of staying: **their own class material has become a calm, usable Study Room**. This is not a generic AI-chatbot montage and it does not include Moon Keep.

## Product truth to preserve

Studigo turns the material a student is actually expected to learn into one grounded study companion. The source material is the knowledge boundary: answers should visibly connect to an uploaded guide or source page. Show a fictional but plausible class packet and label all result UI as `Demo class material`.

## Reference grammar

Use [Khan Academy’s download/product presentation](https://www.khanacademy.org/downloads) as a **structural** reference: recognizable learning UI, then progress and device payoff. Do not copy its copy, palette, screen designs, illustration style, or music.

## Deliverable and placement

- Master: 3840 × 2160, 16:9, 20.0 seconds, 30 fps, ProRes 422 HQ.
- Web asset: 1440 × 810 H.264 MP4, muted, no voiceover, target under 8 MB; create a matching WebP poster.
- The waitlist section should autoplay only when substantially visible. It must **not loop**: freeze on the final payoff frame and expose a small replay control. Respect `prefers-reduced-motion` by showing the poster/final frame.
- Use captured Studigo UI and authentic brand tokens/fonts wherever they exist. Rebuild only transitions and deliberately fictional class content.

## Film sentence

**A student’s scattered class packet folds into one Study Room that can explain, practice, and point back to the material they were assigned.**

## Beat grid

| Time | Picture and motion | On-screen copy | Product proof |
| --- | --- | --- | --- |
| 0:00–0:02.0 | A real-looking biology review packet lands on the warm, translucent Studigo canvas. A highlighted phrase, `cell transport`, pulls a cobalt thread toward a phone. Camera is close and tactile, not stock-paper. | `Your class material, finally usable.` | Starts with student-owned material, not a prompt box. |
| 0:02.0–0:05.0 | The packet is dropped into the upload surface. Its pages stack, scan, and resolve into a Study Room title: `Cell Transport · Unit 3`. The same paper texture becomes the room background. | `Drop in the guide.` | Upload → bounded study space. |
| 0:05.0–0:08.0 | A topic map grows from the room: Diffusion, Osmosis, Active transport. One node opens smoothly; no rapid card rain. | `See what you actually need to know.` | Structured topics from the class source. |
| 0:08.0–0:11.5 | Coach answers one concise question. A small source chip expands into the actual highlighted packet passage behind the answer; it remains legible for a beat. | `Ask. Check the source.` | Grounded explanation with citation/source-page behavior. |
| 0:11.5–0:14.5 | The Coach transitions into a single practice question. The student taps `Osmosis`; the interface gives a compact correction and `Try a harder question` appears as an optional next move. | `Practice without leaving the room.` | Learn/Coach plus active practice—not passive chat. |
| 0:14.5–0:17.0 | Mastery marks update with restraint: two confident topics, one `Review next` tile. The view opens from phone to an iPad Study Room showing the same material. | `Know what to review next.` | Progress is specific, not a fake grade claim. |
| 0:17.0–0:20.0 | **Final reward.** The packet, citation, topic map, Coach, and practice tile settle into one beautiful, complete Study Room across phone and iPad. End in a held, readable composition. | `A study room built from your class.`<br>`Join the beta` | The full product promise is revealed only after the workflow. |

## Art and motion direction

- Consumer-tech, colorful, tactile, translucent; modern rather than nostalgic and mature enough for students around 14+.
- One container changes shape to become the next state. Avoid hard cuts between unrelated mockups, generic gradient washes, cursor theater, floating decorative blobs, and centered text cards.
- Establish one paper-to-interface morph in the first five seconds, then keep every subsequent object traceable to it. Let the citation highlight physically bridge source and answer.
- Type is product UI first. Marketing copy is sparse and left-aligned within the composition; no more than seven words per beat.
- Add subtle paper friction on drop, a soft confirmation tick on source reveal, and restrained UI clicks only if the section is later given sound. The web version remains effective muted.

## Required assets before animation

1. A screen capture of current Study Room/topic map, Coach answer with citation, practice question, and mastery/review state.
2. A designed fictional `Cell Transport` teacher guide with three source passages that match the shown UI.
3. Studigo logo, font files/licenses, and current color tokens from the design system.
4. Phone and iPad device frames already used by the brand; do not use an unrelated glossy 3D device pack.

## Honest-demo rules and acceptance test

- Do not imply the Coach knows facts outside the uploaded material; source chips must lead to visibly related text.
- Do not claim improved grades, perfect accuracy, or availability of an iOS app before it ships.
- No simulated user name, real school, or real student work.
- A viewer should be able to mute the film, pause at 0:19, and identify: upload material → organized topics → sourced help → practice → review plan.
- Final frame must remain readable for at least 2.5 seconds and crop cleanly at 16:9; make a separate mobile poster rather than squeezing the master.

## Implemented production treatment

The final render is a silent 20-second product walkthrough with seven workflow beats, a short Higgsfield materials transition, and a held final UI outcome. Exact UI and copy are deterministic, fixture-based reconstructions of the current components. Native 3840×2160 H.264 masters and 1440×810 web exports are produced by `scripts/film/render.py`; H.264 replaces the proposed ProRes archival format. See `scripts/film/README.md` for reproducible rendering and playback acceptance. The original waitlist form contract remains unchanged.
