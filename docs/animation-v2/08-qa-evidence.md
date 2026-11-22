# Browser and device evidence

Run the recorded checks from the repo root while the development server is running on port 3328.

```powershell
$env:STUDIGO_QA_BASE = 'http://127.0.0.1:3328'
$env:STUDIGO_QA_EVIDENCE = 'docs/animation-v2/evidence/phase7'
node scripts/living-companion/studigo-v2-journey-qa.mjs
node scripts/living-companion/studigo-v2-showroom-qa.mjs --stress
```

Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a local Chrome executable for the installed desktop test. Without it, the scripts use Playwright Chromium.

On this Windows host, the first compile of `/dev/study?mode=coach&shell=1` in an isolated checkout exceeded the browser test timeout. Open that route once and wait for the page before starting the timed journey from a cold development server.

| Check | Evidence |
| --- | --- |
| Desktop Chrome | The showroom requires painted orange character pixels after the Rive splash before testing animation. It exercises direct touch, keyboard, reduced motion, cosmetics, multiple instances, repeated mounts, missing assets, and an injected context-loss notification. |
| 60-second idle and 100 transitions | [Chrome measurements](evidence/phase7/chromium-metrics.json). The final Rive export produced a 16.8 ms p95 browser frame interval, seven intervals above 33.5 ms, and 117 distinct canvas samples in 60 seconds. The 100 state requests took 10.3 seconds. JS heap was 19.5 MB before and 23.4 MB after five mounting cycles. These snapshots exclude GPU and WASM memory. |
| Cosmetics and expressions | [Runtime goggles and flame](evidence/phase7/outfit-and-flame.png) and [Rive contact sheet](evidence/phase7/outfit-contact-sheet.png). The local export embeds seven independent outfit images. |
| Journey | [First meeting](evidence/phase7/first-meeting-chromium.png), [390 px emulated touch viewport](evidence/phase7/first-meeting-390px-chromium.png), [room window](evidence/phase7/study-room-chromium.png) and [room strip](evidence/phase7/study-strip-chromium.png). The fixture contains synthetic study data. The committed-event hook verifies that the existing growth rule is still applied. |
| Desktop Safari, iPhone Safari and iPad Safari | BLOCKED. This Windows workspace has no physical Apple devices or Safari session. Run both journeys and the showroom on all three and record the phone's real input, browser audio, render failures, and pacing. |
| Authenticated and physical microphone conversation | Pending. The workspace has no Supabase configuration for signed-in model calls. Exercise admission and provider responses in a configured non-production account. Confirm mic permission granted, declined and unsupported behavior, transcript review, and read-aloud on physical browsers. |

The room test injects committed events through the existing development hook. A passing fixture does not certify provider access, actual graded requests or an authenticated room write. Full GPU resource and physical thermal measurements remain open.

The clean checkout at `50eb557` passed the locked install, TypeScript, the Chrome showroom and the Chrome journey after warming the Study Room route. Rive CLI 1.10.0 regenerated the exact 122,802-byte runtime file with SHA-256 `f2d669f7e40467860af4443555d212ddacb346a715be965818ec462964199b60`.
