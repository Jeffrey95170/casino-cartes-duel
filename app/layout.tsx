import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://casino-cartes-duel.touch170.chatgpt.site"),
  title: "Casino — Affrontez le Croupier IA",
  description: "Un jeu de capture et de calcul en trois manches contre une intelligence artificielle stratégique.",
  openGraph: {
    title: "Casino — Affrontez le Croupier IA",
    description: "Calculez juste, tendez vos pièges et défiez une intelligence artificielle stratégique.",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "Casino — Affrontez le Croupier IA" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Casino — Affrontez le Croupier IA",
    description: "Un duel de cartes stratégique en trois manches.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
