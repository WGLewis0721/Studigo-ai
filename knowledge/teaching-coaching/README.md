---
kb_schema_version: 1
kb_name: studigo_teaching_coaching
record_format: markdown_with_yaml_frontmatter
source_of_ui_taxonomy: apps/web/components/room/coach-panel.tsx
updated: 2026-09-23
---

# Studigo Teaching & Coaching Knowledge Base

This knowledge base is derived from the **actual Coach controls in the codebase**:

- Coaching style: `STYLES`
- Learning tradition: `TRADITIONS`
- Practice recipe: `PRACTICE_PROTOCOLS`

It does not contain generic study tips. Each record starts from Studigo's current UI definition, then maps that definition to the closest documented real-world teaching/coaching paradigm.

## Classification rules

Each record has one `alignment_type`:

- `canonical_match`: the Studigo option closely matches an established named method.
- `composite`: the option combines elements from more than one established method.
- `curriculum_values_composite`: the option is based on values/principles found in an education system rather than one named teaching method.
- `product_policy`: the option is a Studigo behavior rule rather than an external teaching tradition.

`match_strength` is about fidelity between the **current code definition** and the cited paradigm. It is not an effectiveness rating.

## Retrieval contract

A Python or other deterministic retriever can:

1. Parse YAML front matter.
2. Filter first by `ui_dimension` and `ui_id`.
3. Use `canonical_paradigms`, `best_for`, `avoid_when`, and `retrieval_tags` for routing.
4. Chunk the body on `##` headings.
5. Retrieve `## Current Studigo definition` when reconstructing current product behavior.
6. Retrieve `## Real-world alignment` and `## Sources` when explaining why the behavior exists.
7. Prefer `## Recommended coaching rules` when generating a system directive from the knowledge base.

Do not infer that a country-labelled option is a universal national teaching method. The Japanese- and Swedish-inspired options are explicitly marked where the current code is a composite or only partially aligned.

## Current code map

| Dimension | UI id | UI label | Real-world mapping | Alignment |
|---|---|---|---|---|
| coaching_style | default | Studigo default | Explicit instruction + worked examples + formative adaptation | composite |
| coaching_style | direct | Direct instruction | Explicit Instruction | canonical match |
| coaching_style | drill | Deliberate practice | Deliberate Practice | canonical match |
| coaching_style | socratic | Socratic coach | Socratic Questioning | canonical match |
| coaching_style | progression | Skill progression | Scaffolding + gradual release + part/whole practice | composite |
| coaching_style | visual | Concrete to abstract | Concrete–Representational/Pictorial–Abstract | canonical match |
| learning_tradition | tradition-default | Teacher's method | Curricular/source fidelity | product policy |
| learning_tradition | tradition-japanese | Japanese-inspired | Japanese structured problem-solving lesson | partial composite |
| learning_tradition | tradition-swedish | Swedish-inspired | learner influence + critical inquiry in Swedish curriculum | curriculum-values composite |
| learning_tradition | tradition-singapore | Singapore Math-inspired | Singapore CPA + model method | canonical/strong match |
| learning_tradition | tradition-montessori | Montessori-inspired | prepared environment + presentation + control of error | strong partial match |
| practice_recipe | adaptive | Best next practice | formative assessment + adaptive/mastery-oriented instruction | composite |
| practice_recipe | repetition | Focused repetition | deliberate/fluency practice with feedback | canonical family |
| practice_recipe | transfer | Transfer practice | varied/interleaved practice + transfer | canonical family |

## Record schema

Every record provides:

- the exact current Studigo description and instruction;
- the closest real-world paradigm(s);
- a definition;
- core sequence or mechanics;
- best-fit use cases;
- cautions / boundary conditions;
- examples;
- recommended Studigo coaching rules;
- source notes and references.

The knowledge base is descriptive, not a claim that every option is equally effective or universally appropriate.
