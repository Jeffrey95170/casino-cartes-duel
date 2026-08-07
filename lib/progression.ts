export type MatchResult = "win" | "loss" | "draw";

export type RankedProgress = {
  username: string;
  xp: number;
  wins: number;
  bestCardsCaptured: number;
  createdAt: string;
};

export const XP_BY_RESULT: Record<MatchResult, number> = {
  win: 50,
  draw: 35,
  loss: 20,
};

export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

export function xpForResult(result: MatchResult): number {
  return XP_BY_RESULT[result];
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

export function xpThresholdForLevel(level: number): number {
  return 100 * Math.max(0, Math.floor(level) - 1) ** 2;
}

export function xpProgress(xp: number) {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = levelForXp(safeXp);
  const currentThreshold = xpThresholdForLevel(level);
  const nextThreshold = xpThresholdForLevel(level + 1);
  return {
    level,
    currentThreshold,
    nextThreshold,
    earnedThisLevel: safeXp - currentThreshold,
    neededThisLevel: nextThreshold - currentThreshold,
    percent: ((safeXp - currentThreshold) / (nextThreshold - currentThreshold)) * 100,
  };
}

export function winRate(wins: number, gamesCompleted: number): number {
  if (gamesCompleted <= 0) return 0;
  return Math.round((Math.max(0, wins) / gamesCompleted) * 1000) / 10;
}

export function nextWinStreak(currentStreak: number, result: MatchResult): number {
  return result === "win" ? Math.max(0, currentStreak) + 1 : 0;
}

export function isValidUsername(username: string): boolean {
  return username === username.trim() && USERNAME_PATTERN.test(username);
}

export function normalizeUsername(username: string): string {
  return username.trim().toLocaleLowerCase("fr-FR");
}

export function isLeaderboardEligible(input: {
  isAnonymous: boolean;
  username: string;
  soloVerifiedGames: number;
}): boolean {
  return !input.isAnonymous && isValidUsername(input.username) && input.soloVerifiedGames >= 3;
}

export function sortProgressLeaderboard<T extends RankedProgress>(entries: T[]): T[] {
  return [...entries].sort((first, second) =>
    second.xp - first.xp
    || second.wins - first.wins
    || second.bestCardsCaptured - first.bestCardsCaptured
    || first.createdAt.localeCompare(second.createdAt)
    || first.username.localeCompare(second.username),
  );
}

export function appendUniqueAchievement(codes: string[], code: string): string[] {
  return codes.includes(code) ? [...codes] : [...codes, code];
}
