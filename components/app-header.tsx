import Link from "next/link";

export function AppHeader() {
  return (
    <header className="portal-header">
      <Link className="brand-mark compact" href="/"><span>♠</span> Casino</Link>
      <nav aria-label="Navigation principale">
        <Link href="/">Jouer</Link>
        <Link href="/profil">Mon profil</Link>
        <Link href="/classement">Classement</Link>
      </nav>
    </header>
  );
}
