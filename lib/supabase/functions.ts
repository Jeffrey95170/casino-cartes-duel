import type { Session } from "@supabase/supabase-js";

import type { PlaySoloPayload, SoloMatchView } from "@/types/game-api";

const functionsBaseUrl = () => {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) throw new Error("Supabase n’est pas configuré.");
  return `${projectUrl}/functions/v1`;
};

async function invoke<T>(name: string, session: Session, body: unknown): Promise<T> {
  const response = await fetch(`${functionsBaseUrl()}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { data?: T; error?: string };
  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Le serveur de jeu n’a pas répondu correctement.");
  }
  return payload.data;
}

export function startSoloMatch(session: Session): Promise<SoloMatchView> {
  return invoke("start-solo-match", session, { requestId: crypto.randomUUID() });
}

export function playSoloAction(session: Session, payload: PlaySoloPayload): Promise<SoloMatchView> {
  return invoke("play-solo-action", session, payload);
}
