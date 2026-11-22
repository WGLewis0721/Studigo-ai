# STUDIGO ANIMATION SYSTEM V2 - FINAL HANDOFF

**NOT DONE.** The local integration is available on `feat/studigo-animation-v2`. Rive is enabled by default in development. Releases opt in after acceptance.

## Open acceptance gates

| Gate | Status and action |
| --- | --- |
| 8 · Device and performance QA | Physical desktop, iPhone and iPad Safari remain blocked on device access. Run the first-meeting and room flows, all voice permission branches, and the showroom on the three required devices. Measure render resources across mounts and navigation. |
| 8 · Live provider | The local workspace has no Supabase configuration. Use a configured non-production account to validate an authenticated turn, budget enforcement, failure handling, and the actual Study Room handoff. |
| 9 · Reproduction | Run the locked install, locally verify the Rive source, and reproduce the browser journey from an isolated clean checkout. |
| 10 · Release acceptance | Review the recordings and all twelve animation principles, verify physical-device results, and accept the Rive plan's splash behavior before enabling the release flag. |

The editable source, export command, flag, and local preview are in [integration](07-integration.md). Test commands and results are in [browser and device evidence](08-qa-evidence.md). The [after-action report](AFTER_ACTION_COMPANION_FIRST_2026-11-21.md) records the work and fixes.
