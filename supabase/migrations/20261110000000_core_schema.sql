-- BAAP KA PAISA core schema.
-- Rules: ranks are computed only on the server from an append-only ledger; money is integer paise;
-- Mystery-mode members never expose their name; no table is writable from the browser.

create extension if not exists citext with schema extensions;

-- ---------- Reference data ----------
create table public.states (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null unique
);
create table public.cities (
  id text primary key check (id ~ '^[a-z]+$'),
  name text not null unique,
  state_code text not null references public.states (code),
  region text not null,
  active boolean not null default true
);
create table public.localities (
  id bigint generated always as identity primary key,
  city_id text not null references public.cities (id),
  name text not null,
  unique (city_id, name),
  unique (city_id, id)
);

-- ---------- Seasons ----------
-- Season id is the season number. ends_at = scheduled_end plus any anti-snipe extension (max 2 hours).
create table public.seasons (
  id int primary key check (id > 0),
  starts_at timestamptz not null,
  scheduled_end timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'open', 'closed')),
  check (scheduled_end > starts_at),
  check (ends_at >= scheduled_end and ends_at <= scheduled_end + interval '2 hours')
);
create unique index seasons_one_open on public.seasons ((true)) where status = 'open';

-- ---------- Members ----------
create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  member_no bigint generated always as identity (start with 101) unique,
  username extensions.citext not null unique check (username ~ '^[a-z0-9._]{3,24}$'),
  display_name text check (char_length(display_name) between 1 and 40),
  masked boolean not null default false,
  anon_label text unique check (anon_label ~ '^ANON-[0-9]{2,4}$'),
  title text check (title in ('Founder','Co-founder','Creator','Entrepreneur','Doctor','Lawyer','CA','Student','Athlete','Artist','Investor','Other')),
  flex_line text check (char_length(flex_line) <= 40),
  city_id text not null,
  locality_id bigint not null,
  place_locked_until timestamptz not null default now() + interval '90 days',
  created_at timestamptz not null default now(),
  foreign key (city_id, locality_id) references public.localities (city_id, id),
  check (not masked or anon_label is not null)
);
create index members_city_idx on public.members (city_id, locality_id);

-- Private member data. Never returned by any public function.
create table public.member_private (
  member_id uuid primary key references public.members (id) on delete cascade,
  date_of_birth date not null,
  created_at timestamptz not null default now()
);
create function public.enforce_adult() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.date_of_birth > (current_date - interval '18 years')::date then
    raise exception 'Members must be 18 or older' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger member_private_adult before insert or update on public.member_private
  for each row execute function public.enforce_adult();

-- ---------- Append-only rank ledger ----------
-- Credits come only from verified, settled payments (not built yet). Corrections are compensating rows.
create table public.rank_ledger (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.members (id),
  season_id int not null references public.seasons (id),
  kind text not null check (kind in ('credit', 'reversal', 'adjustment')),
  rank_credit_paise bigint not null check (rank_credit_paise <> 0),
  payment_ref text unique,
  reason text,
  actor text not null,
  created_at timestamptz not null default now(),
  check (kind <> 'credit' or (rank_credit_paise > 0 and rank_credit_paise % 50000 = 0 and payment_ref is not null)),
  check (kind = 'credit' or reason is not null)
);
create index rank_ledger_season_idx on public.rank_ledger (season_id, member_id, created_at);
create index rank_ledger_member_idx on public.rank_ledger (member_id);

create function public.forbid_ledger_mutation() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'rank_ledger is append-only; add a compensating entry instead' using errcode = 'insufficient_privilege';
end $$;
create trigger rank_ledger_append_only before update or delete on public.rank_ledger
  for each row execute function public.forbid_ledger_mutation();
create trigger rank_ledger_no_truncate before truncate on public.rank_ledger
  for each statement execute function public.forbid_ledger_mutation();

-- ---------- Frozen season results (archive) ----------
create table public.season_results (
  season_id int not null references public.seasons (id),
  level text not null check (level in ('locality', 'city', 'state', 'india')),
  scope_key text not null,
  member_id uuid not null references public.members (id),
  final_rank int not null check (final_rank > 0),
  final_score_paise bigint not null,
  primary key (season_id, level, scope_key, member_id)
);

-- ---------- Row level security ----------
alter table public.states enable row level security;
alter table public.cities enable row level security;
alter table public.localities enable row level security;
alter table public.seasons enable row level security;
alter table public.members enable row level security;
alter table public.member_private enable row level security;
alter table public.rank_ledger enable row level security;
alter table public.season_results enable row level security;

create policy "reference data is public" on public.states for select to anon, authenticated using (true);
create policy "reference data is public" on public.cities for select to anon, authenticated using (true);
create policy "reference data is public" on public.localities for select to anon, authenticated using (true);
create policy "season calendar is public" on public.seasons for select to anon, authenticated using (true);
create policy "members read their own row" on public.members for select to authenticated using (id = (select auth.uid()));
create policy "members read their own private data" on public.member_private for select to authenticated using (member_id = (select auth.uid()));
create policy "members read their own ledger" on public.rank_ledger for select to authenticated using (member_id = (select auth.uid()));
-- No insert/update/delete policies: writes happen only in reviewed server-side functions.
