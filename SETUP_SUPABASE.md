# Installation Supabase

## Projet hébergé

- projet : `casino-cartes-duel` ;
- référence : `ngygdguonliysmsemsok` ;
- région : `eu-west-3` (Paris) ;
- URL API : `https://ngygdguonliysmsemsok.supabase.co`.

## Variables d’environnement

Créer `.env.local` à partir de `.env.example` :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Utiliser exclusivement une clé moderne `sb_publishable_...` dans le frontend.
Ne jamais placer `sb_secret_...`, la service-role key, un mot de passe ou un JWT
dans Next.js, Vercel frontend, GitHub, les logs ou le localStorage. Les Edge
Functions reçoivent automatiquement leurs variables serveur Supabase.

## Auth à activer dans le tableau de bord

1. Authentication → Providers → Anonymous Sign-Ins → Enable ;
2. Authentication → Settings → Manual Linking → Enable, nécessaire à
   `linkIdentity()` pour conserver l’UUID invité ;
3. Authentication → URL Configuration : ajouter
   `https://casino-cartes-duel.vercel.app` aux redirect URLs ;
4. Email : activer les confirmations avant production.

Le frontend appelle `signInAnonymously()` à la première visite. Le trigger
`on_auth_user_created_casino` crée immédiatement `profiles` et `player_stats`.
La conversion email/mot de passe utilise `updateUser()` ; la liaison Google
utilise `linkIdentity()`. Dans les deux cas, le code vérifie que l’UUID reste le
même et n’insère jamais un second profil.

## Google facultatif

1. créer un client OAuth Web dans Google Cloud ;
2. copier l’URL de callback affichée dans Authentication → Providers → Google ;
3. ajouter cette URL aux URI de redirection Google ;
4. saisir Client ID et Client Secret uniquement dans le dashboard Supabase ;
5. activer Google et conserver Manual Linking actif.

Sans cette configuration, le bouton Google affiche une erreur compréhensible ;
la conversion email reste disponible.

## Migrations et fonctions

```bash
npx supabase login
npx supabase link --project-ref ngygdguonliysmsemsok
npx supabase db push
npx supabase functions deploy start-solo-match --verify-jwt
npx supabase functions deploy play-solo-action --verify-jwt
npx supabase gen types typescript --linked > types/database.types.ts
```

Les migrations sont appliquées dans l’ordre : schéma, RLS/RPC publiques, puis
transactions d’autorité. Ne modifier jamais une migration déjà en production ;
ajouter une nouvelle migration.

## Développement local Supabase

Docker est requis :

```bash
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase functions serve --env-file supabase/.env.local
```

Le fichier local destiné aux secrets Edge doit rester ignoré. Le dépôt ne
contient aucun secret serveur.

## Vercel

Ajouter aux environnements Production, Preview et Development :

- `NEXT_PUBLIC_SUPABASE_URL` ;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Relancer ensuite un déploiement production. Aucune clé serveur Supabase n’est
nécessaire sur Vercel pour cette application.
