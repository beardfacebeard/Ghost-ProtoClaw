import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

import "@/app/globals.css";
import { Toaster } from "@/components/ui/toaster";

// Geist — the new primary UI font for the 2026 redesign. Designed by
// Vercel for developer tools; replaces Outfit as the body default.
//
// Outfit and JetBrains Mono stay loaded as fallbacks so components that
// still reference --font-outfit or --font-mono continue rendering during
// the page-by-page migration to the new design system.
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"]
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  title: "Ghost ProtoClaw",
  description: "Complex tech. Invisible effort.",
  icons: {
    icon: "/favicon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ${outfit.variable} ${jetbrainsMono.variable} bg-ghost-gradient font-sans text-white`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
