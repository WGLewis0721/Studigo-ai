-- ---------------------------------------------------------------------------
-- Coach state machine: persists what Coach is waiting for on a conversation.
--
-- Coach is a stateful protocol (idle / awaiting_answer / awaiting_control),
-- not free-form chat. Without this column, every learner turn would have to
-- be re-inferred from message history and prose, which is exactly the kind
-- of fragile heuristic the Coach spec rules out. Defaulting to
-- {"version":1,"kind":"idle"} keeps every existing conversation valid with
-- no backfill.
-- ---------------------------------------------------------------------------

alter table public.conversations
  add column if not exists coach_state jsonb not null default '{"version":1,"kind":"idle"}'::jsonb;
