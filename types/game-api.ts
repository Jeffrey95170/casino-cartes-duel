import type { Game, GameMove } from "@/lib/game";

export type Achievement = {
  code: string;
  name: string;
  description: string;
  icon: string;
  unlocked_at?: string;
};

export type PlayerProfile = {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
  leaderboard_eligible: boolean;
};

export type PlayerStats = {
  user_id: string;
  xp: number;
  level: number;
  games_started: number;
  games_completed: number;
  wins: number;
  losses: number;
  draws: number;
  total_cards_captured: number;
  best_cards_captured: number;
  current_win_streak: number;
  best_win_streak: number;
  solo_verified_games: number;
  pvp_rating: number;
  pvp_games: number;
  created_at: string;
  updated_at: string;
};

export type MatchSummary = {
  id: string;
  status: "active" | "completed" | "abandoned" | "invalid";
  player_score: number | null;
  opponent_score: number | null;
  winner: "player" | "opponent" | "draw" | null;
  verified: boolean;
  started_at: string;
  finished_at: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  level: number;
  xp: number;
  wins: number;
  games_completed: number;
  best_cards_captured: number;
  is_current: boolean;
};

export type ProgressReward = {
  verified: true;
  result: "player" | "opponent" | "draw";
  xp_awarded: number;
  old_xp: number;
  new_xp: number;
  old_level: number;
  new_level: number;
  old_rank: number | null;
  new_rank: number | null;
  leaderboard_eligible: boolean;
  achievements_unlocked: Achievement[];
};

export type SoloMatchView = {
  matchId: string;
  version: number;
  game: Game;
  duplicate: boolean;
  progress: ProgressReward | null;
};

export type PlaySoloPayload = {
  matchId: string;
  actionId: string;
  expectedVersion: number;
  action: GameMove | { kind: "continue" } | { kind: "abandon" };
};
