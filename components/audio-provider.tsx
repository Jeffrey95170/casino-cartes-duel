"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AUDIO_STORAGE_KEY, DEFAULT_AUDIO, GameAudio, parseAudioPreferences, type AudioPreferences, type SoundCue } from "@/lib/game-audio";

type AudioControls = {
  preferences: AudioPreferences;
  error: string;
  change: (patch: Partial<AudioPreferences>) => void;
  play: (cue: SoundCue) => void;
};
const AudioContext = createContext<AudioControls | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_AUDIO);
  const [error, setError] = useState("");
  const engine = useRef<GameAudio | null>(null);
  const current = useRef(DEFAULT_AUDIO);

  useEffect(() => {
    const audio = new GameAudio();
    engine.current = audio;
    try { current.current = parseAudioPreferences(localStorage.getItem(AUDIO_STORAGE_KEY)); } catch { /* Storage is optional. */ }
    audio.configure(current.current);
    const frame = requestAnimationFrame(() => setPreferences(current.current));
    const resume = () => {
      if (current.current.music || current.current.effects) void audio.unlock().catch(() => setError("Le son est indisponible. Réessaie avec le bouton Musique."));
    };
    const visibility = () => { void audio.visibilityChanged().catch(() => setError("Touche Musique pour reprendre le son.")); };
    document.addEventListener("pointerdown", resume, { passive: true });
    document.addEventListener("keydown", resume);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", resume);
      document.removeEventListener("keydown", resume);
      document.removeEventListener("visibilitychange", visibility);
      audio.dispose(); engine.current = null;
    };
  }, []);

  const change = useCallback((patch: Partial<AudioPreferences>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    setPreferences(next); setError("");
    try { localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(next)); } catch { /* Play works without storage. */ }
    engine.current?.configure(next);
    if (next.music || next.effects) void engine.current?.unlock().then(() => {
      if (patch.effects === true) engine.current?.play("capture");
    }).catch(() => setError("Le son est indisponible dans ce navigateur. Le jeu reste accessible."));
  }, []);
  const play = useCallback((cue: SoundCue) => { engine.current?.play(cue); }, []);
  const value = useMemo(() => ({ preferences, error, change, play }), [preferences, error, change, play]);
  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export function useGameAudio() {
  const value = useContext(AudioContext);
  if (!value) throw new Error("AudioProvider manquant.");
  return value;
}

export function SoundControls() {
  const { preferences, error, change } = useGameAudio();
  return <details className="sound-controls"><summary aria-label="Réglages audio">♫ <span>Audio</span><span className={`sound-led${preferences.music || preferences.effects ? " enabled" : ""}`} aria-hidden="true" /></summary><div className="sound-panel"><p className="eyebrow">Ambiance lounge</p><p className="sound-description">Piano doux, basse feutrée et bruitages de table.</p><button type="button" aria-pressed={preferences.music} onClick={() => change({ music: !preferences.music })}>♫ Musique <b>{preferences.music ? "Activée" : "Désactivée"}</b></button><label>Volume musique <span>{preferences.musicVolume}%</span><input type="range" min="0" max="100" step="5" value={preferences.musicVolume} onChange={(event) => change({ musicVolume: Number(event.target.value) })} /></label><button type="button" aria-pressed={preferences.effects} onClick={() => change({ effects: !preferences.effects })}>♣ Bruitages <b>{preferences.effects ? "Activés" : "Désactivés"}</b></button><label>Volume bruitages <span>{preferences.effectsVolume}%</span><input type="range" min="0" max="100" step="5" value={preferences.effectsVolume} onChange={(event) => change({ effectsVolume: Number(event.target.value) })} /></label><small>Préférences conservées sur cet appareil. Le son se met en pause en arrière-plan.</small>{error && <p role="status">{error}</p>}</div></details>;
}
