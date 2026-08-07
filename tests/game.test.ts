import assert from "node:assert/strict";
import test from "node:test";

import {
  applyMove,
  cardTotals,
  chooseStrategicMove,
  continueRound,
  createDeck,
  createInitialGame,
  gameCardCount,
  type Card,
  type Game,
  type TableGroup,
} from "../lib/game.ts";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function card(rank: string, value: number, id = rank): Card {
  return { id, rank, value, suit: "♠" };
}

function group(item: Card, id = `g-${item.id}`): TableGroup {
  return { id, cards: [item], declaredTotal: null, builtBy: null };
}

test("le paquet contient 52 cartes uniques et l’As vaut 1 ou 14", () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((item) => item.id)).size, 52);
  assert.deepEqual(cardTotals(deck.find((item) => item.rank === "A")!), [1, 14]);
});

test("une partie distribue 8 cartes par joueur et 4 sur la table", () => {
  const game = createInitialGame("Ada", seededRandom(12));
  assert.equal(game.names[0], "Ada");
  assert.deepEqual(game.hands.map((hand) => hand.length), [8, 8]);
  assert.equal(game.table.length, 4);
  assert.equal(game.deck.length, 32);
  assert.equal(gameCardCount(game), 52);
});

test("une capture additionne les groupes et refuse une somme incorrecte", () => {
  const played = card("V", 11, "jack");
  const nine = group(card("9", 9));
  const two = group(card("2", 2));
  const base: Game = {
    ...createInitialGame("Test", seededRandom(2)),
    phase: "playing",
    current: 0,
    hands: [[played], [card("3", 3, "other")]],
    table: [nine, two],
    deck: [],
    captured: [[], []],
    round: 3,
  };
  const result = applyMove(base, {
    kind: "capture",
    cardId: played.id,
    groupIds: [nine.id, two.id],
  });
  assert.equal(result.captured[0].length, 3);
  assert.equal(result.table.length, 0);
  assert.throws(
    () => applyMove(base, { kind: "capture", cardId: played.id, groupIds: [nine.id] }),
    /somme sélectionnée/,
  );
});

test("une préparation exige une carte gardée qui atteint le nouveau total", () => {
  const three = card("3", 3, "three");
  const six = card("6", 6, "six");
  const tableThree = group(card("3", 3, "table-three"));
  const base: Game = {
    ...createInitialGame("Test", seededRandom(4)),
    phase: "playing",
    current: 0,
    hands: [[three, six], [card("4", 4, "other")]],
    table: [tableThree],
    deck: [],
    captured: [[], []],
    round: 3,
  };
  const result = applyMove(base, {
    kind: "build",
    cardId: three.id,
    groupIds: [tableThree.id],
    total: 6,
  });
  assert.equal(result.table[0].declaredTotal, 6);
  assert.equal(result.table[0].cards.length, 2);
  assert.equal(gameCardCount(result), 4);
});

test("la manche suivante alterne le joueur qui commence", () => {
  const first = card("2", 2, "first");
  const second = card("4", 4, "second");
  const base: Game = {
    ...createInitialGame("Test", seededRandom(7)),
    phase: "playing",
    current: 0,
    starter: 0,
    hands: [[first], []],
    deck: createDeck().slice(0, 16),
    table: [],
    captured: [[], []],
    round: 1,
  };
  const result = applyMove(base, { kind: "discard", cardId: first.id });
  assert.equal(result.phase, "round");
  assert.equal(result.round, 2);
  assert.equal(result.starter, 1);
  assert.equal(continueRound(result).phase, "ai");
  assert.equal(second.value, 4);
});

test("200 parties stratégiques terminent sans blocage ni mouvement illégal", () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    let game = createInitialGame("Robot test", seededRandom(seed));
    let turns = 0;
    while (game.phase !== "finished" && turns < 100) {
      if (game.phase === "round") {
        game = continueRound(game);
        continue;
      }
      const move = chooseStrategicMove(game, game.current);
      game = applyMove(game, move, game.current);
      assert.equal(gameCardCount(game), 52, `conservation des cartes, graine ${seed}`);
      turns += 1;
    }
    assert.equal(game.phase, "finished", `partie bloquée, graine ${seed}`);
    assert.equal(turns, 48, `nombre de tours inattendu, graine ${seed}`);
    assert.equal(game.deck.length, 0);
    assert.deepEqual(game.hands.map((hand) => hand.length), [0, 0]);
  }
});
