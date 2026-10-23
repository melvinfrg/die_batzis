-- =========================================================
--  Die Batzi's – Erweiterung 2
--  Fotos, Gefühle im Tagebuch, Läden, Rezepte, Orga, Einstellungen
-- =========================================================

-- Einkauf: Laden
alter table public.shopping_items add column if not exists store text;

-- Gemeinsame Einstellungen (Vorrat, Laden-Gedächtnis, Heute-kochen …)
create table if not exists public.app_settings (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Tagebuch: Wie geht's mir? (optional privat)
create table if not exists public.diary_feelings (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  score smallint not null check (score between 1 and 5),
  note text check (char_length(note) <= 1000),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, entry_date)
);

-- Rezepte (eigene)
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  emoji text not null default '🍽️',
  minutes integer,
  servings integer default 2,
  tags jsonb not null default '[]'::jsonb,
  ingredients jsonb not null default '[]'::jsonb,
  steps text,
  url text,
  image_url text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Orga: Versicherungen, Strom, Verträge …
create table if not exists public.orga_items (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Verträge',
  title text not null,
  provider text,
  amount numeric(10, 2),
  interval text not null default 'monthly',
  payer text,
  contract_no text,
  start_date date,
  end_date date,
  cancel_by date,
  notice text,
  contact text,
  url text,
  notes text,
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Fotos
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  caption text,
  on_dashboard boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists recipes_created_by_idx on public.recipes (created_by);
create index if not exists orga_created_by_idx on public.orga_items (created_by);
create index if not exists photos_created_by_idx on public.photos (created_by);

alter table public.app_settings   enable row level security;
alter table public.diary_feelings enable row level security;
alter table public.recipes        enable row level security;
alter table public.orga_items     enable row level security;
alter table public.photos         enable row level security;

do $$
declare t text;
begin
  foreach t in array array['app_settings', 'recipes', 'orga_items', 'photos'] loop
    execute format('drop policy if exists "mitglieder" on public.%I', t);
    execute format(
      'create policy "mitglieder" on public.%I for all to authenticated
         using ((select public.is_member())) with check ((select public.is_member()))', t);
  end loop;
end $$;

-- Gefühle: eigene immer sichtbar, fremde nur wenn nicht privat
create policy "feelings: lesen" on public.diary_feelings
  for select to authenticated
  using ((select public.is_member()) and (author_id = (select auth.uid()) or not is_private));
create policy "feelings: eigene anlegen" on public.diary_feelings
  for insert to authenticated with check ((select public.is_member()) and author_id = (select auth.uid()));
create policy "feelings: eigene ändern" on public.diary_feelings
  for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "feelings: eigene löschen" on public.diary_feelings
  for delete to authenticated using (author_id = (select auth.uid()));

-- Speicher für Fotos (privat, nur Mitglieder)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "photos: lesen" on storage.objects
  for select to authenticated using (bucket_id = 'photos' and (select public.is_member()));
create policy "photos: hochladen" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos' and (select public.is_member()));
create policy "photos: löschen" on storage.objects
  for delete to authenticated using (bucket_id = 'photos' and (select public.is_member()));

do $$
declare t text;
begin
  foreach t in array array['app_settings', 'diary_feelings', 'recipes', 'orga_items', 'photos'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
