-- Accès minimal, classement de progression et profils publics sans UUID.

alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;
alter table public.matches enable row level security;
alter table public.game_sessions enable row level security;
alter table public.match_actions enable row level security;
alter table public.achievements enable row level security;
alter table public.player_achievements enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.player_stats from anon, authenticated;
revoke all on public.matches from anon, authenticated;
revoke all on public.game_sessions from anon, authenticated;
revoke all on public.match_actions from anon, authenticated;
revoke all on public.achievements from anon, authenticated;
revoke all on public.player_achievements from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (username) on public.profiles to authenticated;
grant select on public.player_stats to authenticated;
grant select on public.matches to authenticated;
grant select on public.achievements to anon, authenticated;
grant select on public.player_achievements to authenticated;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own_username
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy player_stats_select_own
on public.player_stats
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy matches_select_own
on public.matches
for select
to authenticated
using ((select auth.uid()) = player_id);

create policy achievements_read_all
on public.achievements
for select
to anon, authenticated
using (true);

create policy player_achievements_select_own
on public.player_achievements
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.is_username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    candidate = btrim(candidate)
    and char_length(candidate) between 3 and 20
    and candidate ~ '^[A-Za-z0-9_-]+$'
    and not exists (
      select 1
      from public.profiles
      where username_normalized = lower(candidate)
        and id is distinct from (select auth.uid())
    );
$$;

create or replace function public.get_leaderboard(p_limit integer default 100)
returns table (
  rank bigint,
  username text,
  level integer,
  xp bigint,
  wins integer,
  games_completed integer,
  best_cards_captured integer,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      p.id,
      row_number() over (
        order by s.xp desc, s.wins desc, s.best_cards_captured desc, p.created_at asc, p.id asc
      ) as rank,
      p.username,
      s.level,
      s.xp,
      s.wins,
      s.games_completed,
      s.best_cards_captured
    from public.profiles p
    join public.player_stats s on s.user_id = p.id
    where p.leaderboard_eligible = true
  )
  select
    r.rank,
    r.username,
    r.level,
    r.xp,
    r.wins,
    r.games_completed,
    r.best_cards_captured,
    r.id = (select auth.uid()) as is_current
  from ranked r
  order by r.rank
  limit greatest(1, least(coalesce(p_limit, 100), 100));
$$;

create or replace function public.get_my_leaderboard_window(p_radius integer default 3)
returns table (
  rank bigint,
  username text,
  level integer,
  xp bigint,
  wins integer,
  games_completed integer,
  best_cards_captured integer,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      p.id,
      row_number() over (
        order by s.xp desc, s.wins desc, s.best_cards_captured desc, p.created_at asc, p.id asc
      ) as rank,
      p.username,
      s.level,
      s.xp,
      s.wins,
      s.games_completed,
      s.best_cards_captured
    from public.profiles p
    join public.player_stats s on s.user_id = p.id
    where p.leaderboard_eligible = true
  ), current_player as (
    select rank from ranked where id = (select auth.uid())
  )
  select
    r.rank,
    r.username,
    r.level,
    r.xp,
    r.wins,
    r.games_completed,
    r.best_cards_captured,
    r.id = (select auth.uid()) as is_current
  from ranked r
  cross join current_player c
  where r.rank between c.rank - greatest(1, least(coalesce(p_radius, 3), 10))
                   and c.rank + greatest(1, least(coalesce(p_radius, 3), 10))
  order by r.rank;
$$;

create or replace function public.get_public_profile(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ranked as (
    select
      p.id,
      row_number() over (
        order by s.xp desc, s.wins desc, s.best_cards_captured desc, p.created_at asc, p.id asc
      ) as rank
    from public.profiles p
    join public.player_stats s on s.user_id = p.id
    where p.leaderboard_eligible = true
  ), target as (
    select
      p.id,
      p.username,
      p.created_at,
      s.level,
      s.xp,
      s.games_completed,
      s.wins,
      s.best_win_streak,
      s.best_cards_captured,
      r.rank
    from public.profiles p
    join public.player_stats s on s.user_id = p.id
    join ranked r on r.id = p.id
    where p.leaderboard_eligible = true
      and p.username_normalized = lower(btrim(p_username))
  )
  select jsonb_build_object(
    'username', t.username,
    'level', t.level,
    'xp', t.xp,
    'rank', t.rank,
    'games_completed', t.games_completed,
    'wins', t.wins,
    'win_rate', case when t.games_completed = 0 then 0
      else round((t.wins::numeric / t.games_completed::numeric) * 100, 1) end,
    'best_win_streak', t.best_win_streak,
    'best_cards_captured', t.best_cards_captured,
    'created_at', t.created_at,
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', a.code,
        'name', a.name,
        'description', a.description,
        'icon', a.icon,
        'unlocked_at', pa.unlocked_at
      ) order by pa.unlocked_at)
      from public.player_achievements pa
      join public.achievements a on a.id = pa.achievement_id
      where pa.user_id = t.id
    ), '[]'::jsonb)
  )
  from target t;
$$;

revoke all on function public.is_username_available(text) from public;
revoke all on function public.get_leaderboard(integer) from public;
revoke all on function public.get_my_leaderboard_window(integer) from public;
revoke all on function public.get_public_profile(text) from public;

grant execute on function public.is_username_available(text) to authenticated;
grant execute on function public.get_leaderboard(integer) to anon, authenticated;
grant execute on function public.get_my_leaderboard_window(integer) to authenticated;
grant execute on function public.get_public_profile(text) to anon, authenticated;
