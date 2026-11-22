# Phase 4 — Fluid transitions

**PASS · 2026-11-21.** The `Studigo Motion` machine keeps the nine-second idle in its own layer. The intent layer adds neck translation, neck rotation and vertical root lift. All intent timelines key the same four properties so the outgoing and incoming states can mix. The neck pivot is at the collar. Its offset leaves the Gate 2 bind coordinates and idle tracks intact.

`intent` on `Studigo Controls` selects 0 neutral, 1 left, 2 right, 3 up, 4 down, 5 listening, 6 thinking, 7 reading, 8 happy or 9 celebrating. The Rive machine blends to each target over 130–220 ms, with early exit enabled. The idle remains active through interruption and return. `mode=1` disables intent for rig inspection. `mode=2` immediately selects the static neutral and disables intent, including during an airborne frame.

## Validation

- Rive 1.10.0 `--verify` and `inspect --summary` compiled with no errors, warnings or inspect problems. [Nine intent poses](evidence/phase4/intent-poses.jpg) show each target sampled from a fresh idle instance.
- [Interruption sequence](evidence/phase4/transition-review.jpg), reading order: neutral, left at 5 ticks, right at 1/5/19 ticks, jump at 25 ticks, listening interruption at 1/6/18 ticks, idle return, and two static reduced-motion captures. On the midair interruption the lower silhouette changed from y=498 to y=499 on the next capture. The sightline reversal stayed between the two endpoint positions. No portrait replacement or empty frame occurred.
- Changing to reduced motion from the jump returned to an image with zero pixel difference against the neutral capture on the next tick.

The local export is 68,532 bytes, SHA-256 `9539e02cf84baf0a0208162c865ca7bb679f4d30a97d9e5715f11a0095d8535f` at this gate. The next gate adds the complete behavior set, including explicit timing and priority.
