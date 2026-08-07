-- Refus client explicite sur l'état d'autorité et indexes des accès serveur.

create policy game_sessions_deny_client
on public.game_sessions
for all
to anon, authenticated
using (false)
with check (false);

create policy match_actions_deny_client
on public.match_actions
for all
to anon, authenticated
using (false)
with check (false);

create index game_sessions_user_idx on public.game_sessions (user_id);
create index match_actions_user_created_idx on public.match_actions (user_id, created_at desc);
create index player_achievements_achievement_idx on public.player_achievements (achievement_id);
