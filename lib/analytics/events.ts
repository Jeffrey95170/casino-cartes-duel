export type SignupMethod = "email" | "google" | "github";
export type GameResult = "win" | "loss" | "draw";

export type AttributionProperties = {
  first_touch_source: string;
  first_touch_medium: string;
  first_touch_campaign?: string;
  current_touch_source: string;
  current_touch_medium: string;
  current_touch_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing_page: string;
  referrer?: string;
};

type GameBaseProperties = {
  game_id: string;
  game_mode: "solo";
  opponent_type: "ai";
  ai_difficulty: "strategic";
  player_games_before: number;
};

export type AnalyticsEventMap = {
  signup_started: {
    method: SignupMethod;
  };
  signup_completed: {
    method: SignupMethod;
  };
  login_completed: {
    method: SignupMethod;
  };
  rules_viewed: {
    entry_point: "setup" | "game_header";
  };
  tutorial_started: {
    entry_point: "first_game" | "home" | "header" | "rules";
  };
  tutorial_completed: {
    duration_seconds: number;
  };
  tutorial_skipped: {
    duration_seconds: number;
  };
  game_started: GameBaseProperties & {
    is_first_game: boolean;
    session_game_number: number;
  };
  game_completed: GameBaseProperties & {
    duration_seconds: number;
    result: GameResult;
    player_score: number;
    opponent_score: number;
    rounds_played: number;
    is_first_game: boolean;
    is_second_game: boolean;
    session_game_number: number;
    actions_count: number;
    captures_count: number;
    constructions_count: number;
  };
  game_abandoned: GameBaseProperties & {
    elapsed_seconds: number;
    current_round: number;
    actions_count: number;
    abandon_reason: "quit_button";
  };
  play_again_clicked: {
    previous_game_id: string;
    previous_result: GameResult;
    seconds_since_game_end: number;
  };
  leaderboard_viewed: {
    entry_point: string;
  };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;
