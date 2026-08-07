# Casino Cartes Duel

Jeu de cartes stratégique gratuit en trois manches contre un Croupier IA. La bêta
0.2 est conçue pour ordinateur, tablette et smartphone, sans compte, sans mise et
sans argent réel.

## Stack

- Next.js App Router
- React et TypeScript
- CSS natif adaptatif
- Vercel Web Analytics et Speed Insights
- Déploiement Vercel

## Développement

```bash
npm install
npm run dev
```

## Vérifications

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
```

`npm test` compile l’application en production, démarre le serveur Next.js et
vérifie la page d’accueil ainsi que l’image de prévisualisation sociale.

`npm run test:e2e` requiert Chromium (`npx playwright install chromium`) et teste
le tutoriel, les erreurs de somme, une partie complète, le partage, la revanche et
les largeurs mobiles. Les événements mesurés sont détaillés dans
[`ANALYTICS.md`](./ANALYTICS.md).

## Données locales

Le pseudonyme n’est pas persistant et n’est jamais envoyé à l’analytics. Les nombres
de parties, victoires, défaites, égalités et le record restent dans le `localStorage`
du navigateur. Effacer les données du site remet ces statistiques à zéro.
