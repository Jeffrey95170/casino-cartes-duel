import assert from "node:assert/strict";
import test from "node:test";
import { careerGoals, playerTitle } from "../lib/player-journey.ts";
import { DEFAULT_AUDIO, parseAudioPreferences } from "../lib/game-audio.ts";

test("un premier visiteur reste silencieux et les préférences corrompues sont ignorées", () => {
  assert.deepEqual(parseAudioPreferences(null), DEFAULT_AUDIO);
  assert.deepEqual(parseAudioPreferences("{broken"), DEFAULT_AUDIO);
  assert.equal(parseAudioPreferences('{"music":"false","effects":1}').music, false);
  assert.equal(parseAudioPreferences('{"music":"false","effects":1}').effects, false);
});

test("les volumes mémorisés sont bornés et les canaux restent indépendants", () => {
  assert.deepEqual(parseAudioPreferences('{"music":true,"effects":false,"musicVolume":150,"effectsVolume":-10}'), {
    music: true, effects: false, musicVolume: 100, effectsVolume: 0,
  });
  assert.equal(parseAudioPreferences('{"musicVolume":"fort"}').musicVolume, 30);
});

test("un palier atteint propose le suivant sans perdre les compteurs cumulés", () => {
  const goals = careerGoals({ games_completed: 3, wins: 1, total_cards_captured: 52 });
  assert.deepEqual(goals.map(({ value, target }) => [value, target]), [[3, 10], [1, 5], [52, 130]]);
  assert.ok(goals.every((goal) => !goal.complete && goal.percent > 0 && goal.percent < 100));
});

test("les derniers objectifs sont terminés et ne dépassent jamais 100 %", () => {
  const goals = careerGoals({ games_completed: 1000, wins: 500, total_cards_captured: 50000 });
  assert.ok(goals.every((goal) => goal.complete && goal.percent === 100));
  assert.deepEqual(careerGoals({ games_completed: 0, wins: 0, total_cards_captured: 0 }).map((goal) => goal.percent), [0, 0, 0]);
});

test("les titres évoluent aux niveaux attendus", () => {
  assert.deepEqual([1, 2, 4, 7, 10, 20].map(playerTitle), ["Recrue", "Tacticien", "Stratège", "Expert", "Maître des cartes", "Maître des cartes"]);
});
