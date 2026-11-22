# Studigo animation principles

Use Frank Thomas and Ollie Johnston's principles to review the performance at playback speed, on the same Rive artboard used in Studigo. The frame captures help identify what happened. They cannot settle whether an expression reads or whether the timing feels right. [Toon Boom reference](https://helpcentre.toonboom.com/hc/en-ca/articles/57087608774931-About-the-12-Principles-of-Animation).

| Principle | What to look for in Studigo | Current evidence and open check |
| --- | --- | --- |
| Squash and stretch | The jump compresses before takeoff and on landing. The belly keeps its apparent volume and the feet reconnect cleanly. | The intent clip has anticipation and an arc. Volume and landing squash still need a live comparison. |
| Anticipation | Eyes acknowledge the target promptly. Head and body prepare for a turn or hop without delaying the first touch response. | The showroom includes the eye-leading and jump sequences. Input-to-visible response timing is still open on physical devices. |
| Staging | Read the expression with audio off at dock size. Keep learning controls clear of the actor. | Chrome captured the [portrait](evidence/phase7/first-meeting-chromium.png), [390 px touch viewport](evidence/phase7/first-meeting-390px-chromium.png), [floating window](evidence/phase7/study-room-chromium.png) and [header strip](evidence/phase7/study-strip-chromium.png). |
| Straight ahead and pose to pose | Author readable key poses for a hop and a release. Let flame and breath move continuously underneath. | One skinned surface with separate idle and intent layers. |
| Follow-through and overlap | The head follows the eyes. The frills, tail, and flame settle in sequence. | The gaze controls drive distinct eye, neck and frill interpolation curves. The showroom exposes a diagonal retargeting sequence for review. |
| Slow in and slow out | Use soft arrival for a look or a nuzzle, brisk onset for surprise, and a smooth recovery. | Idle tracks use easing curves and the intent layer mixes from the current pose. Compare different gesture timings in the browser. |
| Arcs | Turn from the neck, swing from the shoulder, hop from planted feet. | Pivot map and joint inspection, plus the airborne interruption frames. |
| Secondary action | Flame, tail, blink and paw movement support the face. | Tail/flame overlap is visible in idle. Check petting at dock and close-up sizes. |
| Timing | Make listening calm, surprise fast, and encouragement gentler than success. | [Behavior timings](05-behaviors.md) and recorded pose sequence. Direct input latency and emotion readability remain open. |
| Exaggeration | A clear reaction can be larger than idle while remaining recognizably Studigo. | Existing shelf contains restrained reactions. A reviewer must confirm surprise and pride read without labels. |
| Solid drawing | Eyes and snout stay attached. Frills, vest silhouette, and limb proportions survive the full supported range. | Bind and 12-joint inspection, plus the [outfit and emote contact sheet](evidence/phase7/outfit-contact-sheet.png). Motion at extreme gaze angles with all outfits is a remaining visual check. |
| Appeal | A learner can tell when he notices them and can predict how to play with him. | [Higgsfield comparison and idle capture](03-idle.md) and the [companion-first browser journey](08-qa-evidence.md). Learner review remains open. |

## Review each major animation

Record the clip or command, size, device, and timecodes. Mark applicable checks explicitly.

- [ ] The face reads and the staging leaves controls available.
- [ ] The anticipation, arc, easing, timing, and exaggeration suit the action.
- [ ] Squash and stretch preserve volume where used.
- [ ] Follow-through and secondary actions support the lead movement.
- [ ] Anatomy and silhouette hold without detached features, duplicate faces, or snaps.
- [ ] An input change interrupts cleanly and returns naturally.
- [ ] Review at actual speed confirms the personality and emotional intent.

Current recorded baselines are [idle](03-idle.md), [transitions](04-transitions.md), and [behaviors](05-behaviors.md). Review the exact application asset again when live touch, voice, or growth changes its output.
