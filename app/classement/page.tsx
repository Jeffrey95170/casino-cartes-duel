"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { track } from "@/lib/analytics";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { LeaderboardEntry } from "@/types/game-api";

export default function LeaderboardPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<"top" | "me">("top");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasTrackedView = useRef(false);

  const load = useCallback(async (nextMode: "top" | "me") => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const result = nextMode === "top"
      ? await supabase.rpc("get_leaderboard", { p_limit: 100 })
      : await supabase.rpc("get_my_leaderboard_window", { p_radius: 3 });
    if (result.error) setError(result.error.message);
    setEntries(result.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;
    let entryPoint = "direct";
    try {
      const referrer = new URL(document.referrer);
      if (referrer.origin === window.location.origin) entryPoint = referrer.pathname;
      else entryPoint = "external_referrer";
    } catch {
      // Direct visit: keep the privacy-safe fallback without the full referrer URL.
    }
    track("leaderboard_viewed", { entry_point: entryPoint });
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.rpc("get_leaderboard", { p_limit: 100 }).then((result) => {
      if (result.error) setError(result.error.message);
      setEntries(result.data ?? []);
      setLoading(false);
    });
  }, []);

  function changeMode(nextMode: "top" | "me") {
    setMode(nextMode);
    void load(nextMode);
  }

  return (
    <main className="portal-shell">
      <AppHeader />
      <div className="portal-content narrow">
        <section className="leaderboard-heading"><p className="eyebrow">Progression V1</p><h1>Classement progression</h1><p>Progressez en jouant et grimpez parmi les joueurs de Casino Cartes Duel.</p></section>
        <div className="leaderboard-tabs" role="tablist"><button role="tab" aria-selected={mode === "top"} onClick={() => changeMode("top")}>Top 100</button><button role="tab" aria-selected={mode === "me"} onClick={() => changeMode("me")}>Ma position</button></div>
        {loading ? <p className="portal-loading">Chargement du classement…</p> : error ? <p className="server-error dark">{error}</p> : entries.length ? (
          <section className="leaderboard-list" aria-label="Classement des joueurs">
            {entries.map((entry) => <Link href={`/joueur/${encodeURIComponent(entry.username)}`} className={entry.is_current ? "current" : ""} key={`${entry.rank}-${entry.username}`}><span className="rank-medal">{entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}</span><span className="leader-name"><b>{entry.username}</b><small>Niveau {entry.level} · {entry.games_completed} parties</small></span><span><b>{entry.xp}</b><small>XP</small></span><span className="leader-wins"><b>{entry.wins}</b><small>victoires</small></span></Link>)}
          </section>
        ) : <section className="empty-state compact"><h2>{mode === "me" ? "Pas encore classé" : "Le classement démarre bientôt"}</h2><p>{mode === "me" && auth.isAnonymous ? "Crée ton compte puis termine 3 parties vérifiées. Ta progression invitée sera conservée." : "Les joueurs permanents apparaissent après 3 parties solo vérifiées."}</p>{auth.isAnonymous && <Link className="primary-link" href="/compte">Sauvegarder ma progression</Link>}</section>}
        <p className="ranking-note">Ce classement mesure la progression en solo. Le futur classement compétitif Elo sera activé avec le PvP classé.</p>
      </div>
    </main>
  );
}
