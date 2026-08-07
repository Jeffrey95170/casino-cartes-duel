"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/components/auth-provider";
import { isValidUsername } from "@/lib/progression";

export default function AccountPage() {
  const auth = useAuth();
  const checkUsername = auth.isUsernameAvailable;
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!username || availability !== "checking") return;
    const timer = window.setTimeout(() => {
      void checkUsername(username).then((value) => setAvailability(value ? "available" : "taken")).catch(() => setAvailability("idle"));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [availability, checkUsername, username]);

  async function linkGoogleAccount() {
    if (availability !== "available") {
      setMessage("Choisis d’abord un pseudonyme disponible.");
      return;
    }
    setBusy(true); setMessage(null);
    try {
      await auth.updateUsername(username || auth.profile?.username || "");
      await auth.linkGoogle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google indisponible.");
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      await auth.upgradeAccount({ email, password, username: username || auth.profile?.username || "" });
      setMessage("Un email de confirmation a été envoyé. Ton UUID et ta progression sont conservés.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Conversion impossible.");
    } finally { setBusy(false); }
  }

  if (!auth.loading && !auth.isAnonymous) return <main className="portal-shell"><AppHeader /><section className="empty-state"><h1>Progression sauvegardée</h1><p>Ce profil est déjà lié à un compte permanent.</p><Link className="primary-link" href="/profil">Voir mon profil</Link></section></main>;

  return (
    <main className="portal-shell"><AppHeader /><div className="portal-content account-width"><section className="account-card"><p className="eyebrow">Compte invité → permanent</p><h1>Sauvegarder ma progression</h1><p>Ton XP, tes statistiques, ton historique et tes succès restent attachés au même identifiant.</p><form onSubmit={submit}><label>Pseudonyme<input value={username || auth.profile?.username || ""} minLength={3} maxLength={20} pattern="[A-Za-z0-9_-]+" required onChange={(event) => { const value = event.target.value; setUsername(value); setAvailability(isValidUsername(value) ? "checking" : "invalid"); }} /></label><small className={`availability ${availability}`}>{availability === "checking" ? "Vérification…" : availability === "available" ? "Pseudonyme disponible" : availability === "taken" ? "Pseudonyme déjà utilisé" : availability === "invalid" ? "3 à 20 caractères : lettres, chiffres, _ ou -" : "Choisis ou modifie ton pseudonyme pour vérifier sa disponibilité."}</small><label>Email<input type="email" autoComplete="email" value={email} required onChange={(event) => setEmail(event.target.value)} /></label><label>Mot de passe<input type="password" autoComplete="new-password" minLength={8} value={password} required onChange={(event) => setPassword(event.target.value)} /></label><button className="primary-button" disabled={busy || availability !== "available"}>{busy ? "Enregistrement…" : "Créer mon compte"}<span>→</span></button></form><div className="account-divider"><span>ou</span></div><button className="google-button" disabled={busy || availability !== "available"} onClick={() => void linkGoogleAccount()}>Continuer avec Google</button>{message && <p className="account-message" role="status">{message}</p>}<Link className="text-link portal-link" href="/">Continuer en invité</Link></section></div></main>
  );
}
