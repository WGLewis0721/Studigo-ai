-- Coach state and message identity are trusted server state.
-- Learners may read/delete their conversations and create/rename conversation
-- shells, but they must not forge coach_state, message IDs/roles/timestamps, or
-- assistant history used by the adaptive-learning evidence loop.

revoke all privileges on table public.conversations from anon, authenticated;
grant select, delete on table public.conversations to authenticated;
grant insert (room_id, owner_id, title) on table public.conversations to authenticated;
grant update (title) on table public.conversations to authenticated;

revoke all privileges on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;
