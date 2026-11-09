import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MUTETOX — Creator Comment Governance & AI Moderation Engine",
  description:
    "Real-time toxicity interception, Smart De-Tox rewriting, auto-censoring and clustered moderation queues for creators.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} bg-zinc-950 font-sans text-zinc-50 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
