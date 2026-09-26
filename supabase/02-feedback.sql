-- Ink Nine: tester feedback. Paste into Supabase > SQL Editor and press Run (once).
-- Players can send notes; nobody can read them from the game. Read them in Supabase > Table Editor > feedback.

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  player_id  uuid default auth.uid(),
  name       text not null default '',
  version    text not null default '',
  kind       text not null default '',
  note       text not null check (char_length(note) between 1 and 1000),
  context    jsonb not null default '{}'::jsonb
);

alter table public.feedback enable row level security;

create policy "players send feedback"
  on public.feedback for insert with check (auth.uid() = player_id);
