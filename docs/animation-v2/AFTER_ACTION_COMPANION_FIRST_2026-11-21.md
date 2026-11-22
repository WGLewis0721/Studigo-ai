# Studigo companion-first after-action report

The local preview now introduces Studigo before the first Study Room. The same Rive character follows the learner into Home and the room, reacts to existing study events, and wears gear earned through the existing growth track. The first meeting keeps both conversation and homework optional.

| Work | Result |
| --- | --- |
| Local Rive authoring | Continuous gaze, touch reactions, additional expressions and emotes, accessories, flame growth, and five existing idle tricks. One editable Rive project and one versioned export. |
| Browser runtime | Fixed the first frame by drawing it explicitly after binding the runtime. The stable still covers initialization and failure. |
| First-run flow | Typed conversation, optional read-aloud, a gated microphone preview, and two working fixture handoffs. |
| Learning continuity | Reused the existing committed-event adapter, room placement, Calm preference, growth and outfit unlocks. The conversation has no learning authority. |
| Visual review | Corrected the accessory draw order that put goggles and sash under the skin. Captured the actual character in Chrome after the Free-tier splash. |

The [integration notes](07-integration.md) and [Chrome evidence](08-qa-evidence.md) include the exact local commands. The 390 px result comes from a Chrome touch viewport. Local conversation uses scripted responses. The signed-in AI response and microphone path require real device verification. Physical desktop, iPhone and iPad Safari and full graphics-memory cleanup remain acceptance blockers. The Free Rive export includes a splash.

The integration commit is `50eb557294aa9615c71d162a4b37d199d4076e38`. The review branch is based on the recovered companion branch. [Draft pull request 271](https://github.com/WGLewis0721/Studigo-ai/pull/271).
