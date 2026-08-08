"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/components/auth-provider";
import { CardBack, CardFace } from "@/components/game-card";
import { RulesModal } from "@/components/rules-modal";
import { TutorialModal } from "@/components/tutorial-modal";
import { track } from "@/lib/analytics";
import { GameAnalyticsTracker } from "@/lib/analytics/game";
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
import { playSoloAction, startSoloMatch } from "@/lib/supabase/functions";
import {
  EMPTY_STATS,
  hasSeenTutorial,
  incrementStarted,
  readStats,
  recordResult,
  rememberTutorial,
  type GameStats,
} from "@/lib/local-storage";
import type { ProgressReward } from "@/types/game-api";

const PUBLIC_URL = "https://casino-cartes-duel.vercel.app/";

export default function Home() {
  const auth = useAuth();
  const [game, setGame] = useState<Game>(EMPTY_GAME);
  const [draftName, setDraftName] = useState("Joueur");
  const [selectedHand, setSelectedHand] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [startAfterTutorial, setStartAfterTutorial] = useState(false);
  const [stats, setStats] = useState<GameStats>(EMPTY_STATS);
  const [shareStatus, setShareStatus] = useState("");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchVersion, setMatchVersion] = useState(1);
  const [progress, setProgress] = useState<ProgressReward | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverBusy, setServerBusy] = useState(false);
  const aiTimer = useRef<number | null>(null);
  const recordedGame = useRef(false);
  const currentGameId = useRef<string | null>(null);
  const gameAnalytics = useRef(new GameAnalyticsTracker());
  const tutorialStartedAt = useRef<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setStats(readStats()));
    return () => {
      window.cancelAnimationFrame(frame);
      if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    };
  }, []);

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
    if (next.phase === "finished" && !recordedGame.current) {
      recordedGame.current = true;
      const playerScore = next.captured[0].length;
      const aiScore = next.captured[1].length;
      const result = playerScore === aiScore ? "draw" : playerScore > aiScore ? "win" : "loss";
      if (!matchId) setStats((current) => recordResult(current, playerScore, result));
      if (currentGameId.current) {
        gameAnalytics.current.complete({
          gameId: currentGameId.current,
          result,
          playerScore,
          opponentScore: aiScore,
          roundsPlayed: next.round,
        });
      }
    }
  }

  async function beginGame(playerName = draftName, replay = false) {
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    recordedGame.current = false;
    setShareStatus("");
    setServerError(null);
    setProgress(null);
    if (replay) gameAnalytics.current.playAgainClicked();
    const playerGamesBefore = auth.stats?.games_completed ?? stats.gamesCompleted;
    if (auth.configured) {
      if (!auth.session) {
        setServerError("La session invitée est encore en cours de préparation. Réessaie dans un instant.");
        return;
      }
      setServerBusy(true);
      try {
        const response = await startSoloMatch(auth.session);
        setMatchId(response.matchId);
        setMatchVersion(response.version);
        setDraftName(response.game.names[0]);
        currentGameId.current = response.matchId;
        gameAnalytics.current.start({ gameId: response.matchId, playerGamesBefore });
        setResolvedGame(response.game);
        await auth.refreshProfile();
      } catch (error) {
        setServerError(error instanceof Error ? error.message : "Impossible de démarrer la partie vérifiée.");
      } finally {
        setServerBusy(false);
      }
      return;
    }

    const next = createInitialGame(playerName);
    const localGameId = crypto.randomUUID();
    setMatchId(null);
    setDraftName(next.names[0]);
    setStats((current) => incrementStarted(current));
    currentGameId.current = localGameId;
    gameAnalytics.current.start({ gameId: localGameId, playerGamesBefore });
    setResolvedGame(next);
  }

  function requestStart() {
    if (!hasSeenTutorial()) {
      setStartAfterTutorial(true);
      setShowTutorial(true);
      tutorialStartedAt.current = Date.now();
      track("tutorial_started", { entry_point: "first_game" });
      return;
    }
    beginGame();
  }

  function openTutorial(source: "home" | "header" | "rules") {
    setShowRules(false);
    setStartAfterTutorial(false);
    setShowTutorial(true);
    tutorialStartedAt.current = Date.now();
    track("tutorial_started", { entry_point: source });
  }

  function closeTutorial(completed: boolean) {
    const durationSeconds = tutorialStartedAt.current === null
      ? 0
      : Math.max(0, Math.round((Date.now() - tutorialStartedAt.current) / 1000));
    tutorialStartedAt.current = null;
    rememberTutorial();
    setShowTutorial(false);
    if (completed) track("tutorial_completed", { duration_seconds: durationSeconds });
    else track("tutorial_skipped", { duration_seconds: durationSeconds });
    if (startAfterTutorial) {
      setStartAfterTutorial(false);
      beginGame();
    }
  }

  async function submitServerAction(action: GameMove | { kind: "continue" }) {
    if (!auth.session || !matchId || serverBusy) return;
    setServerBusy(true);
    setServerError(null);
    try {
      const response = await playSoloAction(auth.session, {
        matchId,
        expectedVersion: matchVersion,
        actionId: crypto.randomUUID(),
        action,
      });
      setMatchVersion(response.version);
      if (action.kind !== "continue" && !response.duplicate) gameAnalytics.current.noteAction(action.kind);
      setResolvedGame(response.game);
      if (response.progress) {
        setProgress(response.progress);
        await auth.refreshProfile();
      }
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Impossible d’enregistrer cette action.");
    } finally {
      setServerBusy(false);
    }
  }

  function playMove(move: GameMove) {
    if (game.phase !== "playing" || game.current !== 0) return;
    if (matchId) {
      void submitServerAction(move);
      return;
    }
    const next = applyMove(game, move, 0);
    gameAnalytics.current.noteAction(move.kind);
    setResolvedGame(next);
  }

  function continueRound() {
    if (matchId) {
      void submitServerAction({ kind: "continue" });
      return;
    }
    const next = continueRoundState(game);
    setResolvedGame(next);
  }

  function returnToSetup() {
    if (aiTimer.current !== null) window.clearTimeout(aiTimer.current);
    if (currentGameId.current && game.phase !== "finished") {
      gameAnalytics.current.abandon({ gameId: currentGameId.current, currentRound: game.round });
    }
    if (matchId && auth.session && game.phase !== "finished") {
      void playSoloAction(auth.session, {
        matchId,
        expectedVersion: matchVersion,
        actionId: crypto.randomUUID(),
        action: { kind: "abandon" },
      }).catch(() => undefined);
    }
    clearSelection();
    setShareStatus("");
    setServerError(null);
    setProgress(null);
    setMatchId(null);
    currentGameId.current = null;
    setGame({ ...EMPTY_GAME, names: [draftName, "Croupier IA"] });
  }

  function openRules(entryPoint: "setup" | "game_header") {
    setShowRules(true);
    track("rules_viewed", { entry_point: entryPoint });
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

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShareStatus("Résultat partagé !");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${resultText} ${PUBLIC_URL}`);
      setShareStatus("Lien copié — partagez-le où vous voulez.");
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
            <span className="beta-badge">Progression V1</span>
            <p className="eyebrow">Jeu de stratégie · Solo contre l’IA</p>
            <h1>Casino</h1>
            <p className="setup-lead">Calculez juste. Tendez vos pièges. Raflez la table.</p>
            <p className="trust-line">Gratuit · Compte invité automatique · Sans argent réel</p>
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
              <p>L’IA calcule ses captures. Les résultats vérifiés alimentent votre progression.</p>
            </div>
            {auth.configured ? (
              <div className="account-summary">
                <span className="avatar avatar-1">{(auth.profile?.username ?? "J").slice(0, 1).toUpperCase()}</span>
                <span><b>{auth.loading ? "Préparation du compte…" : auth.profile?.username ?? "Invité"}</b><small>{auth.isAnonymous ? "Compte invité" : "Progression sauvegardée"} · Niveau {auth.stats?.level ?? 1}</small></span>
                <Link href="/profil">Profil</Link>
              </div>
            ) : (
              <label>
                Votre nom <small>(mode local non classé)</small>
                <input
                  value={draftName}
                  maxLength={18}
                  placeholder="Joueur"
                  autoComplete="nickname"
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && requestStart()}
                />
              </label>
            )}
            <button className="primary-button start-button" aria-label="Jouer maintenant" onClick={requestStart} disabled={serverBusy || auth.loading}>
              {serverBusy || auth.loading ? "Préparation…" : "Jouer maintenant"} <span>→</span>
            </button>
            {(serverError || auth.error) && <p className="server-error" role="alert">{serverError ?? auth.error}</p>}
            {!auth.configured && <p className="offline-note">Supabase non configuré : cette partie restera locale et ne donnera aucun XP.</p>}
            <div className="setup-links">
              <button className="text-button" onClick={() => openTutorial("home")}>Tutoriel express</button>
              <button className="text-button" onClick={() => openRules("setup")}>Règles complètes</button>
              <Link className="text-link" href="/classement">Classement</Link>
            </div>
            <div className="local-stats" aria-label="Vos statistiques">
              <span><b>{auth.stats?.games_completed ?? stats.gamesCompleted}</b> terminées</span>
              <span><b>{auth.stats?.wins ?? stats.wins}</b> victoire{(auth.stats?.wins ?? stats.wins) !== 1 ? "s" : ""}</span>
              <span><b>{auth.stats?.best_cards_captured ?? stats.bestCaptured}</b> record</span>
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
          <Link className="guide-button" href="/profil">Profil</Link>
          <Link className="guide-button" href="/classement">Classement</Link>
          <button className="guide-button" onClick={() => openTutorial("header")}>Guide</button>
          <button className="icon-button" onClick={() => openRules("game_header")} aria-label="Voir les règles">?</button>
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
                  disabled={serverBusy || game.phase !== "playing" || game.current !== 0}
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
            <p className="eyebrow">{game.phase === "ai" || serverBusy ? "L’intelligence artificielle joue" : "À vous de jouer"}</p>
            <h2>{game.phase === "ai" || serverBusy ? "Le Croupier réfléchit…" : game.names[0]}</h2>
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
              disabled={serverBusy || game.phase !== "playing" || game.current !== 0}
              aria-pressed={selectedHand === card.id}
              aria-label={`Jouer le ${card.rank} de ${card.suit}`}
            >
              <CardFace card={card} selected={selectedHand === card.id} />
            </button>
          ))}
        </div>

        {game.phase === "ai" || serverBusy ? (
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
              <button className="action-button capture-button" disabled={!canCapture || serverBusy} onClick={capture}>
                <span>✦</span> Capturer
              </button>
              <button className="action-button build-button" disabled={!buildChoice || serverBusy} onClick={build}>
                {buildChoice?.disrupt ? "Perturber" : "Préparer"}
                {buildChoice && <small>Total {buildChoice.total}</small>}
              </button>
              <button className="action-button discard-button" disabled={!selectedCard || serverBusy} onClick={discard}>
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
            <button className="primary-button" onClick={continueRound} disabled={serverBusy}>Continuer <span>→</span></button>
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
            {progress ? (
              <div className="progress-reward" aria-live="polite">
                <strong>+{progress.xp_awarded} XP</strong>
                <span>Niveau {progress.old_level}{progress.new_level > progress.old_level ? ` → Niveau ${progress.new_level}` : ""}</span>
                {progress.old_rank && progress.new_rank && <span>Classement : #{progress.old_rank} → #{progress.new_rank}</span>}
                {progress.achievements_unlocked.map((achievement) => (
                  <span className="achievement-toast" key={achievement.code}>{achievement.icon} Succès : {achievement.name}</span>
                ))}
              </div>
            ) : (
              <p className="final-stat">Record {matchId ? "du profil" : "sur cet appareil"} : <b>{Math.max(auth.stats?.best_cards_captured ?? stats.bestCaptured, scores[0])} cartes</b></p>
            )}
            {auth.isAnonymous && matchId && (
              <p className="guest-save-note">Sauvegarde ta progression sur tous tes appareils sans perdre cet XP.</p>
            )}
            <div className="final-actions">
              <button className="primary-button" onClick={() => beginGame(game.names[0], true)}>Rejouer <span>↻</span></button>
              <Link className="share-button link-button" href={auth.isAnonymous ? "/compte" : "/profil"}>{auth.isAnonymous ? "Sauvegarder ma progression" : "Voir mon profil"}</Link>
              <Link className="share-button link-button" href="/classement">Classement</Link>
              <button className="share-button" onClick={shareResult}>Partager mon résultat</button>
              <button className="quiet-button light" onClick={returnToSetup}>Accueil</button>
            </div>
            {shareStatus && <p className="share-status" role="status" aria-live="polite">{shareStatus}</p>}
            {serverError && <p className="server-error dark" role="alert">{serverError}</p>}
          </section>
        </div>
      )}

      <RulesModal open={showRules} onClose={() => setShowRules(false)} onTutorial={() => openTutorial("rules")} />
      {showTutorial && <TutorialModal open onClose={closeTutorial} />}
    </main>
  );
}
