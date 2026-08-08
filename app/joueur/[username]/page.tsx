"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";
import type { Achievement } from "@/types/game-api";

type PublicProfile = { username: string; level: number; xp: number; rank: number; games_completed: number; wins: number; win_rate: number; best_win_streak: number; best_cards_captured: number; achievements: Achievement[] };

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(hasSupabaseConfig());

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.rpc("get_public_profile", { p_username: decodeURIComponent(params.username) }).then(({ data }) => {
      setProfile(data as PublicProfile | null); setLoading(false);
    });
  }, [params.username]);

  async function share() {
    const data = { title: `Profil de ${profile?.username}`, text: `Découvrez le profil Casino de ${profile?.username}`, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined); else await navigator.clipboard.writeText(window.location.href);
  }

  return <main className="portal-shell"><AppHeader />{loading ? <p className="portal-loading">Chargement du profil…</p> : profile ? <div className="portal-content narrow"><section className="profile-hero public"><div className="profile-avatar">{profile.username.slice(0, 1).toUpperCase()}</div><div><p className="eyebrow">Profil public</p><h1>{profile.username}</h1><p>Niveau {profile.level} · #{profile.rank} · {profile.xp} XP</p></div><button className="secondary-button" onClick={share}>Partager</button></section><section className="stats-grid public"><article><span>Parties</span><b>{profile.games_completed}</b></article><article><span>Victoires</span><b>{profile.wins}</b></article><article><span>Win rate</span><b>{profile.win_rate} %</b></article><article><span>Meilleure série</span><b>{profile.best_win_streak}</b></article><article><span>Record de cartes</span><b>{profile.best_cards_captured}</b></article></section><section className="portal-card"><p className="eyebrow">Badges publics</p><h2>Succès</h2>{profile.achievements.length ? <div className="achievement-list">{profile.achievements.map((item) => <article key={item.code}><span>{item.icon}</span><div><b>{item.name}</b><small>{item.description}</small></div></article>)}</div> : <p className="muted-copy">Aucun succès public pour le moment.</p>}</section></div> : <section className="empty-state"><h1>Profil introuvable</h1><p>Ce joueur n’est pas encore éligible au classement progression.</p><Link className="primary-link" href="/classement">Voir le classement</Link></section>}</main>;
}
