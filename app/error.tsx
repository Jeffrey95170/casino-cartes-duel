"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="error-shell">
      <section className="error-card">
        <span aria-hidden="true">♠</span>
        <p className="eyebrow">Incident de partie</p>
        <h1>Une carte s’est égarée.</h1>
        <p>Votre navigateur n’a rien perdu de sensible. Vous pouvez relancer l’écran ou revenir à l’accueil.</p>
        <div>
          <button className="primary-button" onClick={reset}>Réessayer <span>↻</span></button>
          <Link href="/">Retour à l’accueil</Link>
        </div>
      </section>
    </main>
  );
}
