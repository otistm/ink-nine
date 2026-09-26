-- Ink Nine: online play table. Paste this whole file into Supabase > SQL Editor and press Run.

create table if not exists public.rounds (
  player_id  uuid        not null default auth.uid() references auth.users on delete cascade,
  event      text        not null,
  grp        text        not null default '',
  name       text        not null default '',
  tot        int         not null,
  tp         int         not null,
  holes      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (player_id, event)
);

alter table public.rounds enable row level security;

-- Everyone can see best rounds (that's how friends show up as ghosts).
create policy "anyone can read rounds"
  on public.rounds for select using (true);

-- Each player can only add or change their own rounds.
create policy "players add their own rounds"
  on public.rounds for insert with check (auth.uid() = player_id);

create policy "players update their own rounds"
  on public.rounds for update using (auth.uid() = player_id) with check (auth.uid() = player_id);
