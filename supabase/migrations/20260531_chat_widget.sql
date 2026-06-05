-- Chat sessions and messages for the floating support widget.
-- Supports both authenticated buyers and anonymous guests (session_token).

create table if not exists chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  session_token text,                          -- for guest users
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint chat_sessions_identity check (user_id is not null or session_token is not null)
);

create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_idx on chat_messages(session_id, created_at);

-- Auto-update updated_at on chat_sessions
create or replace function touch_chat_session()
returns trigger language plpgsql as $$
begin
  update chat_sessions set updated_at = now() where id = new.session_id;
  return new;
end;
$$;

create trigger chat_message_inserted
  after insert on chat_messages
  for each row execute function touch_chat_session();

-- RLS
alter table chat_sessions enable row level security;
alter table chat_messages  enable row level security;

-- Authenticated users can only see their own sessions
create policy "owner select sessions"
  on chat_sessions for select
  using (user_id = auth.uid() or user_id is null);

create policy "owner insert sessions"
  on chat_sessions for insert
  with check (user_id = auth.uid() or user_id is null);

create policy "owner select messages"
  on chat_messages for select
  using (
    session_id in (
      select id from chat_sessions
      where user_id = auth.uid() or user_id is null
    )
  );

create policy "owner insert messages"
  on chat_messages for insert
  with check (
    session_id in (
      select id from chat_sessions
      where user_id = auth.uid() or user_id is null
    )
  );
