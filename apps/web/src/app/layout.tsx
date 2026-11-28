import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { JSX } from "react";

import { themeColors } from "@kyren/ui/lib/theme-colors";

import "./globals.css";

// Geist for the interface, Bricolage Grotesque for display type, Geist Mono for
// keys, timers and figures, Instrument Serif for the editorial accent.
// Variable fonts, self-hosted so builds never need the network.
const sans = localFont({
  src: "./fonts/geist-latin-wght-normal.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});
const display = localFont({
  src: "./fonts/bricolage-grotesque-latin-wght-normal.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});
// Only the interface and display faces are preloaded; mono and serif are used
// below the fold, so let the browser discover them with the CSS instead.
const mono = localFont({
  src: "./fonts/geist-mono-latin-wght-normal.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const serif = localFont({
  src: [
    {
      path: "./fonts/instrument-serif-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/instrument-serif-latin-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  // Shared links resolve their preview images against the real address.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Kyren",
    template: "%s · Kyren",
  },
  description:
    "Projects, tasks and docs in one workspace, with roles and an audit log that go all the way down.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: themeColors.light },
    { media: "(prefers-color-scheme: dark)", color: themeColors.dark },
  ],
};

// This layout deliberately reads no cookies or headers. Public pages must stay
// static and CDN-cacheable; the providers live in the layouts that need them.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): JSX.Element {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full antialiased ${sans.variable} ${mono.variable} ${display.variable} ${serif.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
