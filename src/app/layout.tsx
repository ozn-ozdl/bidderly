import type { Metadata } from "next";
import { JetBrains_Mono, Geist, Newsreader } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { isClerkConfigured } from "@/lib/env";
import { defaultTheme } from "@/lib/theme";
import { UserStateProvider } from "@/components/realtime/user-state-provider";

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

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-atelier",
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
  const themeVars = `${jetbrains.variable} ${geist.variable} ${newsreader.variable}`;

  return (
    <html
      lang="en"
      data-theme={defaultTheme}
      className={`${themeVars} h-full antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="h-full">
        {isClerkConfigured() ? (
          <ClerkProvider>
            <UserStateProvider>{children}</UserStateProvider>
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
