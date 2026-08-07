# Sécurité

## Autorité et anti-triche

Le navigateur ne reçoit jamais l’ordre futur de la pioche ni la main de l’IA.
Il envoie `matchId`, `expectedVersion`, `actionId` et l’intention de jeu. Les Edge
Functions authentifient le JWT, rechargent l’état privé, appliquent le moteur,
font jouer l’IA, vérifient les 52 cartes puis appellent une transaction SQL
réservée à `service_role`.

Le client ne peut pas attribuer d’XP, modifier un niveau ou un rating, fabriquer
un match vérifié, lire `game_sessions` ou débloquer un succès. Les erreurs de
version renvoient un conflit ; un invariant violé invalide la partie et ne donne
aucune récompense.

## Défenses contre les abus

- 6 démarrages maximum par minute et par utilisateur ;
- 120 actions maximum par minute et par utilisateur ;
- identifiants UUID strictement validés ;
- contraintes d’unicité sur `request_id`, `action_id` et les succès ;
- advisory lock utilisateur et verrou de ligne de session ;
- JWT obligatoire sur les deux Edge Functions ;
- aucun secret dans le bundle ou les événements analytics.

Supabase limite aussi la création de sessions anonymes par IP. En cas de hausse
du trafic automatisé, activer CAPTCHA/Cloudflare Turnstile dans Supabase Auth.
Cette protection externe est recommandée avant une campagne d’acquisition mais
n’empêche pas le lancement initial.

## Tests

`supabase/tests/rls.sql` tente réellement toutes les opérations sensibles avec
le rôle `authenticated`. Il doit rester vert avant chaque migration production.
Les tests Node contrôlent la conservation des 52 cartes, le masquage des zones
privées, les règles XP/niveau et le tri du classement.

## Signalement

Ne jamais joindre un JWT, une clé, un mot de passe ou l’état complet d’une partie
à un rapport public. Invalider immédiatement une clé serveur soupçonnée d’avoir
fuité et examiner les journaux Auth, Edge Functions et PostgreSQL.
