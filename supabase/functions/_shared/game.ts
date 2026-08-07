export type Player = 0 | 1;
export type Phase = "setup" | "playing" | "ai" | "round" | "finished";
export type Suit = "♠" | "♥" | "♦" | "♣";

export type Card = {
  id: string;
  suit: Suit;
  rank: string;
  value: number;
};

export type TableGroup = {
  id: string;
  cards: Card[];
  declaredTotal: number | null;
  builtBy: Player | null;
};

export type Game = {
  phase: Phase;
  names: [string, string];
  deck: Card[];
  hands: [Card[], Card[]];
  table: TableGroup[];
  captured: [Card[], Card[]];
  current: Player;
  starter: Player;
  round: number;
  lastCapturer: Player | null;
  message: string;
};

export type GameMove =
  | { kind: "capture"; cardId: string; groupIds: string[] }
  | { kind: "build"; cardId: string; groupIds: string[]; total: number }
  | { kind: "discard"; cardId: string };

export type BuildChoice = { total: number; disrupt: boolean };

export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const RANKS = [
  { rank: "A", value: 1 },
  { rank: "2", value: 2 },
  { rank: "3", value: 3 },
  { rank: "4", value: 4 },
  { rank: "5", value: 5 },
  { rank: "6", value: 6 },
  { rank: "7", value: 7 },
  { rank: "8", value: 8 },
  { rank: "9", value: 9 },
  { rank: "10", value: 10 },
  { rank: "V", value: 11 },
  { rank: "D", value: 12 },
  { rank: "R", value: 13 },
] as const;

export const EMPTY_GAME: Game = {
  phase: "setup",
  names: ["Joueur", "Croupier IA"],
  deck: [],
  hands: [[], []],
  table: [],
  captured: [[], []],
  current: 0,
  starter: 0,
  round: 1,
  lastCapturer: null,
  message: "",
};

export function secureRandom(): number {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] / 4294967296;
}

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    RANKS.map(({ rank, value }) => ({
      id: `${suit}-${rank}`,
      suit,
      rank,
      value,
    })),
  );
}

export function shuffledDeck(random: () => number = secureRandom): Card[] {
  const deck = createDeck();
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [deck[index], deck[swapWith]] = [deck[swapWith], deck[index]];
  }
  return deck;
}

export function cardTotals(card: Card): number[] {
  return card.rank === "A" ? [1, 14] : [card.value];
}

export function groupTotals(group: TableGroup): number[] {
  if (group.declaredTotal !== null) return [group.declaredTotal];
  return cardTotals(group.cards[0]);
}

export function combineTotals(groups: TableGroup[], playedCard?: Card): number[] {
  const optionSets = groups.map(groupTotals);
  if (playedCard) optionSets.push(cardTotals(playedCard));

  return optionSets.reduce<number[]>(
    (totals, options) =>
      Array.from(new Set(totals.flatMap((total) => options.map((value) => total + value)))),
    [0],
  );
}

export function tableCardCount(table: TableGroup[]): number {
  return table.reduce((total, group) => total + group.cards.length, 0);
}

export function gameCardCount(game: Game): number {
  return (
    game.deck.length +
    game.hands[0].length +
    game.hands[1].length +
    game.captured[0].length +
    game.captured[1].length +
    tableCardCount(game.table)
  );
}

export function assertGameInvariant(game: Game): void {
  const cards = [
    ...game.deck,
    ...game.hands[0],
    ...game.hands[1],
    ...game.captured[0],
    ...game.captured[1],
    ...game.table.flatMap((group) => group.cards),
  ];
  if (cards.length !== 52 || new Set(cards.map((card) => card.id)).size !== 52) {
    throw new Error("Invariant violé : la partie doit contenir 52 cartes uniques.");
  }
}

export function findGroupSubsets(table: TableGroup[], target: number, limit = 80): TableGroup[][] {
  const results: TableGroup[][] = [];

  function search(index: number, total: number, chosen: TableGroup[]) {
    if (results.length >= limit) return;
    if (total === target && chosen.length) {
      results.push([...chosen]);
      return;
    }
    if (index >= table.length || total >= target) return;

    search(index + 1, total, chosen);
    for (const value of groupTotals(table[index])) {
      if (total + value > target) continue;
      chosen.push(table[index]);
      search(index + 1, total + value, chosen);
      chosen.pop();
    }
  }

  search(0, 0, []);
  return results;
}

export function findBuildChoice(
  game: Game,
  card: Card | null,
  groups: TableGroup[],
  player: Player = game.current,
): BuildChoice | null {
  if (!card || !groups.length) return null;

  const totals = combineTotals(groups, card)
    .filter((total) => total >= 2 && total <= 14)
    .sort((a, b) => a - b);
  const remainingHand = game.hands[player].filter((candidate) => candidate.id !== card.id);
  const plannedTotal = totals.find((total) =>
    remainingHand.some((candidate) => cardTotals(candidate).includes(total)),
  );
  const canDisrupt = groups.some(
    (group) => group.declaredTotal !== null && group.builtBy !== player,
  );

  if (plannedTotal !== undefined) return { total: plannedTotal, disrupt: false };
  if (canDisrupt && totals.length) return { total: totals[0], disrupt: true };
  return null;
}

function requireCard(game: Game, player: Player, cardId: string): Card {
  const card = game.hands[player].find((candidate) => candidate.id === cardId);
  if (!card) throw new Error("Cette carte n’est pas dans la main du joueur.");
  return card;
}

function requireGroups(game: Game, groupIds: string[]): TableGroup[] {
  const uniqueIds = new Set(groupIds);
  if (!uniqueIds.size || uniqueIds.size !== groupIds.length) {
    throw new Error("La sélection de la table est invalide.");
  }
  const groups = game.table.filter((group) => uniqueIds.has(group.id));
  if (groups.length !== uniqueIds.size) throw new Error("Une carte de la table n’est plus disponible.");
  return groups;
}

function removeCard(hands: [Card[], Card[]], player: Player, cardId: string): [Card[], Card[]] {
  const nextHands: [Card[], Card[]] = [[...hands[0]], [...hands[1]]];
  nextHands[player] = nextHands[player].filter((card) => card.id !== cardId);
  return nextHands;
}

function finishTurn(state: Game): Game {
  const handsEmpty = state.hands[0].length === 0 && state.hands[1].length === 0;

  if (!handsEmpty) {
    const nextPlayer = (state.current === 0 ? 1 : 0) as Player;
    return {
      ...state,
      current: nextPlayer,
      phase: nextPlayer === 0 ? "playing" : "ai",
    };
  }

  if (state.round < 3) {
    const nextStarter = (state.starter === 0 ? 1 : 0) as Player;
    return {
      ...state,
      round: state.round + 1,
      starter: nextStarter,
      current: nextStarter,
      hands: [state.deck.slice(0, 8), state.deck.slice(8, 16)],
      deck: state.deck.slice(16),
      phase: "round",
      message: `La manche ${state.round} est terminée. ${state.names[nextStarter]} ouvrira la suivante.`,
    };
  }

  const captured: [Card[], Card[]] = [[...state.captured[0]], [...state.captured[1]]];
  let table = state.table;
  let message = "Les trois manches sont terminées.";

  if (state.table.length && state.lastCapturer !== null) {
    const leftovers = state.table.flatMap((group) => group.cards);
    captured[state.lastCapturer].push(...leftovers);
    table = [];
    message = `${state.names[state.lastCapturer]} récupère les ${leftovers.length} dernières cartes de la table.`;
  } else if (state.table.length) {
    message = "Les trois manches sont terminées. Personne n’ayant capturé, la table reste neutre.";
  }

  return { ...state, table, captured, phase: "finished", message };
}

export function applyMove(game: Game, move: GameMove, player: Player = game.current): Game {
  const expectedPhase = player === 0 ? "playing" : "ai";
  if (game.phase !== expectedPhase || game.current !== player) {
    throw new Error("Ce n’est pas le tour de ce joueur.");
  }

  const card = requireCard(game, player, move.cardId);
  const playerName = game.names[player];

  if (move.kind === "capture") {
    const groups = requireGroups(game, move.groupIds);
    const valid = combineTotals(groups).some((total) => cardTotals(card).includes(total));
    if (!valid) throw new Error("La somme sélectionnée ne correspond pas à la carte jouée.");
    const groupIds = new Set(move.groupIds);
    const takenCards = groups.flatMap((group) => group.cards);
    const captured: [Card[], Card[]] = [[...game.captured[0]], [...game.captured[1]]];
    captured[player].push(card, ...takenCards);
    return finishTurn({
      ...game,
      hands: removeCard(game.hands, player, card.id),
      table: game.table.filter((group) => !groupIds.has(group.id)),
      captured,
      lastCapturer: player,
      message: `${playerName} capture ${takenCards.length} carte${takenCards.length > 1 ? "s" : ""} avec le ${card.rank}.`,
    });
  }

  if (move.kind === "build") {
    const groups = requireGroups(game, move.groupIds);
    const choice = findBuildChoice(game, card, groups, player);
    if (!choice || choice.total !== move.total) {
      throw new Error("Cette combinaison ne peut pas être préparée.");
    }
    const groupIds = new Set(move.groupIds);
    const table = game.table.filter((group) => !groupIds.has(group.id));
    table.push({
      id: `build-${game.round}-${game.hands[0].length}-${game.hands[1].length}-${card.id}`,
      cards: [...groups.flatMap((group) => group.cards), card],
      declaredTotal: move.total,
      builtBy: player,
    });
    return finishTurn({
      ...game,
      hands: removeCard(game.hands, player, card.id),
      table,
      message: choice.disrupt
        ? `${playerName} perturbe la combinaison : elle vaut maintenant ${move.total}.`
        : `${playerName} prépare une combinaison de ${move.total}.`,
    });
  }

  const table: TableGroup[] = [
    ...game.table,
    {
      id: `loose-${game.round}-${game.hands[0].length}-${game.hands[1].length}-${card.id}`,
      cards: [card],
      declaredTotal: null,
      builtBy: null,
    },
  ];
  return finishTurn({
    ...game,
    hands: removeCard(game.hands, player, card.id),
    table,
    message: `${playerName} pose le ${card.rank} sur la table.`,
  });
}

export function continueRound(game: Game): Game {
  if (game.phase !== "round") throw new Error("Aucune nouvelle manche n’est prête.");
  return { ...game, phase: game.starter === 0 ? "playing" : "ai" };
}

export function createInitialGame(playerName: string, random: () => number = secureRandom): Game {
  const safeName = playerName.trim() || "Joueur";
  const names: [string, string] = [safeName, "Croupier IA"];
  const deck = shuffledDeck(random);
  const starter = (deck[0].value % 2) as Player;
  const table = deck.slice(0, 4).map((card, index) => ({
    id: `table-${index}-${card.id}`,
    cards: [card],
    declaredTotal: null,
    builtBy: null,
  }));

  return {
    phase: starter === 0 ? "playing" : "ai",
    names,
    deck: deck.slice(20),
    hands: [deck.slice(4, 12), deck.slice(12, 20)],
    table,
    captured: [[], []],
    current: starter,
    starter,
    round: 1,
    lastCapturer: null,
    message: `${names[starter]} a été tiré au sort pour commencer.`,
  };
}

export function chooseStrategicMove(game: Game, player: Player = game.current): GameMove {
  const hand = game.hands[player];
  if (!hand.length) throw new Error("Le joueur n’a plus de cartes.");
  let bestCapture: { move: GameMove; score: number } | null = null;

  for (const card of hand) {
    for (const target of cardTotals(card)) {
      for (const groups of findGroupSubsets(game.table, target)) {
        const capturedCards = groups.reduce((total, group) => total + group.cards.length, 0);
        const buildBonus = groups.filter((group) => group.declaredTotal !== null).length * 9;
        const clearBonus = groups.length === game.table.length ? 42 : 0;
        const flexibilityCost = card.rank === "A" ? 5 : 0;
        const score = capturedCards * 100 + buildBonus + clearBonus - flexibilityCost;
        if (!bestCapture || score > bestCapture.score) {
          bestCapture = {
            move: { kind: "capture", cardId: card.id, groupIds: groups.map((group) => group.id) },
            score,
          };
        }
      }
    }
  }
  if (bestCapture) return bestCapture.move;

  let bestBuild: { move: GameMove; score: number } | null = null;
  for (const card of hand) {
    const remainingHand = hand.filter((candidate) => candidate.id !== card.id);
    for (const targetCard of remainingHand) {
      for (const target of cardTotals(targetCard)) {
        for (const playedValue of cardTotals(card)) {
          const needed = target - playedValue;
          if (needed <= 0) continue;
          for (const groups of findGroupSubsets(game.table, needed, 30)) {
            const choice = findBuildChoice(game, card, groups, player);
            if (!choice || choice.total !== target) continue;
            const gatheredCards = groups.reduce((total, group) => total + group.cards.length, 0);
            const pressureBonus = groups.some((group) => group.builtBy !== null && group.builtBy !== player)
              ? 12
              : 0;
            const flexibilityCost = card.rank === "A" ? 5 : 0;
            const score = gatheredCards * 14 + target + pressureBonus - flexibilityCost;
            if (!bestBuild || score > bestBuild.score) {
              bestBuild = {
                move: {
                  kind: "build",
                  cardId: card.id,
                  groupIds: groups.map((group) => group.id),
                  total: target,
                },
                score,
              };
            }
          }
        }
      }
    }
  }
  if (bestBuild) return bestBuild.move;

  const discard = [...hand].sort((first, second) => {
    if (first.rank === "A") return 1;
    if (second.rank === "A") return -1;
    return second.value - first.value;
  })[0];
  return { kind: "discard", cardId: discard.id };
}
