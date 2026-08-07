"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CardBack, CardFace } from "@/components/game-card";
import { RulesModal } from "@/components/rules-modal";
import { TutorialModal } from "@/components/tutorial-modal";
import { trackProductEvent } from "@/lib/analytics";
import {
  applyMove,
  cardTotals,
  chooseStrategicMove,
  combineTotals,
  continueRound as continueRoundState,
  createInitialGame,
  EMPTY_GAME,
  findBuildChoice,
  tableCardCount,
  type Game,
  type GameMove,
  type Player,
} from "@/lib/game";
import {
  EMPTY_STATS,
  hasSeenTutorial,
  incrementStarted,
  readStats,
  recordResult,
  rememberTutorial,
  type GameStats,
} from "@/lib/local-storage";

const PUBLIC_URL = "https://casino-cartes-duel.vercel.app/";

export default function Home() {
  const [game, setGame] = useState<Game>(EMPTY_GAME);
  const [draftName, setDraftName] = useState("Joueur");
  const [selectedHand, setSelectedHand] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [startAfterTutorial, setStartAfterTutorial] = useState(false);
  const [stats, setStats] = useState<GameStats>(EMPTY_STATS);
  const [shareStatus, setShareStatus] = useState("");
  const aiTimer = useRef<number | null>(null);
  const recordedGame = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setStats(readStats()));
    return () => {
      window.cancelAnimationFrame(frame);
      if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    };
  }, []);

  useEffect(() => {
    if (game.phase !== "finished" || recordedGame.current) return;
    recordedGame.current = true;
    const playerScore = game.captured[0].length;
    const aiScore = game.captured[1].length;
    const result = playerScore === aiScore ? "draw" : playerScore > aiScore ? "win" : "loss";
    setStats((current) => recordResult(current, playerScore, result));
    trackProductEvent("game_completed", { player_score: playerScore, ai_score: aiScore });
    trackProductEvent(
      result === "win" ? "game_won" : result === "loss" ? "game_lost" : "game_drawn",
      { player_score: playerScore },
    );
  }, [game]);

  const selectedCard = game.hands[0].find((card) => card.id === selectedHand) ?? null;
  const selectedTable = useMemo(
    () => game.table.filter((group) => selectedGroups.includes(group.id)),
    [game.table, selectedGroups],
  );
  const selectedTableTotalOptions = useMemo(
    () => (selectedTable.length ? combineTotals(selectedTable) : []),
    [selectedTable],
  );
  const canCapture = Boolean(
    selectedCard &&
      selectedTable.length &&
      selectedTableTotalOptions.some((total) => cardTotals(selectedCard).includes(total)),
  );
  const buildChoice = findBuildChoice(game, selectedCard, selectedTable, 0);
  const scores: [number, number] = [game.captured[0].length, game.captured[1].length];
  const winner: Player | null = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;

  const selectionFeedback = useMemo(() => {
    if (!selectedCard) return { kind: "neutral", text: "Choisissez une carte de votre main." };
    if (!selectedTable.length) {
      return { kind: "neutral", text: `${selectedCard.rank}${selectedCard.suit} sélectionné — visez la table ou posez-la.` };
    }
    const tableValue = selectedTableTotalOptions.join(" ou ");
    const cardValue = cardTotals(selectedCard).join(" ou ");
    if (canCapture) {
      return { kind: "success", text: `Capture valide : total ${tableValue}.` };
    }
    if (buildChoice) {
      return {
        kind: "success",
        text: buildChoice.disrupt
          ? `Vous pouvez perturber cette combinaison : nouveau total ${buildChoice.total}.`
          : `Préparation possible : nouveau total ${buildChoice.total}.`,
      };
    }
    return {
      kind: "error",
      text: `Ces cartes totalisent ${tableValue} alors que votre carte vaut ${cardValue}.`,
    };
  }, [buildChoice, canCapture, selectedCard, selectedTable.length, selectedTableTotalOptions]);

  function clearSelection() {
    setSelectedHand(null);
    setSelectedGroups([]);
  }

  function scheduleAiTurn(aiState: Game) {
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    aiTimer.current = window.setTimeout(() => {
      if (aiState.phase !== "ai" || aiState.current !== 1) return;
      const next = applyMove(aiState, chooseStrategicMove(aiState, 1), 1);
      setGame(next);
      clearSelection();
    }, 850);
  }

  function setResolvedGame(next: Game) {
    setGame(next);
    clearSelection();
    if (next.phase === "ai") scheduleAiTurn(next);
  }

  function beginGame(playerName = draftName, replay = false) {
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    const next = createInitialGame(playerName);
    recordedGame.current = false;
    setDraftName(next.names[0]);
    setShareStatus("");
    setStats((current) => incrementStarted(current));
    if (replay) trackProductEvent("replay_clicked");
    trackProductEvent("game_started");
    setResolvedGame(next);
  }

  function requestStart() {
    trackProductEvent("play_clicked");
    if (!hasSeenTutorial()) {
      setStartAfterTutorial(true);
      setShowTutorial(true);
      trackProductEvent("tutorial_started", { source: "first_game" });
      return;
    }
    beginGame();
  }

  function openTutorial(source: "home" | "header" | "rules") {
    setShowRules(false);
    setStartAfterTutorial(false);
    setShowTutorial(true);
    trackProductEvent("tutorial_started", { source });
  }

  function closeTutorial(completed: boolean) {
    rememberTutorial();
    setShowTutorial(false);
    trackProductEvent(completed ? "tutorial_completed" : "tutorial_skipped");
    if (startAfterTutorial) {
      setStartAfterTutorial(false);
      beginGame();
    }
  }

  function playMove(move: GameMove) {
    if (game.phase !== "playing" || game.current !== 0) return;
    setResolvedGame(applyMove(game, move, 0));
  }

  function continueRound() {
    const next = continueRoundState(game);
    setResolvedGame(next);
  }

  function returnToSetup() {
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    clearSelection();
    setShareStatus("");
    setGame({ ...EMPTY_GAME, names: [draftName, "Croupier IA"] });
  }

  function capture() {
    if (!selectedCard || !canCapture) return;
    playMove({ kind: "capture", cardId: selectedCard.id, groupIds: selectedGroups });
  }

  function build() {
    if (!selectedCard || !buildChoice) return;
    playMove({
      kind: "build",
      cardId: selectedCard.id,
      groupIds: selectedGroups,
      total: buildChoice.total,
    });
  }

  function discard() {
    if (!selectedCard) return;
    playMove({ kind: "discard", cardId: selectedCard.id });
  }

  function toggleGroup(groupId: string) {
    setSelectedGroups((groups) =>
      groups.includes(groupId) ? groups.filter((id) => id !== groupId) : [...groups, groupId],
    );
  }

  async function shareResult() {
    const resultText = winner === null
      ? `Égalité ${scores[0]}–${scores[1]} dans Casino Cartes Duel !`
      : winner === 0
        ? `J’ai battu le Croupier ${scores[0]}–${scores[1]} dans Casino Cartes Duel !`
        : `Le Croupier gagne ${scores[1]}–${scores[0]}. À vous de faire mieux dans Casino Cartes Duel !`;
    const shareData = { title: "Casino Cartes Duel", text: resultText, url: PUBLIC_URL };
    trackProductEvent("share_clicked");

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShareStatus("Résultat partagé !");
        trackProductEvent("share_completed");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${resultText} ${PUBLIC_URL}`);
      setShareStatus("Lien copié — partagez-le où vous voulez.");
      trackProductEvent("link_copied");
    } catch {
      setShareStatus(`Copiez ce lien : ${PUBLIC_URL}`);
    }
  }

  if (game.phase === "setup") {
    return (
      <main className="setup-shell">
        <section className="setup-card">
          <div className="setup-copy">
            <div className="brand-mark"><span>♠</span> Maison Noire</div>
            <span className="beta-badge">Bêta 0.2</span>
            <p className="eyebrow">Jeu de stratégie · Solo contre l’IA</p>
            <h1>Casino</h1>
            <p className="setup-lead">Calculez juste. Tendez vos pièges. Raflez la table.</p>
            <p className="trust-line">Gratuit · Sans compte · Sans argent réel</p>
            <div className="quick-rules" aria-label="Résumé du jeu">
              <div><strong>3</strong><span>manches</span></div>
              <div><strong>1</strong><span>Croupier IA</span></div>
              <div><strong>52</strong><span>cartes à rafler</span></div>
            </div>
          </div>

          <div className="setup-form">
            <div className="deco-cards" aria-hidden="true">
              <span className="deco-card deco-one">A<span>♠</span></span>
              <span className="deco-card deco-two red">D<span>♥</span></span>
              <span className="deco-card deco-three">V<span>♣</span></span>
            </div>
            <div className="setup-action-copy">
              <p className="eyebrow">Prêt en quelques secondes</p>
              <h2>Affrontez le Croupier</h2>
              <p>L’IA calcule ses captures et prépare ses prochains coups.</p>
            </div>
            <label>
              Votre nom <small>(facultatif)</small>
              <input
                value={draftName}
                maxLength={18}
                placeholder="Joueur"
                autoComplete="nickname"
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && requestStart()}
              />
            </label>
            <button className="primary-button start-button" onClick={requestStart}>
              Jouer maintenant <span>→</span>
            </button>
            <div className="setup-links">
              <button className="text-button" onClick={() => openTutorial("home")}>Tutoriel express</button>
              <button className="text-button" onClick={() => setShowRules(true)}>Règles complètes</button>
            </div>
            <div className="local-stats" aria-label="Vos statistiques sur cet appareil">
              <span><b>{stats.gamesCompleted}</b> terminées</span>
              <span><b>{stats.wins}</b> victoire{stats.wins !== 1 ? "s" : ""}</span>
              <span><b>{stats.bestCaptured}</b> record</span>
            </div>
          </div>
        </section>
        <RulesModal open={showRules} onClose={() => setShowRules(false)} onTutorial={() => openTutorial("rules")} />
        {showTutorial && <TutorialModal open onClose={closeTutorial} />}
      </main>
    );
  }

  return (
    <main className="game-shell">
      <header className="game-header">
        <div className="brand-mark compact"><span>♠</span> Casino</div>
        <div className="round-track" aria-label={`Manche ${game.round} sur 3`}>
          {[1, 2, 3].map((round) => (
            <span key={round} className={round <= game.round ? "active" : ""}>{round}</span>
          ))}
          <small>Manche {game.round} / 3</small>
        </div>
        <div className="header-actions">
          <button className="guide-button" onClick={() => openTutorial("header")}>Guide</button>
          <button className="icon-button" onClick={() => setShowRules(true)} aria-label="Voir les règles">?</button>
          <button className="quiet-button" onClick={returnToSetup}>Quitter</button>
        </div>
      </header>

      <section className="scoreboard" aria-label="Scores">
        {([0, 1] as Player[]).map((player) => (
          <div
            className={`player-score${game.current === player && (game.phase === "playing" || game.phase === "ai") ? " is-turn" : ""}`}
            key={player}
          >
            <span className={`avatar avatar-${player + 1}`}>
              {player === 1 ? "IA" : game.names[player].slice(0, 1).toUpperCase()}
            </span>
            <span className="player-data">
              <strong>{game.names[player]}</strong>
              <small>{game.hands[player].length} carte{game.hands[player].length !== 1 ? "s" : ""} en main</small>
            </span>
            <span className="score-number"><b>{scores[player]}</b><small>capturées</small></span>
          </div>
        ))}
      </section>

      <section className="felt-table" aria-label="Table de jeu">
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
                  onClick={() => toggleGroup(group.id)}
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
                          <span
                            className="pile-card-wrap"
                            style={{ "--pile-index": index } as React.CSSProperties}
                            key={card.id}
                          >
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
        {game.message && <p className="table-message" role="status"><span>✦</span>{game.message}</p>}
      </section>

      <section className="hand-panel">
        <div className="hand-heading">
          <div>
            <p className="eyebrow">{game.phase === "ai" ? "L’intelligence artificielle joue" : "À vous de jouer"}</p>
            <h2>{game.phase === "ai" ? "Le Croupier réfléchit…" : game.names[0]}</h2>
          </div>
          {game.phase === "playing" && <p className="instruction">Touchez une carte, puis les cartes à capturer.</p>}
        </div>

        <div className="hand-cards" aria-label={`Main de ${game.names[0]}`}>
          {game.hands[0].map((card) => (
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
              <CardFace card={card} selected={selectedHand === card.id} />
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
            <span className={`selection-summary ${selectionFeedback.kind}`} role="status" aria-live="polite">
              {selectionFeedback.text}
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
              <span>{game.names[0]} <b>{scores[0]}</b></span><i>—</i><span><b>{scores[1]}</b> {game.names[1]}</span>
            </div>
            <button className="primary-button" onClick={continueRound}>Continuer <span>→</span></button>
          </section>
        </div>
      )}

      {game.phase === "finished" && (
        <div className="modal-backdrop final-backdrop">
          <section className="final-card" role="dialog" aria-modal="true" aria-labelledby="final-title">
            <span className="final-kicker">Partie terminée</span>
            <div className="trophy" aria-hidden="true">{winner === 0 ? "♛" : winner === 1 ? "♟" : "✦"}</div>
            <h2 id="final-title">{winner === null ? "Égalité" : winner === 0 ? "Victoire !" : "Défaite"}</h2>
            <p>
              {winner === null
                ? "Vous avez capturé autant de cartes que le Croupier."
                : winner === 0
                  ? "Vous avez déjoué le Croupier IA."
                  : "Le Croupier remporte ce duel. Prenez votre revanche !"}
            </p>
            <div className="final-scores">
              {([0, 1] as Player[]).map((player) => (
                <div className={winner === player ? "winner" : ""} key={player}>
                  <span>{game.names[player]}</span><strong>{scores[player]}</strong><small>cartes capturées</small>
                </div>
              ))}
            </div>
            <p className="final-stat">Votre record sur cet appareil : <b>{Math.max(stats.bestCaptured, scores[0])} cartes</b></p>
            <div className="final-actions">
              <button className="primary-button" onClick={() => beginGame(game.names[0], true)}>Rejouer <span>↻</span></button>
              <button className="share-button" onClick={shareResult}>Partager mon résultat</button>
              <button className="quiet-button light" onClick={returnToSetup}>Accueil</button>
            </div>
            {shareStatus && <p className="share-status" role="status" aria-live="polite">{shareStatus}</p>}
          </section>
        </div>
      )}

      <RulesModal open={showRules} onClose={() => setShowRules(false)} onTutorial={() => openTutorial("rules")} />
      {showTutorial && <TutorialModal open onClose={closeTutorial} />}
    </main>
  );
}
