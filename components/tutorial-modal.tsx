"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    title: "Choisissez votre carte",
    copy: "Touchez une carte de votre main. Sa valeur devient votre objectif de capture.",
    visual: <div className="tutorial-hand"><span>4♣</span><span className="active">V♠</span><span>7♦</span></div>,
  },
  {
    title: "Additionnez la table",
    copy: "Sélectionnez une ou plusieurs cartes dont la somme égale votre carte. L’As vaut 1 ou 14.",
    visual: <div className="tutorial-equation"><span>9♥</span><b>+</b><span>2♣</span><b>=</b><span className="target">V♠</span></div>,
  },
  {
    title: "Préparez un piège",
    copy: "Créez un total que vous pourrez capturer au tour suivant. Le Croupier peut tenter de le perturber.",
    visual: <div className="tutorial-build"><span>3♦ + 3♠</span><b>Total 6</b><small>gardez un 6 en main</small></div>,
  },
  {
    title: "Raflez le plus de cartes",
    copy: "La partie dure trois manches. La plus grande réserve gagne, et les dernières cartes vont au dernier joueur ayant capturé.",
    visual: <div className="tutorial-score"><span>Vous <b>29</b></span><i>—</i><span><b>23</b> IA</span></div>,
  },
] as const;

export function TutorialModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: (completed: boolean) => void;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  const item = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="modal-backdrop tutorial-backdrop">
      <section className="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <div className="tutorial-topline">
          <span>Tutoriel express</span>
          <button className="skip-button" onClick={() => onClose(false)}>Passer</button>
        </div>
        <div className="tutorial-progress" aria-label={`Étape ${step + 1} sur ${STEPS.length}`}>
          {STEPS.map((entry, index) => (
            <span key={entry.title} className={index <= step ? "active" : ""} />
          ))}
        </div>
        <div className="tutorial-visual" aria-hidden="true">{item.visual}</div>
        <p className="eyebrow">Étape {step + 1} sur {STEPS.length}</p>
        <h2 id="tutorial-title">{item.title}</h2>
        <p>{item.copy}</p>
        <div className="tutorial-actions">
          {step > 0 && (
            <button className="quiet-button light" onClick={() => setStep((current) => current - 1)}>
              Retour
            </button>
          )}
          <button
            className="primary-button"
            onClick={() => (isLast ? onClose(true) : setStep((current) => current + 1))}
          >
            {isLast ? "Jouer" : "Suivant"} <span>→</span>
          </button>
        </div>
      </section>
    </div>
  );
}
