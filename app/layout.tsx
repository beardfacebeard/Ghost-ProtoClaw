import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";

import "@/app/globals.css";
import { Toaster } from "@/components/ui/toaster";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
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
      <body className={`${outfit.variable} ${jetbrainsMono.variable} bg-ghost-gradient font-sans text-white`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
