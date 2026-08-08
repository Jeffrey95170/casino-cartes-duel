import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";

import { AnalyticsPageView } from "@/components/analytics-pageview";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const productionHost =
  process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ??
  "casino-cartes-duel.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${productionHost}`),
  title: "Casino Cartes Duel — Jeu de stratégie gratuit",
  description:
    "Affrontez le Croupier dans Casino Cartes Duel, un jeu de cartes stratégique où calcul, anticipation et pièges font la différence. Gratuit et sans argent réel.",
  applicationName: "Casino Cartes Duel",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Casino Cartes Duel — Jeu de stratégie gratuit",
    description:
      "Affrontez le Croupier dans Casino Cartes Duel, un jeu de cartes stratégique où calcul, anticipation et pièges font la différence. Gratuit et sans argent réel.",
    type: "website",
    locale: "fr_FR",
    siteName: "Casino Cartes Duel",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Casino Cartes Duel" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Casino Cartes Duel — Jeu de stratégie gratuit",
    description:
      "Affrontez le Croupier dans Casino Cartes Duel, un jeu de cartes stratégique où calcul, anticipation et pièges font la différence. Gratuit et sans argent réel.",
    images: ["/og.jpg"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#071b17",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider>{children}</AuthProvider>
        <Suspense fallback={null}><AnalyticsPageView /></Suspense>
        <SpeedInsights />
      </body>
    </html>
  );
}
