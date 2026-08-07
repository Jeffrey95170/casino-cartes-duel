begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(14);

create temp table casino_security_results (test_name text primary key, passed boolean not null);
grant all on casino_security_results to authenticated;

create or replace function pg_temp.try_sql(statement text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function pg_temp.query_has_row(statement text)
returns boolean language plpgsql as $$
declare has_row boolean;
begin
  execute 'select exists (' || statement || ')' into has_row;
  return has_row;
exception when others then
  return false;
end;
$$;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-one@example.invalid', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-two@example.invalid', '{"provider":"email","providers":["email"]}', '{}', now(), now(), false);

insert into public.matches (mode, status, player_id, opponent_type, request_id)
values
  ('solo_ai', 'active', '10000000-0000-4000-8000-000000000001', 'ai', '20000000-0000-4000-8000-000000000001'),
  ('solo_ai', 'active', '10000000-0000-4000-8000-000000000002', 'ai', '20000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into casino_security_results values
  ('own_profile_read', pg_temp.query_has_row($q$select 1 from public.profiles where id = '10000000-0000-4000-8000-000000000001'$q$)),
  ('other_profile_hidden', not pg_temp.query_has_row($q$select 1 from public.profiles where id = '10000000-0000-4000-8000-000000000002'$q$)),
  ('other_match_hidden', not pg_temp.query_has_row($q$select 1 from public.matches where player_id = '10000000-0000-4000-8000-000000000002'$q$)),
  ('username_update_allowed', pg_temp.try_sql($q$update public.profiles set username = 'Rls_Player_One' where id = '10000000-0000-4000-8000-000000000001'$q$)),
  ('xp_update_blocked', not pg_temp.try_sql($q$update public.player_stats set xp = 999 where user_id = '10000000-0000-4000-8000-000000000001'$q$)),
  ('wins_update_blocked', not pg_temp.try_sql($q$update public.player_stats set wins = 9 where user_id = '10000000-0000-4000-8000-000000000001'$q$)),
  ('level_update_blocked', not pg_temp.try_sql($q$update public.player_stats set level = 9 where user_id = '10000000-0000-4000-8000-000000000001'$q$)),
  ('pvp_rating_update_blocked', not pg_temp.try_sql($q$update public.player_stats set pvp_rating = 9999 where user_id = '10000000-0000-4000-8000-000000000001'$q$)),
  ('eligibility_update_blocked', not pg_temp.try_sql($q$update public.profiles set leaderboard_eligible = true where id = '10000000-0000-4000-8000-000000000001'$q$)),
  ('verified_match_insert_blocked', not pg_temp.try_sql($q$insert into public.matches (mode,status,player_id,opponent_type,verified,request_id) values ('solo_ai','completed','10000000-0000-4000-8000-000000000001','ai',true,'20000000-0000-4000-8000-000000000003')$q$)),
  ('game_session_update_blocked', not pg_temp.try_sql($q$update public.game_sessions set version = 99 where user_id = '10000000-0000-4000-8000-000000000001'$q$)),
  ('achievement_unlock_blocked', not pg_temp.try_sql($q$insert into public.player_achievements (user_id,achievement_id) select '10000000-0000-4000-8000-000000000001', id from public.achievements limit 1$q$)),
  ('server_rpc_blocked', not pg_temp.try_sql($q$select public.abandon_solo_match_server('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000')$q$)),
  ('leaderboard_rpc_allowed', pg_temp.try_sql($q$select * from public.get_leaderboard(100)$q$));

reset role;
select extensions.ok(passed, test_name) from casino_security_results order by test_name;
select * from extensions.finish();
rollback;
