# Mesure d’usage respectueuse de la vie privée

Le jeu utilise **Vercel Web Analytics** pour les visites de page et des événements
produit agrégés. Il utilise aussi **Vercel Speed Insights** pour les indicateurs de
performance réels. Aucun pseudonyme, email, JWT, secret ou contenu de main n’est envoyé.

## Événements

- `play_clicked` : clic sur « Jouer maintenant » ;
- `tutorial_started`, `tutorial_completed`, `tutorial_skipped` : parcours du tutoriel ;
- `game_started`, `game_completed` : début et fin d’une partie ;
- `game_won`, `game_lost`, `game_drawn` : résultat agrégé ;
- `replay_clicked` : nouvelle partie depuis l’écran final ;
- `share_clicked`, `share_completed`, `link_copied` : utilisation du partage.
- `anonymous_session_created`, `account_upgrade_started`, `account_created`,
  `login`, `logout` : cycle du compte, sans email ni UUID ;
- `profile_viewed`, `leaderboard_viewed`, `leaderboard_my_position` : navigation ;
- `match_started`, `match_completed_verified`, `match_abandoned`, `match_invalid` ;
- `xp_awarded`, `level_up`, `achievement_unlocked` ;
- `share_profile`, `share_result`.

Les seuls paramètres éventuels sont la source du tutoriel et les scores numériques.
Ils ne permettent pas d’identifier un joueur. Les anciennes statistiques du
`localStorage` sous `casino-duel:stats:v1` restent un historique local non classé.

Les bloqueurs de publicité ou l’usage hors ligne peuvent empêcher la mesure. Cela
n’a aucun effet sur le jeu.
