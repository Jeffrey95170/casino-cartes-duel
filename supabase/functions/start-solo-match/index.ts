import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  applyMove,
  assertGameInvariant,
  chooseStrategicMove,
  createInitialGame,
} from "../_shared/game.ts";
import { errorResponse, jsonResponse, preflightResponse } from "../_shared/http.ts";
import { authenticatedUser, serviceClient } from "../_shared/supabase.ts";
import { functionView } from "../_shared/view.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  const preflight = preflightResponse(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return errorResponse("Méthode non autorisée.", 405);

  try {
    const user = await authenticatedUser(request);
    const body = await request.json() as { requestId?: string };
    if (!body.requestId || !UUID_PATTERN.test(body.requestId)) {
      return errorResponse(new Error("requestId invalide."));
    }

    const service = serviceClient();
    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) throw new Error("Le profil joueur est indisponible.");

    let game = createInitialGame(profile.username);
    if (game.phase === "ai") game = applyMove(game, chooseStrategicMove(game, 1), 1);
    assertGameInvariant(game);
    const { data, error } = await service.rpc("start_solo_match_server", {
      p_user_id: user.id,
      p_request_id: body.requestId,
      p_game_state: game,
      p_ai_difficulty: "strategique",
    });
    if (error || !data) throw new Error(error?.message ?? "Impossible de démarrer la partie.");

    return jsonResponse({ data: functionView(data) });
  } catch (error) {
    return errorResponse(error, 401);
  }
});
