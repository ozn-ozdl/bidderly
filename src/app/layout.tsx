import type { Metadata } from "next";
import { JetBrains_Mono, Geist, Instrument_Serif, Newsreader, Fraunces, Inter_Tight } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { isClerkConfigured } from "@/lib/env";
import { defaultTheme } from "@/lib/theme";
import { ThemeScript } from "@/components/ui/theme-script";

import "./globals.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  variable: "--font-display-console",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-atelier",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-brief",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body-brief",
});

export const metadata: Metadata = {
  title: "Bidderly.win | Opportunity Radar",
  description:
    "Proactive tender and procurement opportunity radar for German and EU sales teams. GLiNER2 → Gemma 4 → Gemini cascade.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeVars = `${jetbrains.variable} ${geist.variable} ${instrumentSerif.variable} ${newsreader.variable} ${fraunces.variable} ${interTight.variable}`;

  return (
    <html
      lang="en"
      data-theme={defaultTheme}
      className={`${themeVars} h-full antialiased`}
      style={{ colorScheme: defaultTheme === "console" ? "dark" : "light" }}
    >
      <body className="min-h-full">
        <ThemeScript />
        {isClerkConfigured() ? <ClerkProvider>{children}</ClerkProvider> : children}
      </body>
    </html>
  );
}
