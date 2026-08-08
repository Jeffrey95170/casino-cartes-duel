"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { xpProgress, winRate } from "@/lib/progression";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LeaderboardEntry } from "@/types/game-api";

export default function ProfilePage() {
  const auth = useAuth();
  const [position, setPosition] = useState<LeaderboardEntry | null>(null);
  const progression = xpProgress(auth.stats?.xp ?? 0);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !auth.session || !auth.profile?.leaderboard_eligible) return;
    void supabase.rpc("get_my_leaderboard_window", { p_radius: 3 }).then(({ data }) => {
      setPosition((data ?? []).find((entry) => entry.is_current) ?? null);
    });
  }, [auth.profile?.leaderboard_eligible, auth.session]);

  if (auth.loading) return <main className="portal-shell"><AppHeader /><p className="portal-loading">Chargement du profil…</p></main>;
  if (!auth.configured || !auth.profile || !auth.stats) {
    return (
      <main className="portal-shell"><AppHeader /><section className="empty-state"><h1>Profil indisponible</h1><p>Supabase doit être configuré pour enregistrer la progression.</p><Link className="primary-link" href="/">Retour au jeu</Link></section></main>
    );
  }

  async function shareProfile() {
    const shareUrl = `${window.location.origin}/joueur/${encodeURIComponent(auth.profile!.username)}`;
    const data = { title: `Profil de ${auth.profile?.username}`, text: "Mon profil Casino Cartes Duel", url: shareUrl };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else await navigator.clipboard.writeText(shareUrl);
  }

  return (
    <main className="portal-shell">
      <AppHeader />
      <div className="portal-content">
        <section className="profile-hero">
          <div className="profile-avatar">{auth.profile.username.slice(0, 1).toUpperCase()}</div>
          <div><p className="eyebrow">{auth.isAnonymous ? "Compte invité" : "Profil joueur"}</p><h1>{auth.profile.username}</h1><p>Niveau {auth.stats.level} · {auth.stats.xp} XP</p></div>
          <div className="profile-actions">
            {auth.isAnonymous && <Link className="primary-link" href="/compte">Sauvegarder ma progression</Link>}
            {!auth.isAnonymous && auth.profile.leaderboard_eligible && <button className="secondary-button" onClick={shareProfile}>Partager</button>}
          </div>
        </section>

        <section className="xp-card" aria-label="Progression XP">
          <div><b>Niveau {progression.level}</b><span>{auth.stats.xp} / {progression.nextThreshold} XP</span></div>
          <div className="xp-track"><span style={{ width: `${progression.percent}%` }} /></div>
          <small>{progression.nextThreshold - auth.stats.xp} XP avant le niveau suivant</small>
        </section>

        <section className="stats-grid">
          <article><span>Parties</span><b>{auth.stats.games_completed}</b></article>
          <article><span>Victoires</span><b>{auth.stats.wins}</b></article>
          <article><span>Défaites</span><b>{auth.stats.losses}</b></article>
          <article><span>Égalités</span><b>{auth.stats.draws}</b></article>
          <article><span>Win rate</span><b>{winRate(auth.stats.wins, auth.stats.games_completed)} %</b></article>
          <article><span>Cartes capturées</span><b>{auth.stats.total_cards_captured}</b></article>
          <article><span>Record de cartes</span><b>{auth.stats.best_cards_captured}</b></article>
          <article><span>Meilleure série</span><b>{auth.stats.best_win_streak}</b></article>
        </section>

        <div className="portal-columns">
          <section className="portal-card">
            <div className="section-heading"><div><p className="eyebrow">Collection</p><h2>Succès obtenus</h2></div><b>{auth.achievements.length}/6</b></div>
            {auth.achievements.length ? <div className="achievement-list">{auth.achievements.map((item) => <article key={item.code}><span>{item.icon}</span><div><b>{item.name}</b><small>{item.description}</small></div></article>)}</div> : <p className="muted-copy">Termine une partie vérifiée pour débloquer tes premiers succès.</p>}
          </section>
          <section className="portal-card">
            <p className="eyebrow">Progression</p><h2>Classement</h2>
            {position ? <div className="rank-callout"><strong>#{position.rank}</strong><span>au classement progression</span></div> : <p className="muted-copy">{auth.isAnonymous ? "Crée ton compte et termine 3 parties vérifiées pour apparaître." : `${Math.max(0, 3 - auth.stats.solo_verified_games)} partie(s) vérifiée(s) avant l’éligibilité.`}</p>}
            <Link className="text-link portal-link" href="/classement">Voir le classement</Link>
          </section>
        </div>

        <section className="portal-card">
          <p className="eyebrow">20 dernières</p><h2>Historique des parties</h2>
          {auth.matches.length ? <div className="history-list">{auth.matches.map((match) => <article key={match.id}><b>{match.winner === "player" ? "Victoire" : match.winner === "draw" ? "Égalité" : match.status === "completed" ? "Défaite" : "Partie interrompue"}</b><span>{match.player_score ?? "—"} – {match.opponent_score ?? "—"}</span><small>{new Date(match.started_at).toLocaleDateString("fr-FR")}{match.verified ? " · vérifiée" : ""}</small></article>)}</div> : <p className="muted-copy">Aucune partie enregistrée.</p>}
        </section>
      </div>
    </main>
  );
}
