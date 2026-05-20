create table if not exists public.session_store (
  id         uuid primary key default gen_random_uuid(),
  session_id text        not null,
  type       text        not null check (type in ('cart','saved','offer')),
  data       jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists session_store_session_type on public.session_store (session_id, type);

-- one row per session+type (cart is one blob, saved is one blob, each offer is its own row)
-- for cart + saved we upsert on (session_id, type)
-- for offers we allow multiple rows per session

alter table public.session_store enable row level security;

-- service role bypasses RLS; anon/auth users can only see their own rows
create policy "owner access" on public.session_store
  using (session_id = auth.uid()::text)
  with check (session_id = auth.uid()::text);
