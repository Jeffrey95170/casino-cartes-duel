import type { Card, Game } from "./game.ts";

function hiddenCards(zone: "deck" | "opponent", count: number): Card[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `hidden-${zone}-${index}`,
    suit: "♠",
    rank: "?",
    value: 0,
  }));
}

export function publicGameView(game: Game): Game {
  return {
    ...game,
    deck: hiddenCards("deck", game.deck.length),
    hands: [[...game.hands[0]], hiddenCards("opponent", game.hands[1].length)],
  };
}

export function functionView(result: {
  match_id: string;
  version: number;
  game_state: Game;
  duplicate?: boolean;
  progress?: unknown;
}) {
  return {
    matchId: result.match_id,
    version: result.version,
    game: publicGameView(result.game_state),
    duplicate: Boolean(result.duplicate),
    progress: result.progress ?? null,
  };
}
