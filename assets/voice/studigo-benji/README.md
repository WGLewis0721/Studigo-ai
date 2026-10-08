# Studigo voice: Benji (Eleven v4)

The voice chosen for the Studigo launch film, 2026-10-08. Preset voice **Benji** on Higgsfield, generated with
`elevenlabs_v4`, `stability 0.3`. Voice id `e6f9b893-51b1-51d3-afe9-9e0482cb7ac1`, `voice_type preset`.

Direction: a confident, bold, warm, ready 10 to 12 year old, in the spirit of (not a copy of) a fast, cocky
cartoon hero. No laughs, giggles or nervous tags: the emotion tags in the text carry the delivery.

- `take-B/` is the take the film uses: bigger and brighter. Most lines sit around 170 to 340 Hz.
- `take-A/` is the calmer take. A few lines (07, 10, 05b) land low, around 130 to 150 Hz, and sound older.
- `reel-take-A.wav` / `reel-take-B.wav` are all 14 lines in script order with 0.7 s gaps, for listening.

Both takes were approved as good by William; the film goes with B. Only measured here (pitch, pace), not heard by me.

| Cue | Take A text | Take A job | Take B text | Take B job |
|---|---|---|---|---|
| 01 | `[surprised] Oh! [confident] You're here early!` | `3723134f-46ee-4a43-b81c-078c6c65c162` | `[gasps] Oh! [excited] You're here early!` | `585dea89-6258-4356-b290-043bc11c6b2a` |
| 02 | `[excited] Got a test? [confident] Hand over the study guide!` | `ac27c384-f9be-4a77-847c-72e4f7855747` | `[energetic] Got a test? [bold] Hand over the study guide!` | `a1d541cc-e963-44bd-b546-6bdfe7b1e419` |
| 03 | `[warm] Whatever your teacher handed out. [confident] I've got it.` | `b9a6b178-d1c8-4652-93bb-1ad8f045123b` | `[bold] Whatever your teacher handed out. [warm] Bring it on.` | `9a378ff8-bb0e-4f4b-8eb1-844910022423` |
| 04a | `[excited] Ask me something!` | `2af8431e-66cf-4460-99e7-5498df090f65` | `[energetic] Ask me something!` | `94666ef6-9e8e-40f7-a40a-3d92ea354853` |
| 04b | `[confident] I'll show you the page.` | `03a12911-c189-45a4-801e-17baf6bb3877` | `[bold] I'll show you the page!` | `b242a96d-c85c-4242-bcd2-188c9a41bc89` |
| 05a | `[reassuring] Stuck? Okay.` | `c513441b-d401-475e-8a0c-a2730067a327` | `[calm and sure] Stuck? Okay.` | `74f2eee3-af0b-4b0e-865f-91bf1434351c` |
| 05b | `[warm] One step at a time.` | `f823432e-16c7-47aa-bee7-f5b9525442f1` | `[encouraging] One step at a time.` | `91718658-3ab1-4f28-81bd-44e6c00d8818` |
| 06a | `[excited] Your turn!` | `d7781626-2dd5-4633-8541-967441c1b31f` | `[energetic] Your turn!` | `b091dd46-4e7f-4d14-a6aa-10979e2d24f5` |
| 06b | `[confident] Tell me how sure you are.` | `b7a09f05-1267-4ef2-a3e7-cfd93d010ec0` | `[bold] Tell me how sure you are!` | `45698e91-ddd1-4f44-8f64-69cf5461d85c` |
| 07 | `[proud] Nice!` | `b9012278-68d9-4a83-b302-293ed805bfd2` | `[delighted] Nice.` | `1c91a8ff-e29a-4ff7-bf59-d03ef18f1fd9` |
| 08 | `[excited] You knew that one!` | `dba984df-87e7-42d7-aff9-ca268a30f8e4` | `[shouting with joy] You knew that one!` | `0dd20464-4efa-48b9-a742-57239eb5bdd0` |
| 09 | `[bold] I'm Studigo.` | `b6690db6-9b64-4df4-b11a-ea3c498278c9` | `[proud and warm] I'm Studigo.` | `adf0f5e8-947b-4cb7-b2a8-bb84d6b76b9b` |
| 10 | `[warm] I'm coming with you.` | `c4f96cae-bc04-4ba8-ab1c-c60912d9b5ad` | `[bold] I'm coming with you!` | `5804b233-1285-42a1-a8a0-be21ed899a6c` |
| 11 | `[confident] Come on!` | `ffb8e16a-e248-4b8b-be7f-d797ecaca5e3` | `[energetic] Come on!` | `ab2dda18-9193-467b-b95f-089ddcb23c39` |

To make more in this voice:

```bash
higgsfield generate create elevenlabs_v4 --stability 0.3   --dialogue '[{"text":"[bold] I am Studigo.","voice_id":"e6f9b893-51b1-51d3-afe9-9e0482cb7ac1","voice_type":"preset"}]'
```

Re-download any clip free with `higgsfield generate get <job id>`. Files here are the originals (mp3, about 44 kHz).
Higgsfield says users own outputs and may use them commercially; the Terms (sections 4.3 to 4.4) were not read in full.
The voice is a stock preset, so others can use the same voice.

Note: `take-B/B_03.mp3` includes a second phrase, "Bring it on.", that is not in the script. The film cuts it off (after about 2.0 s).
