-- Transactions d'autorité du mode solo. Exécution réservée au service_role.

create or replace function private.game_card_ids(state jsonb)
returns table (card_id text)
language sql
immutable
set search_path = ''
as $$
  select card->>'id' from jsonb_array_elements(coalesce(state->'deck', '[]'::jsonb)) card
  union all
  select card->>'id' from jsonb_array_elements(coalesce(state #> '{hands,0}', '[]'::jsonb)) card
  union all
  select card->>'id' from jsonb_array_elements(coalesce(state #> '{hands,1}', '[]'::jsonb)) card
  union all
  select card->>'id' from jsonb_array_elements(coalesce(state #> '{captured,0}', '[]'::jsonb)) card
  union all
  select card->>'id' from jsonb_array_elements(coalesce(state #> '{captured,1}', '[]'::jsonb)) card
  union all
  select card->>'id'
  from jsonb_array_elements(coalesce(state->'table', '[]'::jsonb)) table_group
  cross join lateral jsonb_array_elements(coalesce(table_group->'cards', '[]'::jsonb)) card;
$$;

create or replace function private.game_state_is_valid(state jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    state is not null
    and jsonb_typeof(state) = 'object'
    and count(*) = 52
    and count(card_id) = 52
    and count(distinct card_id) = 52
  from private.game_card_ids(state);
$$;

create or replace function private.progress_rank(target_user uuid)
returns bigint
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
  )
  select rank from ranked where id = target_user;
$$;

create or replace function public.start_solo_match_server(
  p_user_id uuid,
  p_request_id uuid,
  p_game_state jsonb,
  p_ai_difficulty text default 'strategique'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_match uuid;
  new_match uuid;
  existing_session public.game_sessions%rowtype;
begin
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = '22023', message = 'Utilisateur Supabase invalide';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'request_id est obligatoire';
  end if;
  if not private.game_state_is_valid(p_game_state) then
    raise exception using errcode = '22023', message = 'État initial invalide : invariant des 52 cartes';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  select id into existing_match
  from public.matches
  where player_id = p_user_id and request_id = p_request_id;

  if existing_match is not null then
    select * into existing_session from public.game_sessions where match_id = existing_match;
    return jsonb_build_object(
      'match_id', existing_match,
      'version', existing_session.version,
      'game_state', existing_session.game_state,
      'duplicate', true
    );
  end if;

  if (
    select count(*) from public.matches
    where player_id = p_user_id and started_at > now() - interval '1 minute'
  ) >= 6 then
    raise exception using errcode = 'P0001', message = 'Trop de parties démarrées. Réessaie dans une minute.';
  end if;

  update public.matches
  set status = 'abandoned', finished_at = now()
  where player_id = p_user_id and status = 'active';

  update public.game_sessions
  set status = 'abandoned'
  where user_id = p_user_id and status = 'active';

  insert into public.matches (
    mode, status, player_id, opponent_type, ai_difficulty, request_id
  ) values (
    'solo_ai', 'active', p_user_id, 'ai', p_ai_difficulty, p_request_id
  ) returning id into new_match;

  insert into public.game_sessions (match_id, user_id, game_state)
  values (new_match, p_user_id, p_game_state);

  update public.player_stats
  set games_started = games_started + 1
  where user_id = p_user_id;

  return jsonb_build_object(
    'match_id', new_match,
    'version', 1,
    'game_state', p_game_state,
    'duplicate', false
  );
end;
$$;

create or replace function public.commit_solo_action_server(
  p_user_id uuid,
  p_match_id uuid,
  p_action_id uuid,
  p_expected_version integer,
  p_action_kind text,
  p_new_state jsonb,
  p_action_metrics jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.game_sessions%rowtype;
  action_row public.match_actions%rowtype;
  old_stats public.player_stats%rowtype;
  new_stats public.player_stats%rowtype;
  next_version integer;
  combined_metrics jsonb;
  v_player_score integer;
  v_opponent_score integer;
  v_result_name text;
  v_xp_reward integer;
  old_level integer;
  old_rank bigint;
  new_rank bigint;
  unlocked jsonb := '[]'::jsonb;
  match_updated integer;
begin
  if p_action_id is null or p_match_id is null or p_user_id is null then
    raise exception using errcode = '22023', message = 'Identifiants de partie et d’action obligatoires';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));

  select * into session_row
  from public.game_sessions
  where match_id = p_match_id and user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Partie introuvable ou non autorisée';
  end if;

  select * into action_row from public.match_actions where action_id = p_action_id;
  if found then
    if action_row.match_id <> p_match_id or action_row.user_id <> p_user_id then
      raise exception using errcode = '23505', message = 'action_id déjà utilisé';
    end if;
    return jsonb_build_object(
      'match_id', p_match_id,
      'version', session_row.version,
      'game_state', session_row.game_state,
      'duplicate', true,
      'progress', null
    );
  end if;

  if session_row.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'Cette partie n’est plus active';
  end if;
  if session_row.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'Version de partie obsolète';
  end if;
  if p_action_kind not in ('capture', 'build', 'discard', 'continue') then
    raise exception using errcode = '22023', message = 'Type d’action invalide';
  end if;
  if (
    select count(*) from public.match_actions
    where user_id = p_user_id and created_at > now() - interval '1 minute'
  ) >= 120 then
    raise exception using errcode = 'P0001', message = 'Trop d’actions. Réessaie dans un instant.';
  end if;
  if not private.game_state_is_valid(p_new_state) then
    raise exception using errcode = '22023', message = 'Action rejetée : invariant des 52 cartes';
  end if;

  next_version := session_row.version + 1;
  combined_metrics := jsonb_build_object(
    'has_capture',
      coalesce((session_row.metrics->>'has_capture')::boolean, false)
      or coalesce((p_action_metrics->>'has_capture')::boolean, false),
    'max_capture_size',
      greatest(
        coalesce((session_row.metrics->>'max_capture_size')::integer, 0),
        coalesce((p_action_metrics->>'max_capture_size')::integer, 0)
      ),
    'captured_opponent_build',
      coalesce((session_row.metrics->>'captured_opponent_build')::boolean, false)
      or coalesce((p_action_metrics->>'captured_opponent_build')::boolean, false)
  );

  update public.game_sessions
  set
    game_state = p_new_state,
    metrics = combined_metrics,
    version = next_version,
    status = case when p_new_state->>'phase' = 'finished' then 'completed' else 'active' end
  where id = session_row.id;

  insert into public.match_actions (
    action_id, match_id, user_id, expected_version, result_version, action_kind
  ) values (
    p_action_id, p_match_id, p_user_id, p_expected_version, next_version, p_action_kind
  );

  if p_new_state->>'phase' <> 'finished' then
    return jsonb_build_object(
      'match_id', p_match_id,
      'version', next_version,
      'game_state', p_new_state,
      'duplicate', false,
      'progress', null
    );
  end if;

  v_player_score := jsonb_array_length(coalesce(p_new_state #> '{captured,0}', '[]'::jsonb));
  v_opponent_score := jsonb_array_length(coalesce(p_new_state #> '{captured,1}', '[]'::jsonb));
  v_result_name := case
    when v_player_score > v_opponent_score then 'player'
    when v_player_score < v_opponent_score then 'opponent'
    else 'draw'
  end;
  v_xp_reward := case v_result_name when 'player' then 50 when 'draw' then 35 else 20 end;

  update public.matches
  set
    status = 'completed',
    player_score = v_player_score,
    opponent_score = v_opponent_score,
    winner = v_result_name,
    cards_captured = v_player_score,
    verified = true,
    finished_at = now()
  where id = p_match_id and player_id = p_user_id and status = 'active';
  get diagnostics match_updated = row_count;
  if match_updated <> 1 then
    raise exception using errcode = 'P0001', message = 'Résultat déjà finalisé ou partie invalide';
  end if;

  select * into old_stats
  from public.player_stats
  where user_id = p_user_id
  for update;
  old_level := old_stats.level;
  old_rank := private.progress_rank(p_user_id);

  update public.player_stats
  set
    xp = xp + v_xp_reward,
    level = private.level_for_xp(xp + v_xp_reward),
    games_completed = games_completed + 1,
    wins = wins + case when v_result_name = 'player' then 1 else 0 end,
    losses = losses + case when v_result_name = 'opponent' then 1 else 0 end,
    draws = draws + case when v_result_name = 'draw' then 1 else 0 end,
    total_cards_captured = total_cards_captured + v_player_score,
    best_cards_captured = greatest(best_cards_captured, v_player_score),
    current_win_streak = case when v_result_name = 'player' then current_win_streak + 1 else 0 end,
    best_win_streak = greatest(
      best_win_streak,
      case when v_result_name = 'player' then current_win_streak + 1 else 0 end
    ),
    solo_verified_games = solo_verified_games + 1
  where user_id = p_user_id
  returning * into new_stats;

  perform private.refresh_leaderboard_eligibility(p_user_id);

  with eligible as (
    select a.id
    from public.achievements a
    where
      (a.code = 'PREMIERE_PRISE' and coalesce((combined_metrics->>'has_capture')::boolean, false))
      or (a.code = 'CALCULATEUR' and coalesce((combined_metrics->>'max_capture_size')::integer, 0) >= 4)
      or (a.code = 'BRAQUAGE' and v_player_score >= 30)
      or (a.code = 'INVAINCU' and new_stats.current_win_streak >= 5)
      or (a.code = 'CENTURION' and new_stats.games_completed >= 100)
      or (a.code = 'PIEGE_PARFAIT' and coalesce((combined_metrics->>'captured_opponent_build')::boolean, false))
  ), inserted as (
    insert into public.player_achievements (user_id, achievement_id)
    select p_user_id, e.id from eligible e
    on conflict (user_id, achievement_id) do nothing
    returning achievement_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', a.code,
    'name', a.name,
    'description', a.description,
    'icon', a.icon
  ) order by a.code), '[]'::jsonb)
  into unlocked
  from inserted i
  join public.achievements a on a.id = i.achievement_id;

  new_rank := private.progress_rank(p_user_id);

  return jsonb_build_object(
    'match_id', p_match_id,
    'version', next_version,
    'game_state', p_new_state,
    'duplicate', false,
    'progress', jsonb_build_object(
      'verified', true,
      'result', v_result_name,
      'xp_awarded', v_xp_reward,
      'old_xp', old_stats.xp,
      'new_xp', new_stats.xp,
      'old_level', old_level,
      'new_level', new_stats.level,
      'old_rank', old_rank,
      'new_rank', new_rank,
      'leaderboard_eligible', (select leaderboard_eligible from public.profiles where id = p_user_id),
      'achievements_unlocked', unlocked
    )
  );
end;
$$;

create or replace function public.abandon_solo_match_server(
  p_user_id uuid,
  p_match_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  update public.matches
  set status = 'abandoned', finished_at = now()
  where id = p_match_id and player_id = p_user_id and status = 'active';
  get diagnostics changed = row_count;

  update public.game_sessions
  set status = 'abandoned'
  where match_id = p_match_id and user_id = p_user_id and status = 'active';

  return changed = 1;
end;
$$;

create or replace function public.invalidate_solo_match_server(
  p_user_id uuid,
  p_match_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  raise log 'Casino match % invalid for user %: %', p_match_id, p_user_id, left(coalesce(p_reason, 'unknown'), 300);
  update public.matches
  set status = 'invalid', finished_at = now(), verified = false
  where id = p_match_id and player_id = p_user_id and status = 'active';
  get diagnostics changed = row_count;

  update public.game_sessions
  set status = 'invalid'
  where match_id = p_match_id and user_id = p_user_id and status = 'active';

  return changed = 1;
end;
$$;

revoke all on function public.start_solo_match_server(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.commit_solo_action_server(uuid, uuid, uuid, integer, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.abandon_solo_match_server(uuid, uuid) from public, anon, authenticated;
revoke all on function public.invalidate_solo_match_server(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.start_solo_match_server(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.commit_solo_action_server(uuid, uuid, uuid, integer, text, jsonb, jsonb) to service_role;
grant execute on function public.abandon_solo_match_server(uuid, uuid) to service_role;
grant execute on function public.invalidate_solo_match_server(uuid, uuid, text) to service_role;
