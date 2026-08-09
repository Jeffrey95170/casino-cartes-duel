import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

export function AppHeader() {
  return (
    <header className="portal-header">
      <Link className="brand-home" href="/" aria-label="Accueil Capture 52">
        <BrandMark compact />
      </Link>
      <nav aria-label="Navigation principale">
        <Link href="/">Jouer</Link>
        <Link href="/profil">Mon profil</Link>
        <Link href="/classement">Classement</Link>
      </nav>
    </header>
  );
}
