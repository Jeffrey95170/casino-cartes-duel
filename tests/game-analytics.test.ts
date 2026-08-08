import assert from "node:assert/strict";
import test from "node:test";

import type { AnalyticsEventMap } from "../lib/analytics/events.ts";
import { GameAnalyticsTracker } from "../lib/analytics/game.ts";

function createRecorder() {
  const started: AnalyticsEventMap["game_started"][] = [];
  const completed: AnalyticsEventMap["game_completed"][] = [];
  const abandoned: AnalyticsEventMap["game_abandoned"][] = [];
  const playAgain: AnalyticsEventMap["play_again_clicked"][] = [];
  return {
    recorder: {
      started: (properties: AnalyticsEventMap["game_started"]) => started.push(properties),
      completed: (properties: AnalyticsEventMap["game_completed"]) => completed.push(properties),
      abandoned: (properties: AnalyticsEventMap["game_abandoned"]) => abandoned.push(properties),
      playAgain: (properties: AnalyticsEventMap["play_again_clicked"]) => playAgain.push(properties),
    },
    started,
    completed,
    abandoned,
    playAgain,
  };
}

test("game_started et game_completed ne sont envoyés qu’une fois avec les propriétés essentielles", () => {
  const output = createRecorder();
  let now = 1_000;
  const tracker = new GameAnalyticsTracker(output.recorder, () => now, () => 1);

  assert.equal(tracker.start({ gameId: "game-1", playerGamesBefore: 0 }), true);
  assert.equal(tracker.start({ gameId: "game-1", playerGamesBefore: 0 }), false);
  tracker.noteAction("capture");
  tracker.noteAction("build");
  now = 61_000;
  assert.equal(tracker.complete({
    gameId: "game-1",
    result: "win",
    playerScore: 30,
    opponentScore: 22,
    roundsPlayed: 3,
  }), true);
  assert.equal(tracker.complete({
    gameId: "game-1",
    result: "win",
    playerScore: 30,
    opponentScore: 22,
    roundsPlayed: 3,
  }), false);

  assert.equal(output.started.length, 1);
  assert.equal(output.completed.length, 1);
  assert.equal(output.completed[0].game_id, "game-1");
  assert.equal(output.completed[0].duration_seconds, 60);
  assert.equal(output.completed[0].result, "win");
  assert.equal(output.completed[0].actions_count, 2);
  assert.equal(output.completed[0].captures_count, 1);
  assert.equal(output.completed[0].constructions_count, 1);
  assert.equal(output.abandoned.length, 0);
});

test("une partie abandonnée n’est jamais enregistrée comme terminée", () => {
  const output = createRecorder();
  let now = 0;
  const tracker = new GameAnalyticsTracker(output.recorder, () => now, () => 2);
  tracker.start({ gameId: "game-abandoned", playerGamesBefore: 4 });
  tracker.noteAction("discard");
  now = 12_000;
  assert.equal(tracker.abandon({ gameId: "game-abandoned", currentRound: 2 }), true);
  assert.equal(tracker.complete({
    gameId: "game-abandoned",
    result: "loss",
    playerScore: 8,
    opponentScore: 12,
    roundsPlayed: 2,
  }), false);

  assert.equal(output.abandoned.length, 1);
  assert.equal(output.abandoned[0].elapsed_seconds, 12);
  assert.equal(output.abandoned[0].actions_count, 1);
  assert.equal(output.completed.length, 0);
});

test("play_again_clicked correspond au clic suivant une partie terminée", () => {
  const output = createRecorder();
  let now = 5_000;
  const tracker = new GameAnalyticsTracker(output.recorder, () => now, () => 1);
  assert.equal(tracker.playAgainClicked(), false);
  tracker.start({ gameId: "game-finished", playerGamesBefore: 1 });
  tracker.complete({
    gameId: "game-finished",
    result: "draw",
    playerScore: 26,
    opponentScore: 26,
    roundsPlayed: 3,
  });
  now = 9_000;
  assert.equal(tracker.playAgainClicked(), true);

  assert.deepEqual(output.playAgain, [{
    previous_game_id: "game-finished",
    previous_result: "draw",
    seconds_since_game_end: 4,
  }]);
  assert.equal(output.completed[0].is_second_game, true);
});

test("un rejeu immédiat reste identifié comme deuxième partie même avant le rafraîchissement du profil", () => {
  const output = createRecorder();
  const tracker = new GameAnalyticsTracker(output.recorder, () => 0, () => output.started.length + 1);
  tracker.start({ gameId: "first-game", playerGamesBefore: 0 });
  tracker.complete({
    gameId: "first-game",
    result: "win",
    playerScore: 28,
    opponentScore: 24,
    roundsPlayed: 3,
  });
  tracker.start({ gameId: "second-game", playerGamesBefore: 0 });

  assert.equal(output.started[1].player_games_before, 1);
  assert.equal(output.started[1].is_first_game, false);
});
