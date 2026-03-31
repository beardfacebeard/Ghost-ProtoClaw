import type { Metadata } from "next";

import "@/app/globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Ghost ProtoClaw Mission Control",
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
      <body className="bg-ghost-gradient font-sans text-white">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
