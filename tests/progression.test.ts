import assert from "node:assert/strict";
import test from "node:test";

import {
  appendUniqueAchievement,
  isLeaderboardEligible,
  isValidUsername,
  levelForXp,
  nextWinStreak,
  normalizeUsername,
  sortProgressLeaderboard,
  winRate,
  xpForResult,
  xpProgress,
} from "../lib/progression.ts";

test("le serveur attribue 50 XP pour une victoire, 35 pour une égalité et 20 pour une défaite", () => {
  assert.equal(xpForResult("win"), 50);
  assert.equal(xpForResult("draw"), 35);
  assert.equal(xpForResult("loss"), 20);
});

test("le niveau suit la formule floor(sqrt(xp / 100)) + 1", () => {
  assert.deepEqual([0, 100, 400, 900].map(levelForXp), [1, 2, 3, 4]);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(899), 3);
});

test("la progression XP utilise les seuils de la même formule", () => {
  assert.deepEqual(xpProgress(450), {
    level: 3,
    currentThreshold: 400,
    nextThreshold: 900,
    earnedThisLevel: 50,
    neededThisLevel: 500,
    percent: 10,
  });
});

test("le win rate et les séries gèrent les valeurs limites", () => {
  assert.equal(winRate(0, 0), 0);
  assert.equal(winRate(2, 3), 66.7);
  assert.equal(nextWinStreak(4, "win"), 5);
  assert.equal(nextWinStreak(5, "draw"), 0);
  assert.equal(nextWinStreak(5, "loss"), 0);
});

test("l’éligibilité exige un compte permanent, un pseudo valide et 3 parties vérifiées", () => {
  assert.equal(isLeaderboardEligible({ isAnonymous: false, username: "Ada-42", soloVerifiedGames: 3 }), true);
  assert.equal(isLeaderboardEligible({ isAnonymous: true, username: "Ada-42", soloVerifiedGames: 10 }), false);
  assert.equal(isLeaderboardEligible({ isAnonymous: false, username: "Ada 42", soloVerifiedGames: 3 }), false);
  assert.equal(isLeaderboardEligible({ isAnonymous: false, username: "Ada-42", soloVerifiedGames: 2 }), false);
});

test("les pseudonymes sont validés et normalisés sans ambiguïté", () => {
  assert.equal(isValidUsername("Joueur-A7F3K9"), true);
  assert.equal(isValidUsername("ab"), false);
  assert.equal(isValidUsername(" joueur"), false);
  assert.equal(isValidUsername("joueur.test"), false);
  assert.equal(normalizeUsername("  Ada_42  "), "ada_42");
});

test("le classement applique XP, victoires, record puis date comme tie-breaks", () => {
  const entries = [
    { username: "D", xp: 100, wins: 2, bestCardsCaptured: 30, createdAt: "2026-01-04" },
    { username: "A", xp: 200, wins: 1, bestCardsCaptured: 20, createdAt: "2026-01-01" },
    { username: "C", xp: 100, wins: 2, bestCardsCaptured: 30, createdAt: "2026-01-03" },
    { username: "B", xp: 100, wins: 3, bestCardsCaptured: 10, createdAt: "2026-01-02" },
  ];
  assert.deepEqual(sortProgressLeaderboard(entries).map((entry) => entry.username), ["A", "B", "C", "D"]);
});

test("un succès ne peut être ajouté qu’une fois", () => {
  assert.deepEqual(appendUniqueAchievement(["PREMIERE_PRISE"], "PREMIERE_PRISE"), ["PREMIERE_PRISE"]);
  assert.deepEqual(appendUniqueAchievement(["PREMIERE_PRISE"], "CALCULATEUR"), ["PREMIERE_PRISE", "CALCULATEUR"]);
});
