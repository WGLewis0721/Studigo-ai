# Studigo Coaching Knowledge Base

This directory is the canonical research-backed knowledge base for the choices exposed by the Coach UI in `apps/web/components/room/coach-panel.tsx`.

It contains only:

- coaching methods;
- learning/teaching traditions;
- practice recipes.

It does **not** contain general study techniques such as Pomodoro, highlighting, spaced repetition, or generic memorization advice.

## Retrieval contract

Every method lives in one Markdown file with YAML front matter. A Python script can:

1. `glob("docs/coaching-kb/**/*.md")`;
2. ignore `README.md` and `SCHEMA.md`;
3. parse YAML front matter;
4. select by `ui_id`, `category`, `canonical_paradigm`, subject tags, or use-case tags;
5. retrieve the Markdown body for explanation/examples/sources.

The `ui_id` field deliberately matches the IDs currently sent by the Coach UI.

## Categories

- `coaching_method` — how Studigo should interact during instruction.
- `learning_tradition` — a broader educational tradition or system that shapes the lesson.
- `practice_recipe` — how Studigo should select and sequence practice.

## Alignment status

- `canonical` — the UI label closely names a recognized method.
- `aligned` — the UI label is product language but maps cleanly to an established paradigm.
- `composite` — Studigo combines multiple established practices.
- `product_policy` — a Studigo constraint with a real-world analogue, but not itself a named teaching tradition.
- `partial_alignment` — some current prompt behavior matches the cited tradition and some does not.

## Current map

| UI ID | UI label | Category | Closest established paradigm | Alignment |
| --- | --- | --- | --- | --- |
| default | Studigo default | coaching_method | Explicit instruction + guided practice + formative adjustment | composite |
| direct | Direct instruction | coaching_method | Explicit instruction / Rosenshine-style instruction | aligned |
| drill | Deliberate practice | coaching_method | Deliberate practice | canonical |
| socratic | Socratic coach | coaching_method | Socratic questioning / dialogic probing | canonical |
| progression | Skill progression | coaching_method | Task analysis + scaffolding + gradual release | composite |
| visual | Concrete to abstract | coaching_method | Concrete-Representational-Abstract / Concrete-Pictorial-Abstract | aligned |
| tradition-default | Teacher's method | learning_tradition | Curriculum fidelity + constructive alignment | product_policy |
| tradition-japanese | Japanese-inspired | learning_tradition | Japanese structured problem solving | partial_alignment |
| tradition-swedish | Swedish-inspired | learning_tradition | Learner agency, responsibility, critical thinking in Swedish curriculum | aligned |
| tradition-singapore | Singapore Math-inspired | learning_tradition | Singapore CPA + mathematical problem solving | aligned |
| tradition-montessori | Montessori-inspired | learning_tradition | Montessori prepared environment / freedom within limits / control of error | aligned |
| adaptive | Best next practice | practice_recipe | Formative assessment / adaptive next-step instruction | aligned |
| repetition | Focused repetition | practice_recipe | Goal-directed practice for fluency/automaticity | aligned |
| transfer | Transfer practice | practice_recipe | Varied practice for transfer/generalization | aligned |

## Design rule

The research tells Studigo **how to teach**, not what facts are true. Uploaded teacher/course material remains the knowledge boundary. A coaching method must never override teacher terminology, scope, or source-grounding rules.
