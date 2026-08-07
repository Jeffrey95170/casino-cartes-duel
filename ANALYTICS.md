# Mesure d’usage respectueuse de la vie privée

La bêta utilise **Vercel Web Analytics** pour les visites de page et des événements
produit agrégés. Elle utilise aussi **Vercel Speed Insights** pour les indicateurs de
performance réels. Aucun compte joueur n’est créé et aucun pseudonyme n’est envoyé.

## Événements

- `play_clicked` : clic sur « Jouer maintenant » ;
- `tutorial_started`, `tutorial_completed`, `tutorial_skipped` : parcours du tutoriel ;
- `game_started`, `game_completed` : début et fin d’une partie ;
- `game_won`, `game_lost`, `game_drawn` : résultat agrégé ;
- `replay_clicked` : nouvelle partie depuis l’écran final ;
- `share_clicked`, `share_completed`, `link_copied` : utilisation du partage.

Les seuls paramètres éventuels sont la source du tutoriel et les scores numériques.
Ils ne permettent pas d’identifier un joueur. Les statistiques personnelles restent
exclusivement dans `localStorage` sous la clé versionnée `casino-duel:stats:v1`.

Les bloqueurs de publicité ou l’usage hors ligne peuvent empêcher la mesure. Cela
n’a aucun effet sur le jeu.
