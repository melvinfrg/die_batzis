-- =========================================================
--  Die Batzi's – Datenbank-Schema für Supabase
--  Einmal komplett im SQL Editor ausführen.
-- =========================================================

-- ---------- Wer darf rein? ----------
create table if not exists public.members (
  email text primary key,
  added_at timestamptz not null default now()
);
alter table public.members enable row level security;

create or replace function public.is_member()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

create policy "members: lesen" on public.members
  for select to authenticated using ((select public.is_member()));

-- ---------- Profile ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  emoji text not null default '🐻',
  color text not null default 'peach',
  created_at timestamptz not null default now()
);

-- ---------- ToDos ----------
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  due_date date,
  priority smallint not null default 2 check (priority between 1 and 3),
  assignee text,                         -- user-id, 'both' oder null
  category text,
  recurrence text not null default 'none',
  subtasks jsonb not null default '[]'::jsonb,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Einkaufsliste ----------
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity text,
  category text,
  note text,
  checked boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Termine ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  end_date date,
  all_day boolean not null default false,
  start_time time,
  end_time time,
  location text,
  notes text,
  who text,
  color text not null default 'peach',
  recurrence text not null default 'none',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Tage-Tracker ----------
create table if not exists public.trackers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  emoji text not null default '⏳',
  start_date date not null,
  description text,
  color text not null default 'peach',
  pinned boolean not null default true,
  history jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Reisen ----------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  destination text,
  country text,
  start_date date,
  end_date date,
  emoji text not null default '🧳',
  cover_url text,
  notes text,
  rating smallint check (rating between 1 and 5),
  budget numeric(10, 2),
  links jsonb not null default '[]'::jsonb,
  packing jsonb not null default '[]'::jsonb,
  expenses jsonb not null default '[]'::jsonb,
  plan jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- Tagebuch (1 Nachricht pro Person & Tag) ----------
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  message text not null check (char_length(message) between 1 and 2000),
  mood text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, entry_date)
);

create index if not exists todos_due_idx on public.todos (due_date) where not done;
create index if not exists events_date_idx on public.events (event_date);
create index if not exists diary_date_idx on public.diary_entries (entry_date desc);

-- ---------- Row Level Security ----------
alter table public.profiles       enable row level security;
alter table public.todos          enable row level security;
alter table public.shopping_items enable row level security;
alter table public.events         enable row level security;
alter table public.trackers       enable row level security;
alter table public.trips          enable row level security;
alter table public.diary_entries  enable row level security;

-- Gemeinsame Tabellen: alle Mitglieder dürfen alles
do $$
declare t text;
begin
  foreach t in array array['todos', 'shopping_items', 'events', 'trackers', 'trips'] loop
    execute format('drop policy if exists "mitglieder" on public.%I', t);
    execute format(
      'create policy "mitglieder" on public.%I for all to authenticated
         using ((select public.is_member())) with check ((select public.is_member()))', t);
  end loop;
end $$;

-- Profile: alle lesen, jeder nur sein eigenes schreiben
create policy "profiles: lesen" on public.profiles
  for select to authenticated using ((select public.is_member()));
create policy "profiles: eigenes anlegen" on public.profiles
  for insert to authenticated with check ((select public.is_member()) and id = (select auth.uid()));
create policy "profiles: eigenes ändern" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Tagebuch: beide lesen, jeder nur eigene Nachrichten schreiben
create policy "diary: lesen" on public.diary_entries
  for select to authenticated using ((select public.is_member()));
create policy "diary: eigene anlegen" on public.diary_entries
  for insert to authenticated with check ((select public.is_member()) and author_id = (select auth.uid()));
create policy "diary: eigene ändern" on public.diary_entries
  for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "diary: eigene löschen" on public.diary_entries
  for delete to authenticated using (author_id = (select auth.uid()));

-- ---------- Live-Updates (Realtime) ----------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'todos', 'shopping_items', 'events', 'trackers', 'trips', 'diary_entries'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- Euch beide freischalten ----------
-- E-Mail-Adressen anpassen und ausführen:
-- insert into public.members (email) values
--   ('deine@email.de'),
--   ('ihre@email.de');
