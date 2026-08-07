import assert from "node:assert/strict";
import test from "node:test";

import {
  applyMove,
  assertGameInvariant,
  chooseStrategicMove,
  continueRound,
  createInitialGame,
} from "../lib/game.ts";
import { publicGameView } from "../supabase/functions/_shared/view.ts";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test("la vue Edge cache l’ordre de la pioche et la main du Croupier", () => {
  const game = createInitialGame("Ada", seededRandom(7));
  const view = publicGameView(game);
  assert.equal(view.deck.length, game.deck.length);
  assert.equal(view.hands[1].length, game.hands[1].length);
  assert.ok(view.deck.every((card) => card.rank === "?" && card.id.startsWith("hidden-deck-")));
  assert.ok(view.hands[1].every((card) => card.rank === "?" && card.id.startsWith("hidden-opponent-")));
  assert.deepEqual(view.hands[0], game.hands[0]);
});

test("le moteur serveur conserve 52 cartes uniques jusqu’au résultat", () => {
  let game = createInitialGame("Ada", seededRandom(81));
  let actions = 0;
  while (game.phase !== "finished") {
    if (game.phase === "round") game = continueRound(game);
    else game = applyMove(game, chooseStrategicMove(game, game.current), game.current);
    assertGameInvariant(game);
    actions += 1;
    assert.ok(actions < 60);
  }
  assert.equal(actions, 50); // 48 coups + deux transitions de manche.
  assert.equal(game.captured[0].length + game.captured[1].length, 52);
});

test("l’invariant rejette une carte dupliquée", () => {
  const game = createInitialGame("Ada", seededRandom(4));
  game.deck[0] = game.deck[1];
  assert.throws(() => assertGameInvariant(game), /52 cartes uniques/);
});
