-- Casino Cartes Duel — comptes, progression et historique.
-- Toutes les données d'autorité restent côté PostgreSQL / Edge Functions.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.level_for_xp(value bigint)
returns integer
language sql
immutable
strict
set search_path = ''
as $$
  select floor(sqrt(value::double precision / 100.0))::integer + 1;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_normalized text generated always as (lower(username)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  leaderboard_eligible boolean not null default false,
  constraint profiles_username_format check (
    username = btrim(username)
    and char_length(username) between 3 and 20
    and username ~ '^[A-Za-z0-9_-]+$'
  ),
  constraint profiles_username_normalized_unique unique (username_normalized)
);

create table public.player_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  games_started integer not null default 0 check (games_started >= 0),
  games_completed integer not null default 0 check (games_completed >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  total_cards_captured integer not null default 0 check (total_cards_captured >= 0),
  best_cards_captured integer not null default 0 check (best_cards_captured >= 0),
  current_win_streak integer not null default 0 check (current_win_streak >= 0),
  best_win_streak integer not null default 0 check (best_win_streak >= 0),
  solo_verified_games integer not null default 0 check (solo_verified_games >= 0),
  pvp_rating integer not null default 1000 check (pvp_rating >= 0),
  pvp_games integer not null default 0 check (pvp_games >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_stats_completed_breakdown check (games_completed = wins + losses + draws),
  constraint player_stats_level_matches_xp check (level = private.level_for_xp(xp))
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  status text not null default 'active',
  player_id uuid not null references public.profiles(id) on delete cascade,
  opponent_type text not null default 'ai',
  ai_difficulty text,
  player_score integer check (player_score is null or player_score >= 0),
  opponent_score integer check (opponent_score is null or opponent_score >= 0),
  winner text,
  cards_captured integer not null default 0 check (cards_captured >= 0),
  verified boolean not null default false,
  request_id uuid not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint matches_mode_check check (mode in ('solo_ai', 'pvp_private', 'pvp_ranked')),
  constraint matches_status_check check (status in ('active', 'completed', 'abandoned', 'invalid')),
  constraint matches_winner_check check (winner is null or winner in ('player', 'opponent', 'draw')),
  constraint matches_opponent_type_check check (opponent_type in ('ai', 'player')),
  constraint matches_player_request_unique unique (player_id, request_id),
  constraint matches_completed_values check (
    status <> 'completed'
    or (finished_at is not null and player_score is not null and opponent_score is not null and winner is not null)
  ),
  constraint matches_verified_completed check (not verified or status = 'completed')
);

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_state jsonb not null,
  metrics jsonb not null default '{"has_capture":false,"max_capture_size":0,"captured_opponent_build":false}'::jsonb,
  version integer not null default 1 check (version >= 1),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned', 'invalid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_actions (
  action_id uuid primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expected_version integer not null check (expected_version >= 1),
  result_version integer not null check (result_version >= 2),
  action_kind text not null check (action_kind in ('capture', 'build', 'discard', 'continue')),
  created_at timestamptz not null default now(),
  constraint match_actions_match_action_unique unique (match_id, action_id)
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  icon text not null,
  xp_bonus integer not null default 0 check (xp_bonus >= 0),
  created_at timestamptz not null default now(),
  constraint achievements_code_format check (code ~ '^[A-Z0-9_]+$')
);

create table public.player_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

insert into public.achievements (code, name, description, icon)
values
  ('PREMIERE_PRISE', 'Première prise', 'Réaliser sa première capture.', '✦'),
  ('CALCULATEUR', 'Calculateur', 'Capturer au moins 4 cartes en une action.', '∑'),
  ('BRAQUAGE', 'Braquage', 'Capturer au moins 30 cartes dans une partie.', '♛'),
  ('INVAINCU', 'Invaincu', 'Gagner 5 parties consécutives.', '🔥'),
  ('CENTURION', 'Centurion', 'Terminer 100 parties vérifiées.', 'C'),
  ('PIEGE_PARFAIT', 'Piège parfait', 'Capturer une construction créée par le Croupier.', '◇')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon;

create or replace function private.generate_guest_username()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  candidate text;
  attempt integer := 0;
begin
  loop
    candidate := 'Joueur-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 6));
    exit when not exists (
      select 1 from public.profiles where username_normalized = lower(candidate)
    );
    attempt := attempt + 1;
    if attempt >= 20 then
      raise exception 'Impossible de générer un pseudonyme invité unique';
    end if;
  end loop;
  return candidate;
end;
$$;

create or replace function private.refresh_leaderboard_eligibility(target_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  eligible boolean;
begin
  select (
    coalesce(u.is_anonymous, true) is false
    and p.username ~ '^[A-Za-z0-9_-]{3,20}$'
    and s.solo_verified_games >= 3
  )
  into eligible
  from auth.users u
  join public.profiles p on p.id = u.id
  join public.player_stats s on s.user_id = u.id
  where u.id = target_user;

  update public.profiles
  set leaderboard_eligible = coalesce(eligible, false), updated_at = now()
  where id = target_user;

  return coalesce(eligible, false);
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  guest_username text;
begin
  guest_username := private.generate_guest_username();
  insert into public.profiles (id, username)
  values (new.id, guest_username);

  insert into public.player_stats (user_id)
  values (new.id);

  return new;
exception
  when others then
    raise log 'Casino profile creation failed for auth user %: %', new.id, sqlerrm;
    raise;
end;
$$;

create or replace function private.handle_auth_user_upgrade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_anonymous is distinct from new.is_anonymous and new.is_anonymous is false then
    perform private.refresh_leaderboard_eligibility(new.id);
  end if;
  return new;
end;
$$;

create or replace function private.handle_profile_username_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_leaderboard_eligibility(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_casino on auth.users;
create trigger on_auth_user_created_casino
after insert on auth.users
for each row execute function private.handle_new_auth_user();

drop trigger if exists on_auth_user_upgraded_casino on auth.users;
create trigger on_auth_user_upgraded_casino
after update of is_anonymous on auth.users
for each row execute function private.handle_auth_user_upgrade();

create trigger on_profile_username_updated_casino
after update of username on public.profiles
for each row execute function private.handle_profile_username_update();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger player_stats_set_updated_at
before update on public.player_stats
for each row execute function private.set_updated_at();

create trigger game_sessions_set_updated_at
before update on public.game_sessions
for each row execute function private.set_updated_at();

create index player_stats_progression_idx
  on public.player_stats (xp desc, wins desc, best_cards_captured desc, user_id);
create index player_stats_wins_idx on public.player_stats (wins desc);
create index matches_player_finished_idx on public.matches (player_id, finished_at desc);
create index matches_status_idx on public.matches (status);
create index match_actions_match_idx on public.match_actions (match_id, created_at);
create index player_achievements_user_idx on public.player_achievements (user_id);
create index profiles_leaderboard_idx
  on public.profiles (leaderboard_eligible, created_at, id)
  where leaderboard_eligible = true;
