export type GameStats = {
  gamesStarted: number;
  gamesCompleted: number;
  wins: number;
  losses: number;
  draws: number;
  bestCaptured: number;
};

const STATS_KEY = "casino-duel:stats:v1";
const TUTORIAL_KEY = "casino-duel:tutorial:v1";

export const EMPTY_STATS: GameStats = {
  gamesStarted: 0,
  gamesCompleted: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  bestCaptured: 0,
};

export function readStats(): GameStats {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STATS_KEY) ?? "null") as Partial<GameStats> | null;
    if (!parsed) return EMPTY_STATS;
    return {
      gamesStarted: Number(parsed.gamesStarted) || 0,
      gamesCompleted: Number(parsed.gamesCompleted) || 0,
      wins: Number(parsed.wins) || 0,
      losses: Number(parsed.losses) || 0,
      draws: Number(parsed.draws) || 0,
      bestCaptured: Number(parsed.bestCaptured) || 0,
    };
  } catch {
    return EMPTY_STATS;
  }
}

export function writeStats(stats: GameStats): GameStats {
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Storage can be unavailable in private modes; the in-memory value still works.
  }
  return stats;
}

export function incrementStarted(stats: GameStats): GameStats {
  return writeStats({ ...stats, gamesStarted: stats.gamesStarted + 1 });
}

export function recordResult(
  stats: GameStats,
  playerScore: number,
  result: "win" | "loss" | "draw",
): GameStats {
  return writeStats({
    ...stats,
    gamesCompleted: stats.gamesCompleted + 1,
    wins: stats.wins + (result === "win" ? 1 : 0),
    losses: stats.losses + (result === "loss" ? 1 : 0),
    draws: stats.draws + (result === "draw" ? 1 : 0),
    bestCaptured: Math.max(stats.bestCaptured, playerScore),
  });
}

export function hasSeenTutorial(): boolean {
  try {
    return window.localStorage.getItem(TUTORIAL_KEY) === "seen";
  } catch {
    return false;
  }
}

export function rememberTutorial(): void {
  try {
    window.localStorage.setItem(TUTORIAL_KEY, "seen");
  } catch {
    // The tutorial will simply be offered again next time.
  }
}
