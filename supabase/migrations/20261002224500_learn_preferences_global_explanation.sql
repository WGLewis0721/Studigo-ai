-- Learn gets its own presentation preference while explanation level returns
-- to one Study Room-wide global setting.
alter table public.study_rooms
  add column if not exists learn_preferences jsonb not null
    default '{"mode":"step_by_step"}'::jsonb;

alter table public.study_rooms
  drop constraint if exists study_rooms_learn_preferences_valid;

alter table public.study_rooms
  add constraint study_rooms_learn_preferences_valid check (
    jsonb_typeof(learn_preferences) = 'object'
    and learn_preferences ? 'mode'
    and learn_preferences->>'mode' in ('overview','step_by_step','examples_first')
  );

-- Surface-specific explanation columns were introduced during the October 2
-- iteration but are no longer part of the product contract. Leave them in
-- place temporarily for rollback safety; new code ignores them entirely.
comment on column public.study_rooms.coach_explain_level is
  'Deprecated. Explanation level is global in study_rooms.explain_level.';
comment on column public.study_rooms.learn_explain_level is
  'Deprecated. Explanation level is global in study_rooms.explain_level.';
