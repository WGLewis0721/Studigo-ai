---
kb_schema_version: 1
ui_dimension: learning_tradition
ui_id: tradition-montessori
ui_label: Montessori-inspired
alignment_type: composite
match_strength: strong_partial
canonical_paradigms:
  - montessori_prepared_environment
  - montessori_presentation
  - control_of_error
  - learner_choice_within_limits
retrieval_tags:
  - independence
  - self_correction
  - bounded_choice
  - minimal_prompting
  - control_of_error
  - prepared_sequence
best_for:
  - independent_attempt
  - self_correction
  - early_childhood
  - concrete_materials
avoid_when:
  - immediate_direct_correction_is_safety_critical
  - representing_as_full_montessori_program
---

# Montessori-Inspired → Prepared Environment + Control of Error

## Current Studigo definition

**Description:** Choice within a prepared sequence.

**Instruction:** "Offer a bounded choice of practice, let the learner attempt independently, use precise hands-off prompts, and reveal the correction only after self-checking. Keep the objective and teacher scope fixed."

## Real-world alignment

This has strong overlap with several documented Montessori principles:

- a **prepared environment** supporting purposeful independent activity;
- **presentation** by the adult using precise, minimal instruction;
- learner choice within logical limits;
- **control of error**, where the learner can detect/correct mistakes without depending on adult judgment for every step.

It is still only **Montessori-inspired**. A complete Montessori environment includes developmental materials, mixed-age community, extended work cycles, trained observation, and other elements an AI coach does not reproduce.

## Definition

The coach prepares bounded, purposeful options and then reduces interference so the learner can act independently, inspect the result, and self-correct before receiving external correction.

## Core sequence

1. Define the objective and prepare a small set of appropriate tasks.
2. Offer bounded learner choice.
3. Give a concise presentation if needed.
4. Let the learner attempt independently.
5. Provide a built-in or explicit way to check the work.
6. Ask the learner to identify/correct the error.
7. Intervene only when self-correction fails or a misconception persists.

## Best-fit use cases

- Learners who benefit from autonomy.
- Practice where answers or constraints allow self-checking.
- Concrete classification, sequencing, numeracy, language mechanics.
- Situations where over-coaching would reduce productive independence.

## Cautions

- Do not call an AI chat session "Montessori education."
- Immediate feedback may be more appropriate for some tasks.
- Purely abstract or ambiguous work may not have a meaningful "control of error."
- The coach must still prevent persistent misconceptions.

## Example

Studigo offers three equivalent fraction activities. The learner chooses bar models. After an answer, Studigo first asks the learner to compare the shaded parts or equivalent quantities and identify any mismatch before showing a correction.

## Recommended coaching rules

- Offer 2–3 meaningful choices, not unlimited options.
- Use minimal prompts after the task is understood.
- Build self-checking into the task when possible.
- Let the learner repair an error before giving the final correction.
- Intervene when self-correction stalls or becomes random.

## Sources

- Association Montessori Internationale. *Glossary of Montessori Terms* (Prepared Environment, Presentation, Control of Error, Concrete to Abstract). https://montessori-ami.org/node/2170
- Association Montessori Internationale. *Montessori Environments.* https://montessori-ami.org/node/2169
- Association Montessori Internationale. *Control of Error — Allowing Children to Manage their own Mistakes.* https://montessori-ami.org/trainingvoices/control-of-error
- Lillard, A. S., et al. (2017). *Montessori Preschool Elevates and Equalizes Child Outcomes: A Longitudinal Study.* Frontiers in Psychology, 8, 1783. https://doi.org/10.3389/fpsyg.2017.01783
