# Approved Higgsfield motion reference

Higgsfield supplies reference footage and already approved art. Rive supplies the editable movement. The V1 film remains a reference asset and is excluded from the character runtime.

## Provenance and reproducibility

All three recovered files are in `design/living-companion/workspace/references/approved-concept-videos/` of the foundation worktree. The filenames, URLs, and approval history are in the [asset manifest](../../design/living-companion/assets/ASSET_MANIFEST.md). Restore the archive with `python scripts/living-companion/prepare_workspace.py --videos` and verify hashes with `Get-FileHash`. The ignored archive on this machine is a recovery source if the URLs expire.

| Original | Bytes | SHA-256 |
| --- | ---: | --- |
| `studigo-character-concept.mp4` | 15755703 | `a34b444eccc9e0e36cfe747b4b4e1d37f6fa4ea7fcd15a0ce46f30f322232a37` |
| `studigo-floating-dock-concept.mp4` | 752554 | `7e3010798a7d98e36681992ffcc58f7a49ea67376c2aaebd3f6d6afcfe8606d3` |
| `studigo-fixed-strip-concept.mp4` | 8281714 | `6dc5a8fb40ce8fa3ab792f8a07524816ae0bbf5a12d2bd410a435249af2ef84d` |

V1 is a 1440 × 1440, 24 fps H.264 film, 289 frames and 12.042 seconds. FFmpeg extracted all source frames into four consecutive contact sheets, 96 thumbnails per sheet. [Review sheet](evidence/phase1/higgsfield-v1-beats.jpg) shows every twelfth source frame in reading order, from 0 to 12 seconds. V2 and V3 were checksum verified. Their movement was outside this character analysis.

## Frame observations and transfer

Times below are approximate observations from the extracted frames. The approval manifest describes intended beats, with broader and later boundaries in some cases.

| Source interval | Visible movement | Rive transfer |
| --- | --- | --- |
| 0–0.8 s (0–19) | Forward planted stance, small chest motion and warm flame flicker. Both lids close and reopen around 0.55–0.8 s. | Retain the planted soles and quiet vertical chest expansion. Blink quickly on the close and let the opening ease out. Tail and flame have their own phase. |
| 0.8–2.8 s (19–67) | Sparkle appears on the viewer's left, rises, and crosses. The pupils aim first, then the muzzle rises and turns, while the hips remain supported. | Small gaze lead, eased neck follow and a slight later torso adjustment. Keep the near/far eyes in one face and floor contact stable. |
| 2.8–5.3 s (67–127) | Gaze settles toward screen right, mouth briefly parts, forearms drift away from the vest. The rightward look holds as the sparkle slows. | Reuse gentle anticipation and neutral settle. Avoid long holds where pupils, head, flame and chest all stop together. |
| 5.3–7.4 s (127–178) | Eyes close in a smile, chin lowers, hands draw toward the vest and tail curls before returning. The eyelids reopen before the body returns to its rest. | Let touch drive the long eye closure in a later phase. Keep arm and tail motion behind the head change and ease both softly back. |
| 7.4–9.6 s (178–230) | Brief head and eye adjustment, small blink around 8.7–8.9 s, then a low crouch starts around 9.6 s. | Reuse the small curious head tip in idle. Keep the crouch as anticipation for a distinct success reaction. |
| 9.6–12.04 s (230–288) | Deep crouch around 9.9–10.1 s, extension around 10.2, airborne around 10.3–10.7, foot contact and compress around 10.7–10.9 s, then raised fist and tail settle. | Drive the jump with the pelvis and planted feet before lift-off. Offset arm rise, tail recoil and head settle. Use a clean landing with one small recovery and release back to idle. |

The footage starts with a blocky halo at the silhouette, adds a floor and foreground shapes, and sometimes changes frill shape, apparent spike placement, muzzle volume or embroidery. The jumping section also stretches feet and changes the flame's outline sharply. Preserve the timing and expression arcs while keeping the approved neutral geometry and permanent component attachments. The V1 comparison for the first idle render should show the source excerpt and the reconstruction side by side with the same framing and time labels.
