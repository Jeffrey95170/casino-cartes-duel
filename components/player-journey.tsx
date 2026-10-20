import Link from "next/link";
import { xpProgress } from "@/lib/progression";
import { ACHIEVEMENT_CATALOG, careerGoals, playerTitle } from "@/lib/player-journey";
import type { Achievement, PlayerStats } from "@/types/game-api";

export function LevelProgress({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const progress = xpProgress(xp);
  return <section className={`journey-level${compact ? " compact" : ""}`} aria-label="Progression de niveau">
    <div className="journey-level-heading"><span className="level-emblem">{progress.level}</span><div><b>{playerTitle(progress.level)}</b><small>Niveau {progress.level} · {xp} XP</small></div><span>{progress.nextThreshold - xp} XP<br /><small>avant le niveau {progress.level + 1}</small></span></div>
    <progress max={progress.neededThisLevel} value={progress.earnedThisLevel} aria-label={`Progression vers le niveau ${progress.level + 1}`} />
    {compact && <Link href="/profil" className="text-link">Objectifs et succès →</Link>}
  </section>;
}

export function CareerGoals({ stats }: { stats: PlayerStats }) {
  return <section className="portal-card career-section"><p className="eyebrow">Un duel après l’autre</p><h2>Prochains objectifs</h2><p className="muted-copy">Des paliers personnels pour suivre tes progrès. L’XP reste attribuée à chaque partie vérifiée : victoire +50, égalité +35, défaite +20.</p><div className="career-goals">{careerGoals(stats).map((goal) => <article key={goal.label}><span>{goal.complete ? "✦ Palier atteint" : "Prochain palier"}</span><h3>{goal.label}</h3><b>{goal.value.toLocaleString("fr-FR")} <small>/ {goal.target.toLocaleString("fr-FR")}</small></b><progress value={Math.min(goal.value, goal.target)} max={goal.target} aria-label={goal.label} /></article>)}</div><p className="streak-line">🔥 Série actuelle : <b>{stats.current_win_streak} victoire{stats.current_win_streak > 1 ? "s" : ""}</b> · Record : {stats.best_win_streak}</p></section>;
}

export function AchievementCollection({ achievements }: { achievements: Achievement[] }) {
  const unlocked = new Map(achievements.map((item) => [item.code, item]));
  return <section className="portal-card"><div className="section-heading"><div><p className="eyebrow">Collection</p><h2>Les 6 défis Capture 52</h2></div><b>{ACHIEVEMENT_CATALOG.filter((item) => unlocked.has(item.code)).length}/6</b></div><div className="achievement-gallery">{ACHIEVEMENT_CATALOG.map((item) => <article key={item.code} className={unlocked.has(item.code) ? "unlocked" : "locked"}><span className="achievement-symbol" aria-hidden="true">{item.icon}</span><div><small>{unlocked.has(item.code) ? "✦ Débloqué" : "À débloquer"}</small><h3>{item.name}</h3><p>{item.description}</p></div></article>)}</div></section>;
}
