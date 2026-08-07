export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : "Requête invalide.";
  return jsonResponse({ error: message }, status);
}

export function preflightResponse(request: Request): Response | null {
  return request.method === "OPTIONS" ? new Response("ok", { headers: corsHeaders }) : null;
}

export function bearerToken(request: Request): string {
  const value = request.headers.get("Authorization") ?? "";
  if (!value.startsWith("Bearer ")) throw new Error("Session Supabase manquante.");
  return value.slice(7);
}
