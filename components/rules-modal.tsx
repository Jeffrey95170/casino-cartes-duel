"use client";

import { useEffect } from "react";

export function RulesModal({
  open,
  onClose,
  onTutorial,
}: {
  open: boolean;
  onClose: () => void;
  onTutorial: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop rules-backdrop">
      <section className="rules-card" role="dialog" aria-modal="true" aria-labelledby="rules-title">
        <button className="close-button" onClick={onClose} aria-label="Fermer les règles">×</button>
        <p className="eyebrow">Règles express</p>
        <h2 id="rules-title">Comment jouer</h2>
        <div className="rules-grid">
          <article><span>01</span><h3>Choisissez</h3><p>À votre tour, sélectionnez une carte de votre main.</p></article>
          <article><span>02</span><h3>Capturez</h3><p>Visez des cartes dont la somme égale votre carte. L’As vaut 1 ou 14.</p></article>
          <article><span>03</span><h3>Préparez</h3><p>Ajoutez votre carte si vous gardez en main une carte égale au nouveau total.</p></article>
          <article><span>04</span><h3>Ou posez</h3><p>Sans capture, laissez votre carte seule sur la table pour une occasion future.</p></article>
        </div>
        <div className="rule-note ai-rule-note"><b>Votre adversaire</b><p>Le Croupier IA compare les captures, privilégie les prises rentables et prépare des combinaisons.</p></div>
        <div className="rule-note"><b>Le but</b><p>Après trois manches, la plus grande réserve gagne. Les dernières cartes vont au dernier joueur ayant capturé.</p></div>
        <div className="rules-actions">
          <button className="secondary-button" onClick={onTutorial}>Voir le tutoriel</button>
          <button className="primary-button" onClick={onClose}>Compris, jouons</button>
        </div>
      </section>
    </div>
  );
}
