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
  title: "Capture 52 — Think. Build. Capture.",
  description:
    "Capture 52 est un jeu de cartes stratégique compétitif contre une intelligence artificielle. Pensez, construisez et capturez — sans argent réel.",
  applicationName: "Capture 52",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Capture 52 — Think. Build. Capture.",
    description:
      "Un duel de cartes stratégique contre l’IA. Pensez, construisez et capturez — sans argent réel.",
    type: "website",
    locale: "fr_FR",
    siteName: "Capture 52",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Capture 52 — Think. Build. Capture." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Capture 52 — Think. Build. Capture.",
    description:
      "Un duel de cartes stratégique contre l’IA. Pensez, construisez et capturez — sans argent réel.",
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
  themeColor: "#080A0C",
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
