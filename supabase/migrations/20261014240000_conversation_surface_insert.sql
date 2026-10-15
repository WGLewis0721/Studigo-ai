-- The signed-in role may stamp the surface of a chat it creates.
-- Chat creation uses the service role; this keeps a user-scoped insert from failing on the column.
grant insert (surface) on table public.conversations to authenticated;
