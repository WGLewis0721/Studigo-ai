# Studigo Animation V2 after-action report

**NOT DONE.** Gates 0–5 passed. This checkpoint includes the Gate 6 React work and its unresolved browser check. The dedicated branch is `feat/studigo-animation-v2`.

## Where the work lives

- [Editable Rive project](../../design/living-companion/rive/studigo/scene.rml) and [CLI project settings](../../design/living-companion/rive/studigo/rive.yaml). Open the project from the repository root with `rive design/living-companion/rive/studigo`. Add `--data=mode=1` for joint inspection or `--data=intent=9` for celebration.
- [Runtime export](../../apps/web/public/mascot/rive/studigo.riv). The CLI built it locally. No Rive workspace file was created. The Free-tier splash remains on the exported file.
- [React component](../../apps/web/components/companion/StudigoCharacter.tsx), [controller](../../apps/web/components/companion/studigo-controller.ts), and [browser surface](../../apps/web/components/companion/studigo-surface.ts). The development showroom is at `/dev/studigo`, accessible when the Next dev server runs from this worktree. The Study Room, Home, and onboarding still use their existing renderers.
- Idle recordings are kept locally outside git; see [Stage A in 03-idle.md](03-idle.md) for stills, a GIF and SHA-256 values.

## What was completed and checked

| Gate | Result | Checkpoint |
| --- | --- | --- |
| 0 · Recovery | Recovered Claude's two untracked defect sheets. Established the continuation point, verified the branch, and preserved the legacy rollback paths. | `8777234` |
| 1 · Identity | Verified SHA-256 for all three original Higgsfield films. Reviewed 289 V1 frames and locked the character's reference geometry. | `69a9a18` |
| 2 · Rig | Connected one skinned surface to the editable Rive bone hierarchy. Checked 12 joint poses and the exact return to bind. | `561cc26` |
| 3 · Idle | Verified a seamless nine-second loop, five exact cycle boundaries, 60 seconds of continuous simulated playback, two viewport sizes, and a static reduced-motion pose. | `2927106` |
| 4 · Transitions | Rendered all nine intent targets and tested interruption during gaze reversal and midair. Reduced motion recovered the exact neutral on the next tick. | `b5de0ce` |
| 5 · Behaviors | Rendered the added behaviors and a combined sequence. Five deterministic tests passed for event mapping, priority, expiry, wake, and gaze. | `02f6b67` |
| 6 · Reusable component | Added the component, controller, and same-origin WebAssembly route. Web typecheck and behavior tests passed. Chromium first-frame check timed out, so Gate 6 is open. | This report's commit |

## Where the work stopped

The standalone Rive CLI render works. The browser dependency and asset were served in local diagnostics. The first showroom image was blank when readiness was marked on load, so the component now keeps the still until the runtime reports its first draw. The browser acceptance test still times out at that step. That leaves browser idle, input, reduced motion, multiple instances, cleanup and failure recovery unverified.

The next exact action is to instrument the Rive instance's load, advance and draw callbacks, confirm that the model and canvas are being painted, and make the [Chromium QA script](../../scripts/living-companion/studigo-v2-showroom-qa.mjs) pass. Then adapt existing app hosts, exercise the outfit and growth options, finish the device matrix, and reproduce from a clean checkout. Desktop Safari, iPhone Safari and iPad Safari need access to those devices. Nothing has merged to main or deployed.
