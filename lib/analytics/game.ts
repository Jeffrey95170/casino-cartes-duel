import { track } from "../analytics.ts";
import type { AnalyticsEventMap, GameResult } from "./events.ts";

const SESSION_GAME_COUNT_KEY = "casino-duel:analytics:session-games:v1";

type GameAnalyticsRecorder = {
  started: (properties: AnalyticsEventMap["game_started"]) => void;
  completed: (properties: AnalyticsEventMap["game_completed"]) => void;
  abandoned: (properties: AnalyticsEventMap["game_abandoned"]) => void;
  playAgain: (properties: AnalyticsEventMap["play_again_clicked"]) => void;
};

type ActiveGame = {
  gameId: string;
  playerGamesBefore: number;
  sessionGameNumber: number;
  startedAt: number;
  actionsCount: number;
  capturesCount: number;
  constructionsCount: number;
  resolved: boolean;
};

type CompletedGame = {
  gameId: string;
  result: GameResult;
  completedAt: number;
};

const defaultRecorder: GameAnalyticsRecorder = {
  started: (properties) => track("game_started", properties),
  completed: (properties) => track("game_completed", properties),
  abandoned: (properties) => track("game_abandoned", properties),
  playAgain: (properties) => track("play_again_clicked", properties),
};

function nextSessionGameNumber(): number {
  if (typeof window === "undefined") return 1;
  try {
    const next = Math.max(0, Number(window.sessionStorage.getItem(SESSION_GAME_COUNT_KEY)) || 0) + 1;
    window.sessionStorage.setItem(SESSION_GAME_COUNT_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

function secondsBetween(start: number, end: number): number {
  return Math.max(0, Math.round((end - start) / 1000));
}

export class GameAnalyticsTracker {
  private active: ActiveGame | null = null;
  private lastCompleted: CompletedGame | null = null;
  private readonly recorder: GameAnalyticsRecorder;
  private readonly now: () => number;
  private readonly getSessionGameNumber: () => number;

  constructor(
    recorder: GameAnalyticsRecorder = defaultRecorder,
    now: () => number = Date.now,
    getSessionGameNumber: () => number = nextSessionGameNumber,
  ) {
    this.recorder = recorder;
    this.now = now;
    this.getSessionGameNumber = getSessionGameNumber;
  }

  start(input: { gameId: string; playerGamesBefore: number }): boolean {
    if (this.active?.gameId === input.gameId) return false;
    const playerGamesBefore = this.active?.resolved && this.lastCompleted?.gameId === this.active.gameId
      ? Math.max(input.playerGamesBefore, this.active.playerGamesBefore + 1)
      : input.playerGamesBefore;
    const sessionGameNumber = this.getSessionGameNumber();
    this.active = {
      gameId: input.gameId,
      playerGamesBefore,
      sessionGameNumber,
      startedAt: this.now(),
      actionsCount: 0,
      capturesCount: 0,
      constructionsCount: 0,
      resolved: false,
    };
    this.recorder.started({
      ...this.baseProperties(this.active),
      is_first_game: playerGamesBefore === 0,
      session_game_number: sessionGameNumber,
    });
    return true;
  }

  noteAction(kind: "capture" | "build" | "discard"): void {
    if (!this.active || this.active.resolved) return;
    this.active.actionsCount += 1;
    if (kind === "capture") this.active.capturesCount += 1;
    if (kind === "build") this.active.constructionsCount += 1;
  }

  complete(input: {
    gameId: string;
    result: GameResult;
    playerScore: number;
    opponentScore: number;
    roundsPlayed: number;
  }): boolean {
    if (!this.active || this.active.gameId !== input.gameId || this.active.resolved) return false;
    const completedAt = this.now();
    this.active.resolved = true;
    this.recorder.completed({
      ...this.baseProperties(this.active),
      duration_seconds: secondsBetween(this.active.startedAt, completedAt),
      result: input.result,
      player_score: input.playerScore,
      opponent_score: input.opponentScore,
      rounds_played: input.roundsPlayed,
      is_first_game: this.active.playerGamesBefore === 0,
      is_second_game: this.active.playerGamesBefore === 1,
      session_game_number: this.active.sessionGameNumber,
      actions_count: this.active.actionsCount,
      captures_count: this.active.capturesCount,
      constructions_count: this.active.constructionsCount,
    });
    this.lastCompleted = { gameId: input.gameId, result: input.result, completedAt };
    return true;
  }

  abandon(input: { gameId: string; currentRound: number }): boolean {
    if (!this.active || this.active.gameId !== input.gameId || this.active.resolved) return false;
    this.active.resolved = true;
    this.recorder.abandoned({
      ...this.baseProperties(this.active),
      elapsed_seconds: secondsBetween(this.active.startedAt, this.now()),
      current_round: input.currentRound,
      actions_count: this.active.actionsCount,
      abandon_reason: "quit_button",
    });
    return true;
  }

  playAgainClicked(): boolean {
    if (!this.lastCompleted) return false;
    this.recorder.playAgain({
      previous_game_id: this.lastCompleted.gameId,
      previous_result: this.lastCompleted.result,
      seconds_since_game_end: secondsBetween(this.lastCompleted.completedAt, this.now()),
    });
    return true;
  }

  private baseProperties(active: ActiveGame) {
    return {
      game_id: active.gameId,
      game_mode: "solo" as const,
      opponent_type: "ai" as const,
      ai_difficulty: "strategic" as const,
      player_games_before: active.playerGamesBefore,
    };
  }
}
