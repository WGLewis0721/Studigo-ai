-- Security audit (implementation/SECURITY_AUDIT_CHECKLIST.md, SB-02/LLM10-01).
--
-- Studigo no longer signs visitors in anonymously, but anonymous sign-ins can
-- still be enabled on the hosted Auth project. An anonymous session carries the
-- `authenticated` role, so without this boundary anyone holding the public anon
-- key could mint unlimited accounts and create rooms, conversations and stored
-- files directly through PostgREST/Storage, bypassing every app-side check.
--
-- Restrictive policies are ANDed with the existing permissive owner policies:
-- real accounts are unaffected, anonymous accounts cannot create anything.
-- Reads stay owner-scoped so a leftover anonymous user can still see (and
-- delete) what it already owns.

create policy study_rooms_insert_not_anonymous on public.study_rooms
  as restrictive for insert to authenticated
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

create policy conversations_insert_not_anonymous on public.conversations
  as restrictive for insert to authenticated
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

create policy plan_events_write_not_anonymous on public.study_plan_events
  as restrictive for insert to authenticated
  with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

create policy study_materials_insert_not_anonymous on storage.objects
  as restrictive for insert to authenticated
  with check (
    bucket_id <> 'study-materials'
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

-- Storage-layer limits mirror packages/documents (MAX_UPLOAD_BYTES and
-- ALLOWED_MIME_TYPES) so a direct Storage upload cannot exceed what the app
-- route accepts.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/markdown',
      'image/png',
      'image/jpeg',
      'image/webp'
    ]
where id = 'study-materials';

-- Security Advisor lint 0011: pin the trigger function's search_path.
alter function public.touch_updated_at() set search_path = public;
