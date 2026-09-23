# Coaching KB record schema

Each record uses YAML front matter so it can be indexed without natural-language parsing.

Required fields:

```yaml
id: stable-kebab-case-id
category: coaching_method | learning_tradition | practice_recipe
ui_id: exact ID used by the current Coach UI
ui_label: exact human label in the UI
canonical_paradigm: closest established real-world paradigm
alignment: canonical | aligned | composite | product_policy | partial_alignment
evidence_basis: short description of the source basis
best_for: [machine-readable, tags]
avoid_when: [machine-readable, tags]
subjects: [all | math | reading | ...]
source_keys: [stable-reference-keys]
```

Body headings are intentionally stable:

- `## Current Studigo definition`
- `## Real-world paradigm`
- `## Operational definition`
- `## Coaching moves`
- `## Best-fit use cases`
- `## Example`
- `## Guardrails`
- `## Sources`

A retriever should prefer front-matter filtering first, then semantic retrieval inside the body.
