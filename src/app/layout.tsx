import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import { isClerkConfigured } from "@/lib/env";

import "./globals.css";

export const metadata: Metadata = {
  title: "Bidderly.win | Opportunity Radar",
  description:
    "Proactive tender and procurement opportunity radar for German and EU sales teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {isClerkConfigured() ? <ClerkProvider>{children}</ClerkProvider> : children}
      </body>
    </html>
  );
}
