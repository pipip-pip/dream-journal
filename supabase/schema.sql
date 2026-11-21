-- Dream Journal database setup.
-- Paste this whole file into Supabase → SQL Editor → New query, then press Run.
-- It is safe to run again: it only creates things that don't exist yet.

-- ───────────── Tables ─────────────
-- Every table has user_id, filled in automatically with the logged-in user.

create table if not exists public.entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  entry_date     date not null,                       -- the day this dream belongs to (your local date)
  created_at     timestamptz not null default now(),
  check_in       jsonb not null default '{}'::jsonb,  -- text, good, bothered, noticed, ate, body, surprise
  mood           text,
  tone           text not null default 'peaceful',    -- peaceful | mystical | eerie
  length         text not null default 'medium',      -- short | medium | long
  mode           text not null default 'tonight',     -- tonight | morning
  title          text not null default '',
  story          text not null default '',
  waking_thought text not null default '',
  -- one column with all searchable text, kept up to date by Postgres
  search_text    text generated always as (
                   lower(coalesce(title,'') || ' ' || coalesce(story,'') || ' ' || coalesce(check_in::text,''))
                 ) stored
);
create index if not exists entries_user_date on public.entries (user_id, entry_date desc);

create table if not exists public.people (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  name            text not null,
  aliases         text[] not null default '{}',   -- other ways you've mentioned them ("my sister")
  relationship    text not null default '',
  notes           text not null default '',       -- short notes, one per line
  first_mentioned date,
  last_mentioned  date,
  created_at      timestamptz not null default now()
);

create table if not exists public.entry_people (
  entry_id  uuid not null references public.entries on delete cascade,
  person_id uuid not null references public.people on delete cascade,
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (entry_id, person_id)
);

create table if not exists public.threads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  summary         text not null,
  follow_up_hint  text not null default '',
  resolved        boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists public.fragments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  entry_id    uuid references public.entries on delete cascade,
  name        text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.rituals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  entry_id   uuid references public.entries on delete cascade,
  kind       text not null check (kind in ('intention', 'worry')),
  text       text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  user_id        uuid primary key default auth.uid() references auth.users on delete cascade,
  literalness    int  not null default 50,          -- 0 = close to real life, 100 = fully dreamlike
  hard_topics    text not null default 'reflect',   -- reflect | soften
  default_tone   text not null default 'peaceful',
  default_length text not null default 'medium',
  default_mode   text not null default 'tonight',
  waking_thought boolean not null default true,
  daily_limit    int  not null default 20,
  updated_at     timestamptz not null default now()
);

-- One row per dream request, used for the daily limit.
create table if not exists public.generations (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists generations_user_time on public.generations (user_id, created_at desc);

-- ───────────── Row Level Security ─────────────
-- With RLS on, each row can only be seen or changed by the account that owns it.
do $$
declare t text;
begin
  foreach t in array array['entries','people','entry_people','threads','fragments','rituals','settings','generations']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
