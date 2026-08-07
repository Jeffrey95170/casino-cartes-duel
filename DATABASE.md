# Base de données et progression

## Tables

- `profiles` : pseudonyme unique insensible à la casse et éligibilité publique ;
- `player_stats` : XP, niveau, résultats, captures, séries et réserves PvP ;
- `matches` : historique propriétaire, résultat et statut de vérification ;
- `game_sessions` : état complet privé et version de concurrence ;
- `match_actions` : idempotence par `action_id` ;
- `achievements` : catalogue public data-driven ;
- `player_achievements` : déblocages uniques par joueur et succès.

Les tables exposées ont RLS activé. `game_sessions` et `match_actions` possèdent
des policies client explicitement toujours fausses, en plus de l’absence de
privilèges. Les clients ne disposent d’aucun droit d’écriture sur les
statistiques, les matchs ou les succès.

## Transactions serveur

`start_solo_match_server` crée le match et la session puis incrémente
`games_started`. `commit_solo_action_server` verrouille la session, vérifie sa
version, enregistre l’action et finalise atomiquement le match, les stats, l’XP,
le niveau, les séries, l’éligibilité et les succès. Ces RPC publiques dans le
schéma SQL ne sont exécutables que par `service_role`.

Un advisory lock par utilisateur et la version de session empêchent deux coups
simultanés. `request_id` rend le démarrage idempotent ; `action_id` rend chaque
action idempotente. L’invariant SQL et TypeScript exige exactement 52 identifiants
de carte uniques avant toute écriture.

## XP et niveau

- victoire : 50 XP ;
- égalité : 35 XP ;
- défaite : 20 XP ;
- partie abandonnée ou invalide : 0 XP.

Formule : `floor(sqrt(xp / 100)) + 1`. PostgreSQL impose par CHECK que le niveau
sauvegardé corresponde à l’XP. Le frontend utilise `lib/progression.ts` pour
afficher les mêmes seuils.

## Classement progression

Tri : XP, victoires, record de cartes, date de création, puis UUID uniquement
comme tie-break final interne. Les RPC ne publient jamais l’UUID, l’email ou les
données Auth.

Éligibilité : compte non anonyme, pseudonyme valide et au moins trois parties
solo vérifiées. Les RPC `get_leaderboard`, `get_my_leaderboard_window` et
`get_public_profile` exposent seulement les champs publics nécessaires.

`pvp_rating` vaut 1000 par défaut mais n’est ni affiché ni utilisé. Le classement
compétitif Elo sera activé avec le futur mode PvP classé.
