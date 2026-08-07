import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  applyMove,
  assertGameInvariant,
  chooseStrategicMove,
  continueRound,
  type Game,
  type GameMove,
  type TableGroup,
} from "../_shared/game.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/http.ts";
import { authenticatedUser, serviceClient } from "../_shared/supabase.ts";
import { functionView } from "../_shared/view.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ClientAction = GameMove | { kind: "continue" } | { kind: "abandon" };
type Payload = { matchId?: string; actionId?: string; expectedVersion?: number; action?: ClientAction };

function validatePayload(payload: Payload): asserts payload is Required<Payload> {
  if (!payload.matchId || !UUID_PATTERN.test(payload.matchId)) throw new Error("matchId invalide.");
  if (!payload.actionId || !UUID_PATTERN.test(payload.actionId)) throw new Error("actionId invalide.");
  if (!Number.isInteger(payload.expectedVersion) || Number(payload.expectedVersion) < 1) {
    throw new Error("Version de partie invalide.");
  }
  if (!payload.action || !["capture", "build", "discard", "continue", "abandon"].includes(payload.action.kind)) {
    throw new Error("Action invalide.");
  }
}

function actionMetrics(game: Game, action: ClientAction) {
  if (action.kind !== "capture") return {};
  const selected = game.table.filter((group) => action.groupIds.includes(group.id));
  return {
    has_capture: true,
    max_capture_size: 1 + selected.reduce((sum, group) => sum + group.cards.length, 0),
    captured_opponent_build: selected.some((group) => group.builtBy === 1),
  };
}

function isGame(value: unknown): value is Game {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Game>;
  return Array.isArray(candidate.deck)
    && Array.isArray(candidate.hands)
    && Array.isArray(candidate.table)
    && Array.isArray(candidate.captured);
}

function groupIdsExist(table: TableGroup[], action: ClientAction): boolean {
  if (action.kind !== "capture" && action.kind !== "build") return true;
  return action.groupIds.every((id) => table.some((group) => group.id === id));
}

Deno.serve(async (request) => {
  const preflight = preflightResponse(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return errorResponse("Méthode non autorisée.", 405);

  let userId: string | null = null;
  let matchId: string | null = null;
  try {
    const user = await authenticatedUser(request);
    userId = user.id;
    const payload = await request.json() as Payload;
    validatePayload(payload);
    matchId = payload.matchId;
    const service = serviceClient();

    if (payload.action.kind === "abandon") {
      const { data, error } = await service.rpc("abandon_solo_match_server", {
        p_user_id: user.id,
        p_match_id: payload.matchId,
      });
      if (error) throw new Error(error.message);
      return jsonResponse({ data: { abandoned: Boolean(data) } });
    }

    const { data: session, error: sessionError } = await service
      .from("game_sessions")
      .select("game_state,version,status")
      .eq("match_id", payload.matchId)
      .eq("user_id", user.id)
      .single();
    if (sessionError || !session) throw new Error("Partie introuvable ou non autorisée.");
    if (session.status !== "active") throw new Error("Cette partie n’est plus active.");
    if (session.version !== payload.expectedVersion) throw new Error("Version de partie obsolète.");
    if (!isGame(session.game_state)) throw new Error("État serveur illisible.");

    const game = session.game_state;
    assertGameInvariant(game);
    if (!groupIdsExist(game.table, payload.action)) throw new Error("La sélection de table est obsolète.");
    const metrics = actionMetrics(game, payload.action);
    let next = payload.action.kind === "continue"
      ? continueRound(game)
      : applyMove(game, payload.action, 0);

    if (next.phase === "ai") {
      next = applyMove(next, chooseStrategicMove(next, 1), 1);
    }
    assertGameInvariant(next);

    const { data, error } = await service.rpc("commit_solo_action_server", {
      p_user_id: user.id,
      p_match_id: payload.matchId,
      p_action_id: payload.actionId,
      p_expected_version: payload.expectedVersion,
      p_action_kind: payload.action.kind,
      p_new_state: next,
      p_action_metrics: metrics,
    });
    if (error || !data) throw new Error(error?.message ?? "Impossible d’enregistrer l’action.");
    return jsonResponse({ data: functionView(data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action serveur invalide.";
    if (userId && matchId && message.includes("Invariant")) {
      const service = serviceClient();
      await service.rpc("invalidate_solo_match_server", {
        p_user_id: userId,
        p_match_id: matchId,
        p_reason: message,
      });
    }
    const status = message.includes("non autorisée") || message.includes("Session") ? 401
      : message.includes("obsolète") ? 409
      : 400;
    return errorResponse(error, status);
  }
});
