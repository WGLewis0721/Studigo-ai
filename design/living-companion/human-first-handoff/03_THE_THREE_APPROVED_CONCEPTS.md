# The three approved visual concepts

All three are **rendered concept films**. They show intended movement, not actual application recordings. URLs may expire; preserving verified copies and hashes is a separate LC-0 task.

## V1 — Living Studigo (character-only demonstration)

**Video:** https://d8j0ntlcm91z4.cloudfront.net/user_3IkKBBXHZvEZQt2d8pBaRYd083T/hf_20261015_163130_6647ad5b-1046-436d-85a2-f420df05c498.mp4

**Approved response:** “looks good.”  **Format:** 12 seconds, 16:9, silent. Original full-body `apps/web/public/mascot/companion/full/center.webp` used to anchor identity.

A rough beat-by-beat reading:

- **0–2.5 seconds:** natural breathing, blinking, gentle tail-flame life.
- **2.5–4.7 seconds:** a subtle pointer target passes; eyes move first, head follows, frills lag.
- **4.7–6.8 seconds:** head petting; happy eye close, small lean/body compression, gentle settle.
- **6.8–9 seconds:** focused, curious attention; kind head tilt, thoughtful blink.
- **9–12 seconds:** a restrained celebration with anticipation, little hop/paw gesture, tail lag and soft landing.

What matters: the character must feel **continuously alive**, not as if swapping between illustrations.

## V2 — Floating repositionable dock

**Final approved video:** https://d2ol7oe51mr4n9.cloudfront.net/user_3IkKBBXHZvEZQt2d8pBaRYd083T/868d115b-2c32-43ec-b409-3bca35fd1c8d.mp4

**Approved response (with V3):** “yep I like it. thats exactly it.” **Format:** 12 seconds.

The entire framed window is picked up and relocated to a new place while the dragon continues to blink, track activity and react **inside**. The film's drag motion was polished after initial generation so the rigid panel's repositioning was obvious. In code, this means translating the complete dock component, not transforming the mascot image alone. The dock must remember the location and move out of the way of active controls. The concept's recreated Study Room is not a replacement UI specification.

## V3 — Fixed companion strip

**Final approved video:** https://d8j0ntlcm91z4.cloudfront.net/user_3IkKBBXHZvEZQt2d8pBaRYd083T/hf_20261015_174105_32b24696-7b5c-4407-bcd0-3f8d622575ce.mp4

**Approved response (with V2):** “yep I like it. thats exactly it.” **Format:** 12 seconds.

Studigo is waist-up in a **nonfloating strip immediately below top Study Room navigation and above the page's colored rail**. He breathes, blinks, follows activity below with pupils/head, gives modest supportive or celebratory gestures and remains anchored when the learning content scrolls. The strip retains Phase 3 scaling/tucking behavior and should not steal the phone's composer space. The dragon must remain contained and never push the colored divider out of position.

## Distinguishing rule

The two UI modes share **one** character controller and identical study-event semantics. The floating one gets larger movement and a relocatable frame; the fixed one gets restrained internal movement and a stationary frame. Neither concept authorizes duplicating the mascot, adding wings, changing typography/navigation, or rebuilding the app.

## Media provenance

Kling 3.0 Pro was used for the prior generation. Product video is not source code. The REA evidence provides engineering ideas; visual fidelity must be proven against canonical mascot art. The three cloud video URLs are also listed in the current LC asset manifest on the foundation branch.
