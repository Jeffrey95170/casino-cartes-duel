"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="fr">
      <body>
        <main className="error-shell">
          <section className="error-card">
            <span aria-hidden="true">♠</span>
            <h1>Casino Cartes Duel doit être relancé.</h1>
            <p>Une erreur inattendue est survenue.</p>
            <button className="primary-button" onClick={reset}>Réessayer <span>↻</span></button>
          </section>
        </main>
      </body>
    </html>
  );
}
