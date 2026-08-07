import { track } from "@vercel/analytics";

export type ProductEvent =
  | "play_clicked"
  | "tutorial_started"
  | "tutorial_completed"
  | "tutorial_skipped"
  | "game_started"
  | "game_completed"
  | "game_won"
  | "game_lost"
  | "game_drawn"
  | "replay_clicked"
  | "share_clicked"
  | "share_completed"
  | "link_copied";

export function trackProductEvent(
  name: ProductEvent,
  properties?: Record<string, string | number | boolean>,
) {
  try {
    track(name, properties);
  } catch {
    // Analytics must never interrupt a game, including with blockers or offline use.
  }
}
