"use client";

import { useRef, useState } from "react";

type Player = 0 | 1;
type Phase = "setup" | "playing" | "ai" | "round" | "finished";
type Suit = "♠" | "♥" | "♦" | "♣";

type Card = {
  id: string;
  suit: Suit;
  rank: string;
  value: number;
};

type TableGroup = {
  id: string;
  cards: Card[];
  declaredTotal: number | null;
  builtBy: Player | null;
};

type Game = {
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

type AiMove =
  | { kind: "capture"; card: Card; groups: TableGroup[] }
  | { kind: "build"; card: Card; groups: TableGroup[]; total: number }
  | { kind: "discard"; card: Card };

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS = [
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
];

const EMPTY_GAME: Game = {
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

function shuffledDeck() {
  const deck = SUITS.flatMap((suit) =>
    RANKS.map(({ rank, value }) => ({
      id: `${suit}-${rank}`,
      suit,
      rank,
      value,
    })),
  );

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapWith]] = [deck[swapWith], deck[index]];
  }

  return deck;
}

function cardTotals(card: Card) {
  return card.rank === "A" ? [1, 14] : [card.value];
}

function groupTotals(group: TableGroup) {
  if (group.declaredTotal !== null) return [group.declaredTotal];
  return cardTotals(group.cards[0]);
}

function combineTotals(groups: TableGroup[], playedCard?: Card) {
  const optionSets = groups.map(groupTotals);
  if (playedCard) optionSets.push(cardTotals(playedCard));

  return optionSets.reduce<number[]>(
    (totals, options) =>
      Array.from(new Set(totals.flatMap((total) => options.map((value) => total + value)))),
    [0],
  );
}

function tableCardCount(table: TableGroup[]) {
  return table.reduce((total, group) => total + group.cards.length, 0);
}

function findGroupSubsets(table: TableGroup[], target: number, limit = 80) {
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

function chooseAiMove(game: Game): AiMove {
  const hand = game.hands[1];
  let bestCapture: { move: AiMove; score: number } | null = null;

  for (const card of hand) {
    for (const target of cardTotals(card)) {
      for (const groups of findGroupSubsets(game.table, target)) {
        const capturedCards = groups.reduce((total, group) => total + group.cards.length, 0);
        const buildBonus = groups.filter((group) => group.declaredTotal !== null).length * 9;
        const clearBonus = groups.length === game.table.length ? 42 : 0;
        const flexibilityCost = card.rank === "A" ? 5 : 0;
        const score = capturedCards * 100 + buildBonus + clearBonus - flexibilityCost;
        if (!bestCapture || score > bestCapture.score) {
          bestCapture = { move: { kind: "capture", card, groups }, score };
        }
      }
    }
  }

  if (bestCapture) return bestCapture.move;

  let bestBuild: { move: AiMove; score: number } | null = null;
  for (const card of hand) {
    const remainingHand = hand.filter((candidate) => candidate.id !== card.id);
    for (const targetCard of remainingHand) {
      for (const target of cardTotals(targetCard)) {
        for (const playedValue of cardTotals(card)) {
          const needed = target - playedValue;
          if (needed <= 0) continue;
          for (const groups of findGroupSubsets(game.table, needed, 30)) {
            const gatheredCards = groups.reduce((total, group) => total + group.cards.length, 0);
            const pressureBonus = groups.some((group) => group.builtBy === 0) ? 12 : 0;
            const flexibilityCost = card.rank === "A" ? 5 : 0;
            const score = gatheredCards * 14 + target + pressureBonus - flexibilityCost;
            if (!bestBuild || score > bestBuild.score) {
              bestBuild = { move: { kind: "build", card, groups, total: target }, score };
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

  return { kind: "discard", card: discard };
}

function CardFace({
  card,
  selected = false,
  small = false,
}: {
  card: Card;
  selected?: boolean;
  small?: boolean;
}) {
  const isRed = card.suit === "♥" || card.suit === "♦";

  return (
    <span
      className={`playing-card${isRed ? " red" : " black"}${selected ? " selected" : ""}${small ? " small" : ""}`}
      aria-label={`${card.rank} de ${card.suit}`}
    >
      <span className="card-corner">
        <b>{card.rank}</b>
        <i>{card.suit}</i>
      </span>
      <span className="card-suit">{card.suit}</span>
      <span className="card-corner card-corner-bottom">
        <b>{card.rank}</b>
        <i>{card.suit}</i>
      </span>
    </span>
  );
}

function CardBack({ small = false }: { small?: boolean }) {
  return (
    <span className={`card-back${small ? " small" : ""}`} aria-hidden="true">
      <span>✦</span>
    </span>
  );
}

export default function Home() {
  const [game, setGame] = useState<Game>(EMPTY_GAME);
  const [draftName, setDraftName] = useState("Joueur");
  const [selectedHand, setSelectedHand] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [showRules, setShowRules] = useState(false);
  const aiTimer = useRef<number | null>(null);

  const selectedCard = game.hands[game.current].find((card) => card.id === selectedHand) ?? null;
  const selectedTable = game.table.filter((group) => selectedGroups.includes(group.id));
  const selectedTableTotalOptions = selectedTable.length ? combineTotals(selectedTable) : [];

  const canCapture = Boolean(
    selectedCard &&
      selectedTable.length &&
      selectedTableTotalOptions.some((total) => cardTotals(selectedCard).includes(total)),
  );

  const buildChoice = (() => {
    if (!selectedCard || !selectedTable.length) return null;

    const totals = combineTotals(selectedTable, selectedCard)
      .filter((total) => total >= 2 && total <= 14)
      .sort((a, b) => a - b);
    const remainingHand = game.hands[game.current].filter((card) => card.id !== selectedCard.id);
    const plannedTotal = totals.find((total) =>
      remainingHand.some((card) => cardTotals(card).includes(total)),
    );
    const canDisrupt = selectedTable.some(
      (group) => group.declaredTotal !== null && group.builtBy !== game.current,
    );

    if (plannedTotal !== undefined) return { total: plannedTotal, disrupt: false };
    if (canDisrupt && totals.length) return { total: totals[0], disrupt: true };
    return null;
  })();

  function clearSelection() {
    setSelectedHand(null);
    setSelectedGroups([]);
  }

  function scheduleAiTurn(aiState: Game) {
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    aiTimer.current = window.setTimeout(() => executeAiTurn(aiState), 1150);
  }

  function startGame(playerName = draftName) {
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    const safeNames: [string, string] = [playerName.trim() || "Joueur", "Croupier IA"];
    const deck = shuffledDeck();
    const starter = (deck[0].value % 2) as Player;
    const table = deck.slice(0, 4).map((card, index) => ({
      id: `table-${index}-${card.id}`,
      cards: [card],
      declaredTotal: null,
      builtBy: null,
    }));

    const initialGame: Game = {
      phase: starter === 0 ? "playing" : "ai",
      names: safeNames,
      deck: deck.slice(20),
      hands: [deck.slice(4, 12), deck.slice(12, 20)],
      table,
      captured: [[], []],
      current: starter,
      starter,
      round: 1,
      lastCapturer: null,
      message: `${safeNames[starter]} a été tiré au sort pour commencer.`,
    };
    setGame(initialGame);
    setDraftName(safeNames[0]);
    clearSelection();
    if (starter === 1) scheduleAiTurn(initialGame);
  }

  function finishTurn(nextState: Game) {
    const handsEmpty = nextState.hands[0].length === 0 && nextState.hands[1].length === 0;

    if (!handsEmpty) {
      const nextPlayer = (nextState.current === 0 ? 1 : 0) as Player;
      const updatedState: Game = {
        ...nextState,
        current: nextPlayer,
        phase: nextPlayer === 0 ? "playing" : "ai",
      };
      setGame(updatedState);
      clearSelection();
      if (nextPlayer === 1) scheduleAiTurn(updatedState);
      return;
    }

    if (nextState.round < 3) {
      const nextStarter = (nextState.starter === 0 ? 1 : 0) as Player;
      setGame({
        ...nextState,
        round: nextState.round + 1,
        starter: nextStarter,
        current: nextStarter,
        hands: [nextState.deck.slice(0, 8), nextState.deck.slice(8, 16)],
        deck: nextState.deck.slice(16),
        phase: "round",
        message: `La manche ${nextState.round} est terminée. ${nextState.names[nextStarter]} ouvrira la suivante.`,
      });
      clearSelection();
      return;
    }

    const captured: [Card[], Card[]] = [
      [...nextState.captured[0]],
      [...nextState.captured[1]],
    ];
    let message = "Les trois manches sont terminées.";

    if (nextState.table.length && nextState.lastCapturer !== null) {
      const leftovers = nextState.table.flatMap((group) => group.cards);
      captured[nextState.lastCapturer].push(...leftovers);
      message = `${nextState.names[nextState.lastCapturer]} récupère les ${leftovers.length} dernières cartes de la table.`;
    }

    setGame({
      ...nextState,
      table: [],
      captured,
      phase: "finished",
      message,
    });
    clearSelection();
  }

  function removePlayedCard(hands: [Card[], Card[]], player: Player, card: Card) {
    const nextHands: [Card[], Card[]] = [[...hands[0]], [...hands[1]]];
    nextHands[player] = nextHands[player].filter((item) => item.id !== card.id);
    return nextHands;
  }

  function executeAiTurn(aiState: Game) {
    if (aiState.phase !== "ai" || aiState.current !== 1 || !aiState.hands[1].length) return;
    const move = chooseAiMove(aiState);

    if (move.kind === "capture") {
      const groupIds = move.groups.map((group) => group.id);
      const takenCards = move.groups.flatMap((group) => group.cards);
      const captured: [Card[], Card[]] = [
        [...aiState.captured[0]],
        [...aiState.captured[1], move.card, ...takenCards],
      ];
      finishTurn({
        ...aiState,
        hands: removePlayedCard(aiState.hands, 1, move.card),
        table: aiState.table.filter((group) => !groupIds.includes(group.id)),
        captured,
        lastCapturer: 1,
        message: `Le Croupier IA capture ${takenCards.length} carte${takenCards.length > 1 ? "s" : ""} avec le ${move.card.rank}.`,
      });
      return;
    }

    if (move.kind === "build") {
      const groupIds = move.groups.map((group) => group.id);
      const table = aiState.table.filter((group) => !groupIds.includes(group.id));
      table.push({
        id: `ai-build-${aiState.round}-${aiState.hands[1].length}-${move.card.id}`,
        cards: [...move.groups.flatMap((group) => group.cards), move.card],
        declaredTotal: move.total,
        builtBy: 1,
      });
      finishTurn({
        ...aiState,
        hands: removePlayedCard(aiState.hands, 1, move.card),
        table,
        message: `Le Croupier IA prépare une combinaison de ${move.total}.`,
      });
      return;
    }

    finishTurn({
      ...aiState,
      hands: removePlayedCard(aiState.hands, 1, move.card),
      table: [
        ...aiState.table,
        {
          id: `ai-loose-${aiState.round}-${aiState.hands[1].length}-${move.card.id}`,
          cards: [move.card],
          declaredTotal: null,
          builtBy: null,
        },
      ],
      message: `Le Croupier IA pose le ${move.card.rank} sur la table.`,
    });
  }

  function continueRound() {
    const updatedState: Game = {
      ...game,
      phase: game.starter === 0 ? "playing" : "ai",
    };
    setGame(updatedState);
    if (game.starter === 1) scheduleAiTurn(updatedState);
  }

  function returnToSetup() {
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    clearSelection();
    setGame({ ...EMPTY_GAME, names: [draftName, "Croupier IA"] });
  }

  function capture() {
    if (!selectedCard || !canCapture) return;
    const takenCards = selectedTable.flatMap((group) => group.cards);
    const captured: [Card[], Card[]] = [[...game.captured[0]], [...game.captured[1]]];
    captured[game.current].push(selectedCard, ...takenCards);

    finishTurn({
      ...game,
      hands: removePlayedCard(game.hands, game.current, selectedCard),
      table: game.table.filter((group) => !selectedGroups.includes(group.id)),
      captured,
      lastCapturer: game.current,
      message: `${game.names[game.current]} capture ${takenCards.length} carte${takenCards.length > 1 ? "s" : ""} avec le ${selectedCard.rank}.`,
    });
  }

  function build() {
    if (!selectedCard || !buildChoice) return;
    const combinedCards = [...selectedTable.flatMap((group) => group.cards), selectedCard];
    const table = game.table.filter((group) => !selectedGroups.includes(group.id));
    table.push({
      id: `build-${game.round}-${game.hands[0].length}-${game.hands[1].length}-${selectedCard.id}`,
      cards: combinedCards,
      declaredTotal: buildChoice.total,
      builtBy: game.current,
    });

    finishTurn({
      ...game,
      hands: removePlayedCard(game.hands, game.current, selectedCard),
      table,
      message: buildChoice.disrupt
        ? `${game.names[game.current]} perturbe la combinaison : elle vaut maintenant ${buildChoice.total}.`
        : `${game.names[game.current]} prépare une combinaison de ${buildChoice.total}.`,
    });
  }

  function discard() {
    if (!selectedCard) return;
    const table = [
      ...game.table,
      {
        id: `loose-${game.round}-${game.hands[0].length}-${game.hands[1].length}-${selectedCard.id}`,
        cards: [selectedCard],
        declaredTotal: null,
        builtBy: null,
      } satisfies TableGroup,
    ];

    finishTurn({
      ...game,
      hands: removePlayedCard(game.hands, game.current, selectedCard),
      table,
      message: `${game.names[game.current]} pose le ${selectedCard.rank} sur la table.`,
    });
  }

  function toggleGroup(groupId: string) {
    setSelectedGroups((groups) =>
      groups.includes(groupId) ? groups.filter((id) => id !== groupId) : [...groups, groupId],
    );
  }

  const scores = [game.captured[0].length, game.captured[1].length];
  const winner = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;

  if (game.phase === "setup") {
    return (
      <main className="setup-shell">
        <section className="setup-card">
          <div className="setup-copy">
            <div className="brand-mark"><span>♠</span> Maison Noire</div>
            <p className="eyebrow">Jeu de stratégie · Solo contre l’IA</p>
            <h1>Casino</h1>
            <p className="setup-lead">
              Calculez juste. Tendez vos pièges. Raflez la table.
            </p>
            <div className="quick-rules" aria-label="Résumé des règles">
              <div><strong>3</strong><span>manches</span></div>
              <div><strong>1</strong><span>adversaire IA</span></div>
              <div><strong>∞</strong><span>parties uniques</span></div>
            </div>
          </div>

          <div className="setup-form">
            <div className="deco-cards" aria-hidden="true">
              <span className="deco-card deco-one">A<span>♠</span></span>
              <span className="deco-card deco-two red">D<span>♥</span></span>
              <span className="deco-card deco-three">V<span>♣</span></span>
            </div>
            <h2>Affrontez la maison</h2>
            <p>Le Croupier IA étudie la table, cherche la meilleure capture et prépare ses prochains coups.</p>
            <div className="ai-opponent">
              <span className="ai-seal">IA</span>
              <span><b>Croupier IA</b><small>Adversaire stratégique</small></span>
              <i>En ligne</i>
            </div>
            <label>
              Votre nom
              <input
                value={draftName}
                maxLength={18}
                onChange={(event) => setDraftName(event.target.value)}
              />
            </label>
            <button className="primary-button start-button" onClick={() => startGame()}>
              Affronter le Croupier <span>→</span>
            </button>
            <button className="text-button" onClick={() => setShowRules(true)}>
              Comment jouer ?
            </button>
          </div>
        </section>
        <RulesModal open={showRules} onClose={() => setShowRules(false)} />
      </main>
    );
  }

  return (
    <main className="game-shell">
      <header className="game-header">
        <div className="brand-mark compact"><span>♠</span> Casino</div>
        <div className="round-track" aria-label={`Manche ${game.round} sur 3`}>
          {[1, 2, 3].map((round) => (
            <span key={round} className={round <= game.round ? "active" : ""}>
              {round}
            </span>
          ))}
          <small>Manche {game.round} / 3</small>
        </div>
        <div className="header-actions">
          <button className="icon-button" onClick={() => setShowRules(true)} aria-label="Voir les règles">?</button>
          <button className="quiet-button" onClick={returnToSetup}>
            Quitter
          </button>
        </div>
      </header>

      <section className="scoreboard" aria-label="Scores">
        {([0, 1] as Player[]).map((player) => (
          <div className={`player-score${game.current === player && (game.phase === "playing" || game.phase === "ai") ? " is-turn" : ""}`} key={player}>
            <span className={`avatar avatar-${player + 1}`}>{player === 1 ? "IA" : game.names[player].slice(0, 1).toUpperCase()}</span>
            <span className="player-data">
              <strong>{game.names[player]}</strong>
              <small>{game.hands[player].length} carte{game.hands[player].length !== 1 ? "s" : ""} en main</small>
            </span>
            <span className="score-number"><b>{scores[player]}</b><small>capturées</small></span>
          </div>
        ))}
      </section>

      <section className="felt-table">
        <div className="table-heading">
          <div>
            <p className="eyebrow">La table</p>
            <h2>{tableCardCount(game.table)} carte{tableCardCount(game.table) !== 1 ? "s" : ""} en jeu</h2>
          </div>
          <div className="deck-status" aria-label={`${game.deck.length} cartes dans la pioche`}>
            <div className="mini-deck"><CardBack small /></div>
            <span><b>{game.deck.length}</b> dans la pioche</span>
          </div>
        </div>

        <div className="table-groups">
          {game.table.length === 0 ? (
            <div className="empty-table"><span>✦</span><p>Table nette — belle rafle !</p></div>
          ) : (
            game.table.map((group) => {
              const isSelected = selectedGroups.includes(group.id);
              const label = group.declaredTotal !== null
                ? `Combinaison de ${group.declaredTotal}, ${group.cards.length} cartes`
                : `${group.cards[0].rank} de ${group.cards[0].suit}`;
              return (
                <button
                  key={group.id}
                  className={`table-group${isSelected ? " selected" : ""}${group.cards.length > 1 ? " build-group" : ""}`}
                  onClick={() => game.phase === "playing" && game.current === 0 && toggleGroup(group.id)}
                  disabled={game.phase !== "playing" || game.current !== 0}
                  aria-pressed={isSelected}
                  aria-label={label}
                >
                  {group.cards.length === 1 ? (
                    <CardFace card={group.cards[0]} selected={isSelected} />
                  ) : (
                    <>
                      <span className="pile-cards">
                        {group.cards.slice(0, 4).map((card, index) => (
                          <span className="pile-card-wrap" style={{ "--pile-index": index } as React.CSSProperties} key={card.id}>
                            <CardFace card={card} small />
                          </span>
                        ))}
                      </span>
                      <span className="build-chip">Total <b>{group.declaredTotal}</b></span>
                      <span className="build-count">{group.cards.length} cartes</span>
                    </>
                  )}
                </button>
              );
            })
          )}
        </div>

        {game.message && <p className="table-message"><span>✦</span>{game.message}</p>}
      </section>

      <section className="hand-panel">
        <div className="hand-heading">
          <div>
            <p className="eyebrow">{game.phase === "ai" ? "L’intelligence artificielle joue" : "À vous de jouer"}</p>
            <h2>{game.phase === "ai" ? "Le Croupier réfléchit…" : game.names[0]}</h2>
          </div>
          {game.phase === "playing" && (
            <p className="instruction">
              {selectedCard ? "Sélectionnez les cartes à prendre, ou posez votre carte." : "Choisissez une carte de votre main."}
            </p>
          )}
        </div>

        <div className="hand-cards" aria-label={`Main de ${game.names[game.current]}`}>
          {game.hands[game.current].map((card) => (
            <button
              key={card.id}
              className="hand-card-button"
              onClick={() => {
                setSelectedHand(selectedHand === card.id ? null : card.id);
                setSelectedGroups([]);
              }}
              disabled={game.phase !== "playing" || game.current !== 0}
              aria-pressed={selectedHand === card.id}
              aria-label={`Jouer le ${card.rank} de ${card.suit}`}
            >
              {game.phase === "playing" && game.current === 0 ? (
                <CardFace card={card} selected={selectedHand === card.id} />
              ) : (
                <CardBack />
              )}
            </button>
          ))}
        </div>

        {game.phase === "ai" ? (
          <div className="ai-thinking" role="status" aria-live="polite">
            <span className="thinking-dots"><i></i><i></i><i></i></span>
            <span><b>Analyse en cours</b><small>Le Croupier compare les captures et anticipe votre prochain coup.</small></span>
          </div>
        ) : (
          <div className="action-bar">
            <span className="selection-summary">
              {selectedCard
                ? `${selectedCard.rank}${selectedCard.suit} sélectionné${selectedGroups.length ? ` · ${selectedGroups.length} groupe${selectedGroups.length > 1 ? "s" : ""} visé${selectedGroups.length > 1 ? "s" : ""}` : ""}`
                : "Aucune carte sélectionnée"}
            </span>
            <div className="turn-actions">
              <button className="action-button capture-button" disabled={!canCapture} onClick={capture}>
                <span>✦</span> Capturer
              </button>
              <button className="action-button build-button" disabled={!buildChoice} onClick={build}>
                {buildChoice?.disrupt ? "Perturber" : "Préparer"}
                {buildChoice && <small>Total {buildChoice.total}</small>}
              </button>
              <button className="action-button discard-button" disabled={!selectedCard} onClick={discard}>
                Poser seule
              </button>
            </div>
          </div>
        )}
      </section>

      {game.phase === "round" && (
        <div className="modal-backdrop">
          <section className="round-card" role="dialog" aria-modal="true" aria-labelledby="round-title">
            <p className="eyebrow">La partie continue</p>
            <div className="round-number">{game.round}</div>
            <h2 id="round-title">Manche {game.round}</h2>
            <p>{game.message}</p>
            <div className="mid-scores">
              <span>{game.names[0]} <b>{scores[0]}</b></span>
              <i>—</i>
              <span><b>{scores[1]}</b> {game.names[1]}</span>
            </div>
            <button className="primary-button" onClick={continueRound}>
              Continuer <span>→</span>
            </button>
          </section>
        </div>
      )}

      {game.phase === "finished" && (
        <div className="modal-backdrop final-backdrop">
          <section className="final-card" role="dialog" aria-modal="true" aria-labelledby="final-title">
            <span className="final-kicker">Partie terminée</span>
            <div className="trophy">♛</div>
            <h2 id="final-title">
              {winner === null ? "Égalité parfaite" : `${game.names[winner]} remporte la partie`}
            </h2>
            <p>{game.message}</p>
            <div className="final-scores">
              {([0, 1] as Player[]).map((player) => (
                <div className={winner === player ? "winner" : ""} key={player}>
                  <span>{game.names[player]}</span>
                  <strong>{scores[player]}</strong>
                  <small>cartes</small>
                </div>
              ))}
            </div>
            <div className="final-actions">
              <button className="primary-button" onClick={() => startGame(game.names[0])}>
                Rejouer <span>↻</span>
              </button>
              <button className="quiet-button light" onClick={returnToSetup}>
                Changer mon nom
              </button>
            </div>
          </section>
        </div>
      )}

      <RulesModal open={showRules} onClose={() => setShowRules(false)} />
    </main>
  );
}

function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop rules-backdrop">
      <section className="rules-card" role="dialog" aria-modal="true" aria-labelledby="rules-title">
        <button className="close-button" onClick={onClose} aria-label="Fermer les règles">×</button>
        <p className="eyebrow">Règles express</p>
        <h2 id="rules-title">Comment jouer</h2>
        <div className="rules-grid">
          <article><span>01</span><h3>Choisissez</h3><p>À votre tour, sélectionnez une carte de votre main.</p></article>
          <article><span>02</span><h3>Capturez</h3><p>Sélectionnez une ou plusieurs cartes dont la somme égale votre carte. L’As vaut 1 ou 14.</p></article>
          <article><span>03</span><h3>Préparez</h3><p>Ajoutez votre carte à une combinaison si vous gardez en main une carte égale au nouveau total.</p></article>
          <article><span>04</span><h3>Ou posez</h3><p>Sans capture, laissez votre carte seule sur la table pour créer une occasion future.</p></article>
        </div>
        <div className="rule-note ai-rule-note"><b>Votre adversaire</b><p>Le Croupier IA évalue toutes les captures accessibles, privilégie les plus rentables et prépare des combinaisons lorsqu’aucune prise n’est possible.</p></div>
        <div className="rule-note"><b>Le but</b><p>Après trois manches, la plus grande réserve gagne. Les dernières cartes vont au dernier joueur ayant capturé.</p></div>
        <button className="primary-button" onClick={onClose}>Compris, jouons</button>
      </section>
    </div>
  );
}
