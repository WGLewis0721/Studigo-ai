-- Delivery preferences use the room's existing ownership/RLS boundary.
-- explain_level remains canonical for Coach, Ask and Learn alike.
alter table public.study_rooms
  add column coach_preferences jsonb not null
  default '{"style":"default","tradition":"tradition-default","practice":"adaptive"}'::jsonb;

alter table public.study_rooms add constraint study_rooms_coach_preferences_valid check (coalesce(
  jsonb_typeof(coach_preferences) = 'object'
  and coach_preferences ?& array['style', 'tradition', 'practice']
  and coach_preferences->>'style' in ('default', 'direct', 'drill', 'socratic', 'progression', 'visual')
  and coach_preferences->>'tradition' in ('tradition-default', 'tradition-japanese', 'tradition-swedish', 'tradition-singapore', 'tradition-montessori')
  and coach_preferences->>'practice' in ('adaptive', 'repetition', 'transfer')
, false));
