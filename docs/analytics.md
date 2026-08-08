# Analytics produit — Casino Cartes Duel

## Architecture

Casino Cartes Duel utilise **PostHog Cloud EU** pour le Product Analytics. L’intégration est côté navigateur et reste désactivée tant que la configuration Vercel n’est pas complète.

La couche métier ne dépend pas directement du SDK :

- `instrumentation-client.ts` lance l’initialisation avant l’hydratation Next.js ;
- `lib/analytics.ts` expose `initAnalytics()`, `track()`, `identifyUser()` et `resetUser()` ;
- `lib/analytics/client.ts` contient le client abstrait, la file des événements précoces et l’adaptateur injectable pour les tests ;
- `lib/analytics/events.ts` est le catalogue TypeScript des événements et de leurs propriétés ;
- `lib/analytics/attribution.ts` gère le first-touch et le current-touch ;
- `lib/analytics/auth.ts` coordonne le parcours anonyme → signup/login → logout ;
- `lib/analytics/game.ts` garantit l’unicité des événements de partie ;
- `components/analytics-pageview.tsx` envoie un seul `$pageview` à chaque route Next.js affichée.

Vercel Speed Insights reste actif pour la performance. L’ancien suivi produit Vercel Analytics a été retiré pour éviter deux sources concurrentes de pageviews et d’événements produit.

## Variables d’environnement

```dotenv
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_ANALYTICS_DEBUG=false
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` est le token public du projet PostHog, jamais une clé personnelle ou d’administration.
- `NEXT_PUBLIC_POSTHOG_HOST` pointe vers l’ingestion européenne.
- `NEXT_PUBLIC_ANALYTICS_ENABLED` doit être `true` uniquement dans les environnements qui doivent envoyer des données.
- `NEXT_PUBLIC_ANALYTICS_DEBUG=true` affiche dans la console le nom, l’horodatage et les propriétés de chaque événement. Si l’analytics est désactivé, le debugger affiche quand même les événements mais rien n’est envoyé.

En local, l’analytics est donc désactivé par défaut. Les tests utilisent un adaptateur mémoire et ne contactent jamais PostHog.

## Paramètres de confidentialité

- autocapture désactivé ;
- Session Replay désactivé ;
- pageviews automatiques désactivées au profit d’un suivi SPA manuel sans doublon ;
- création de profil PostHog uniquement après `identify()` (`person_profiles: identified_only`) ;
- respect de Do Not Track activé ;
- enrichissement GeoIP désactivé sur les événements (`$geoip_disable`) ;
- URL de page limitée au chemin et aux cinq paramètres UTM autorisés ;
- referrer réduit à son origine, jamais à son URL complète ;
- aucun email, nom, prénom, mot de passe, JWT, token Supabase, contenu de main ou historique carte par carte n’est envoyé.

PostHog reçoit néanmoins les métadonnées techniques normales d’une requête web et fournit automatiquement des propriétés comme le navigateur, la plateforme ou le type d’appareil. La persistance du visiteur anonyme utilise le stockage navigateur du SDK afin de permettre les analyses D1/D7.

Le projet ne possède pas encore de mécanisme de consentement analytics. Cette intégration ne constitue donc pas une validation juridique RGPD/ePrivacy. Avant une acquisition européenne à grande échelle, faire valider la base légale, la politique de confidentialité, la durée de conservation et le besoin éventuel d’un bandeau de consentement.

## Attribution UTM

Paramètres pris en charge :

- `utm_source` ;
- `utm_medium` ;
- `utm_campaign` ;
- `utm_content` ;
- `utm_term`.

Le **first-touch** est écrit une seule fois dans `localStorage` et survit au passage du compte invité au compte permanent. Le **current-touch** est conservé dans `sessionStorage` et est remplacé lorsqu’une nouvelle URL de campagne contient un paramètre UTM.

Sans UTM, la source devient le domaine référent avec le medium `referral`, ou `direct` / `none` en accès direct.

Convention recommandée : valeurs minuscules, ASCII, mots séparés par `_`, campagne versionnée.

```text
# TikTok
https://casino-cartes-duel.vercel.app/?utm_source=tiktok&utm_medium=social&utm_campaign=validation_01

# Instagram
https://casino-cartes-duel.vercel.app/?utm_source=instagram&utm_medium=social&utm_campaign=validation_01

# Variante créative
https://casino-cartes-duel.vercel.app/?utm_source=tiktok&utm_medium=social&utm_campaign=validation_01&utm_content=video_hook_02
```

Ne jamais placer de donnée personnelle dans un paramètre UTM.

## Dictionnaire d’événements

Les propriétés d’attribution sont ajoutées automatiquement aux événements : `first_touch_source`, `first_touch_medium`, `first_touch_campaign`, `current_touch_source`, `current_touch_medium`, `current_touch_campaign`, `utm_content`, `utm_term`, `landing_page`, `referrer`.

| Événement | Déclencheur exact | Propriétés métier | KPI principal |
|---|---|---|---|
| `signup_started` | Soumission valide du formulaire compte ou clic Google/GitHub après validation du pseudonyme | `method` | Visitor → Signup |
| `signup_completed` | Supabase confirme un utilisateur permanent alors qu’un signup était en attente | `method` | Conversion compte |
| `login_completed` | Événement Supabase `SIGNED_IN` d’un compte permanent sans signup en attente | `method` | Utilisateurs récurrents |
| `rules_viewed` | Ouverture réelle de la modale des règles | `entry_point` | Compréhension |
| `tutorial_started` | Ouverture réelle du tutoriel | `entry_point` | Onboarding |
| `tutorial_completed` | Clic « Jouer » à la dernière étape | `duration_seconds` | Complétion tutoriel |
| `tutorial_skipped` | Clic « Passer » ou fermeture par Échap | `duration_seconds` | Abandon tutoriel |
| `game_started` | Réponse de création de partie reçue et partie réellement initialisée | `game_id`, `game_mode`, `opponent_type`, `ai_difficulty`, `is_first_game`, `player_games_before`, `session_game_number` | Activation, parties/joueur |
| `game_completed` | Passage normal en phase `finished`, une seule fois par `game_id` | `game_id`, `duration_seconds`, `result`, `player_score`, `opponent_score`, `rounds_played`, `opponent_type`, `ai_difficulty`, `player_games_before`, `is_first_game`, `is_second_game`, `session_game_number`, `actions_count`, `captures_count`, `constructions_count` | Complétion, replay, engagement |
| `game_abandoned` | Clic explicite « Quitter » avant la phase `finished` | `game_id`, `elapsed_seconds`, `current_round`, `actions_count`, `opponent_type`, `ai_difficulty`, `abandon_reason`, `player_games_before` | Taux/moment d’abandon |
| `play_again_clicked` | Clic réel « Rejouer » dans l’écran final | `previous_game_id`, `previous_result`, `seconds_since_game_end` | Intention de rejouer |
| `leaderboard_viewed` | Premier affichage de la route Classement | `entry_point` | Intérêt progression/social |
| `$pageview` | Premier affichage et chaque navigation SPA terminée | `$current_url` nettoyée | Acquisition/pages |

`actions_count`, `captures_count` et `constructions_count` comptent uniquement les actions humaines confirmées par le moteur. Les décisions de l’IA et l’état détaillé des cartes ne sont pas envoyés.

## Définition d’un abandon

V1 considère une partie abandonnée seulement si le joueur appuie sur **Quitter** avant la fin. Un refresh, un changement temporaire d’onglet, une perte réseau ou une fermeture du navigateur ne produit aucun `game_abandoned`.

Cette définition sous-estime volontairement certains abandons silencieux mais évite les faux positifs. Une future reprise de partie serveur pourra ajouter une règle de timeout calculée côté backend.

## Identité

PostHog crée automatiquement un identifiant anonyme pour le visiteur. Lorsqu’un compte devient permanent ou qu’un utilisateur se connecte, `identifyUser()` reçoit uniquement l’UUID interne Supabase. L’UUID est stable et pseudonyme ; le pseudo visible et l’email ne sont pas envoyés.

L’appel `identify()` fusionne le parcours anonyme courant avec le compte permanent. Lors d’un `SIGNED_OUT`, `resetUser()` est appelé avant la création de la nouvelle session invitée afin que le prochain utilisateur n’hérite pas de l’identité précédente.

## KPI

### Acquisition

- visiteurs uniques : personnes uniques ayant un `$pageview` ;
- source/campagne : `$pageview` groupé par `first_touch_source`, `current_touch_source` ou `current_touch_campaign` ;
- landing page : `$pageview` groupé par `landing_page`.

### Conversion et activation

- Visitor → Signup : utilisateurs uniques avec `signup_completed` / visiteurs uniques ;
- Signup → Game : utilisateurs avec `game_started` après `signup_completed` ;
- Visitor → Game : utilisateurs avec `game_started` / visiteurs uniques.

### Première expérience

- First-game completion : `game_completed` avec `is_first_game = true` / `game_started` avec `is_first_game = true` ;
- First Game → Second Game : `game_started` avec `player_games_before = 1` après `game_completed` avec `is_first_game = true` ;
- intention immédiate : `play_again_clicked` après le premier `game_completed`.

### Engagement

- parties par joueur : nombre de `game_started` par `distinct_id` ;
- parties par session : moyenne de `session_game_number` maximal ;
- durée moyenne : moyenne de `game_completed.duration_seconds` ;
- win rate : part de `game_completed` où `result = win` ;
- joueurs 2+/3+/5+ : personnes avec au moins 2, 3 ou 5 `game_started`.

### Abandon

- taux d’abandon : `game_abandoned / game_started` ;
- moment moyen : moyenne de `elapsed_seconds` et distribution par `current_round` ;
- première partie : filtre `player_games_before = 0` ; joueurs expérimentés : `player_games_before > 0`.

### Rétention

Créer un insight Retention avec `game_completed` comme événement de départ et `game_started` comme événement de retour, période en jours. Lire les colonnes D1 et D7. Pour la rétention produit globale, une seconde vue peut utiliser `$pageview` comme événement de retour.

## Funnels PostHog

1. **Acquisition** : `$pageview` → `signup_started` → `signup_completed`.
2. **Activation** : `signup_completed` → `game_started` → `game_completed`.
3. **Core Game Loop** : `game_started` (`is_first_game = true`) → `game_completed` (`is_first_game = true`) → `game_started` (`player_games_before = 1`).
4. **Joueur engagé** : `game_completed` (`is_first_game = true`) → `game_started` (`player_games_before = 1`) → `game_started` (`player_games_before = 2`).

Utiliser l’ordre strict. Pour le Core Game Loop, choisir une fenêtre de conversion de 24 heures et comparer ensuite avec 7 jours.

## Dashboard « Casino Duel — Acquisition Validation »

Créer un dashboard puis ajouter les insights suivants :

| # | Tuile | Insight PostHog |
|---|---|---|
| 1 | Visiteurs uniques | Trend `$pageview`, nombre de personnes uniques |
| 2 | Nouveaux comptes | Trend `signup_completed`, personnes uniques |
| 3 | Parties commencées | Trend `game_started`, total |
| 4 | Parties terminées | Trend `game_completed`, total |
| 5 | Taux de complétion | Formula `game_completed / game_started` |
| 6 | First Game → Second Game | Funnel Core Game Loop, conversion étape 2 → 3 |
| 7 | Parties moyennes par joueur | HogQL/SQL : `game_started` / personnes uniques |
| 8 | Joueurs avec 2+ parties | Cohorte ou HogQL par personne, count ≥ 2 |
| 9 | Joueurs avec 3+ parties | Cohorte ou HogQL par personne, count ≥ 3 |
| 10 | Joueurs avec 5+ parties | Cohorte ou HogQL par personne, count ≥ 5 |
| 11 | Taux d’abandon | Formula `game_abandoned / game_started` |
| 12 | Durée moyenne | Trend `game_completed`, agrégation moyenne de `duration_seconds` |
| 13 | Rétention D1 | Retention `game_completed` → `game_started`, jour 1 |
| 14 | Rétention D7 | Même insight, jour 7 |
| 15 | Trafic par source | Trend `$pageview`, breakdown `current_touch_source` |
| 16 | Trafic par campagne | Trend `$pageview`, breakdown `current_touch_campaign` |

Filtres globaux recommandés : exclure les comptes internes/test, bots identifiés et environnements hors production. Segmenter par `first_touch_source`, `current_touch_campaign`, `is_first_game` et `result` lorsque pertinent.

## Activation dans PostHog et Vercel

1. Créer un projet dans **PostHog Cloud EU (Frankfurt)**.
2. Copier son **Project token public**.
3. Dans Vercel → projet Casino Cartes Duel → Settings → Environment Variables, ajouter les quatre variables listées plus haut pour `Production`.
4. Mettre `NEXT_PUBLIC_ANALYTICS_ENABLED=true` et garder `NEXT_PUBLIC_ANALYTICS_DEBUG=false` en production.
5. Redéployer : les variables `NEXT_PUBLIC_*` sont figées lors du build.
6. Ouvrir le site avec un lien UTM de test, démarrer puis quitter une partie, et vérifier dans PostHog Live Events les événements `$pageview`, `game_started` et `game_abandoned`.
7. Marquer le navigateur de test comme utilisateur interne ou supprimer les événements de test avant la campagne.
8. Construire les quatre funnels et le dashboard selon les tableaux ci-dessus.

Aucune clé d’administration PostHog n’est nécessaire dans l’application. Sans credentials PostHog d’administration dans l’environnement de développement, le dashboard n’est volontairement pas créé par API.
