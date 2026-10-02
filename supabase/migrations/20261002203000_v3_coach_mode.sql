-- V3 learner-facing Coach settings collapse style/tradition/practice into one
-- persistent mode. Legacy keys remain required temporarily for backward
-- compatibility, but hidden clients may no longer persist arbitrary mode values.
alter table public.study_rooms
  drop constraint if exists study_rooms_coach_preferences_valid;

alter table public.study_rooms
  add constraint study_rooms_coach_preferences_valid check (coalesce(
    jsonb_typeof(coach_preferences) = 'object'
    and coach_preferences ?& array['style', 'tradition', 'practice']
    and coach_preferences->>'style' in ('default', 'direct', 'drill', 'socratic', 'progression', 'visual')
    and coach_preferences->>'tradition' in ('tradition-default', 'tradition-japanese', 'tradition-swedish', 'tradition-singapore', 'tradition-montessori')
    and coach_preferences->>'practice' in ('adaptive', 'repetition', 'transfer')
    and (
      not (coach_preferences ? 'coach_mode')
      or coach_preferences->>'coach_mode' in ('show', 'coach', 'challenge')
    )
  , false));
