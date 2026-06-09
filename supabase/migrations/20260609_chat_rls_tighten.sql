-- ─────────────────────────────────────────────────────────────────────────────
-- Chat privacy hardening (audit theme K / D9-4)
-- The original policies allowed `user_id is null` (guest) rows to be read/written
-- by ANY user — every guest concierge conversation was world-readable. Guest
-- persistence now goes through the service-role chat route (which verifies the
-- session_token in code), so direct anon access can be authenticated-only.
-- Run in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "owner select sessions" on chat_sessions;
create policy "owner select sessions" on chat_sessions for select
  using (user_id = auth.uid());

drop policy if exists "owner insert sessions" on chat_sessions;
create policy "owner insert sessions" on chat_sessions for insert
  with check (user_id = auth.uid());

drop policy if exists "owner select messages" on chat_messages;
create policy "owner select messages" on chat_messages for select
  using (session_id in (select id from chat_sessions where user_id = auth.uid()));

drop policy if exists "owner insert messages" on chat_messages;
create policy "owner insert messages" on chat_messages for insert
  with check (session_id in (select id from chat_sessions where user_id = auth.uid()));
