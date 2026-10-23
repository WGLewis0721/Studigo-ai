# supabase/

Postgres schema, RLS, pgvector, and RPCs for the learning app. `functions/README.md` is a reserved worker contract. Ingestion still runs in `apps/web`.

- Change schema only by adding a new file under `migrations/`. Do not edit a migration that has already been applied, and do not drift the hosted database by hand.
- Apply files in filename order. `supabase db push` needs the Supabase CLI, which is not a workspace dependency.
- Two files already share the version prefix `20261015010000`. Supabase uses that prefix as the version. Do not add another file with an existing prefix.
- Enable RLS on learner data. `match_study_chunks` must keep filtering by owner and room.
- Service-role code in `apps/web` must still prove user, room, and object scope. RLS is the tenant boundary.
- Storage buckets for originals stay private.
