# Casino Cartes Duel

Jeu de cartes stratégique gratuit en trois manches contre un Croupier IA. La
progression V1 ajoute un compte invité automatique, l’XP, les niveaux, les
statistiques, les succès, l’historique et un classement progression public.
Le jeu reste sans mise et sans argent réel.

## Architecture

- Next.js 16 App Router, React 19 et TypeScript strict ;
- moteur de jeu pur partagé entre le frontend et les Edge Functions ;
- Supabase Auth anonyme transformable en compte permanent ;
- PostgreSQL avec migrations versionnées, transactions atomiques et RLS ;
- Edge Functions `start-solo-match` et `play-solo-action` avec JWT obligatoire ;
- Vercel Web Analytics, Speed Insights et hébergement Vercel.

Le navigateur n’envoie qu’une intention de jeu. L’état complet, la pioche, la
main de l’IA, le résultat, l’XP, le niveau et les succès sont décidés côté
serveur. Une partie locale reste possible sans configuration Supabase, mais elle
est explicitement non classée et ne crédite aucun XP.

## Développement

```bash
npm install
cp .env.example .env.local
npm run dev
```

Renseigner uniquement les deux variables publiques décrites dans
[`SETUP_SUPABASE.md`](./SETUP_SUPABASE.md). Le projet Next.js utilise le préfixe
`NEXT_PUBLIC_` — l’équivalent correct de `VITE_` pour cette architecture.

## Vérifications

```bash
npm run typecheck
npm run lint
npm run test:unit
npm test
npm run test:e2e
npx supabase test db
```

`npm test` exécute les tests Node, compile l’application en production puis
effectue un smoke test HTTP. Les tests SQL vérifient réellement que le rôle
`authenticated` ne peut ni modifier les statistiques, ni forger un résultat,
ni accéder à l’état privé d’une partie.

## Données locales existantes

Les anciennes statistiques sous `casino-duel:stats:v1` sont conservées comme
historique local. Elles ne sont jamais converties en XP ou en classement, car
elles ne sont pas vérifiables côté serveur.

## Documentation

- [`SETUP_SUPABASE.md`](./SETUP_SUPABASE.md) : installation, Auth et déploiement ;
- [`DATABASE.md`](./DATABASE.md) : tables, RPC, RLS et progression ;
- [`SECURITY.md`](./SECURITY.md) : modèle anti-triche et réponse aux abus ;
- [`ANALYTICS.md`](./ANALYTICS.md) : événements sans données sensibles.

Le champ `pvp_rating` est réservé au futur PvP. Le classement actuel mesure la
progression solo ; le classement compétitif Elo sera activé avec le mode PvP classé.
