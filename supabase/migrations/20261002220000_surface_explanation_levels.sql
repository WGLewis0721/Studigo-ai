-- Separate effective explanation levels for Coach and Learn while preserving
-- study_rooms.explain_level as the room-wide shared/default setting.
alter table public.study_rooms
  add column if not exists coach_explain_level text
    check (coach_explain_level is null or coach_explain_level in ('simpler','standard','deeper')),
  add column if not exists learn_explain_level text
    check (learn_explain_level is null or learn_explain_level in ('simpler','standard','deeper'));

-- Existing rooms start linked to the room-wide setting. Future surface-specific
-- Apply actions may diverge the two columns; Room Settings can link them again.
update public.study_rooms
set coach_explain_level = coalesce(coach_explain_level, explain_level),
    learn_explain_level = coalesce(learn_explain_level, explain_level);
