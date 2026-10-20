"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { isValidUsername } from "@/lib/progression";

export function ProfileEditor() {
  const auth = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    setFailed(false);
    if (!isValidUsername(name)) {
      setFailed(true);
      setMessage("Utilise 3 à 20 caractères : lettres sans accents, chiffres, _ ou -.");
      return;
    }
    setBusy(true);
    try {
      if (name !== auth.profile?.username) {
        if (!await auth.isUsernameAvailable(name)) throw new Error("Ce pseudonyme est déjà utilisé. Choisis-en un autre.");
        await auth.updateUsername(name);
      }
      setEditing(false);
      setMessage("Pseudonyme enregistré. Ta progression est conservée.");
    } catch (cause) {
      setFailed(true);
      setMessage(cause instanceof Error ? cause.message : "Enregistrement impossible. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-editor" aria-label="Modifier mon profil">
      {!editing ? <button className="secondary-button" onClick={() => {
        setName(auth.profile?.username ?? ""); setMessage(""); setFailed(false); setEditing(true);
      }}>Modifier mon nom</button> : (
        <form onSubmit={save}>
          <label htmlFor="profile-name">Pseudonyme public</label>
          <p id="profile-name-help">3 à 20 caractères : lettres sans accents, chiffres, _ ou -. Ton lien de profil changera avec ton nom.</p>
          <div className="name-edit-row">
            <input id="profile-name" aria-describedby="profile-name-help" value={name} onChange={(event) => setName(event.target.value)} autoComplete="nickname" minLength={3} maxLength={20} pattern="[A-Za-z0-9_-]+" required disabled={busy} />
            <button className="primary-link" type="submit" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le nom"}</button>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => { setEditing(false); setMessage(""); }}>Annuler</button>
          </div>
        </form>
      )}
      {message && <p className={failed ? "server-error" : "profile-saved"} role={failed ? "alert" : "status"}>{message}</p>}
    </section>
  );
}
