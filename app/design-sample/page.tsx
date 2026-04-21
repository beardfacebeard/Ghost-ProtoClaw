import Link from "next/link";

import { requireServerSession } from "@/lib/auth/server-session";
import { DesignSampleClient } from "./DesignSampleClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Design Sample · Ghost ProtoClaw",
  description:
    "Preview of the proposed redesign — fonts, colors, and style directions."
};

export default async function DesignSamplePage() {
  // Auth-gate. This page is dev-only. Renders outside AdminShell so the
  // new design direction isn't polluted by the current cluttered sidebar.
  await requireServerSession();

  return (
    <>
      {/* Fontshare CDN — Geist, Satoshi, Clash Grotesk.
          Inter + JetBrains Mono come from next/font already in root layout;
          we additionally pull Inter via Google Fonts CDN here so the sample
          page can apply it directly without changing the root layout. */}
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
        crossOrigin=""
      />
      <link
        rel="preconnect"
        href="https://api.fontshare.com"
        crossOrigin=""
      />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
      />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://api.fontshare.com/v2/css?f[]=geist@400,500,600,700&f[]=satoshi@400,500,700,900&f[]=clash-grotesk@500,600,700&display=swap"
      />

      <div
        className="min-h-screen"
        style={{ background: "#08090B", color: "#F2F4F8" }}
      >
        {/* Top bar with a way back */}
        <div
          className="sticky top-0 z-50 border-b"
          style={{
            background: "#08090B",
            borderColor: "#1F232C",
            backdropFilter: "blur(8px)"
          }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div
                className="h-8 w-8 rounded-md"
                style={{
                  background:
                    "linear-gradient(135deg, #5B7FB0 0%, #3B5F8F 100%)",
                  boxShadow: "0 0 20px rgba(91, 127, 176, 0.35)"
                }}
              />
              <div>
                <div
                  className="text-sm font-semibold"
                  style={{ fontFamily: "'Geist', Inter, system-ui" }}
                >
                  Ghost ProtoClaw
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: "#5C6475" }}
                >
                  Design Sample · Redesign Preview
                </div>
              </div>
            </div>
            <Link
              href="/admin/dashboard"
              className="rounded-md border px-3 py-1.5 text-xs transition"
              style={{
                borderColor: "#2A2F3A",
                color: "#8B93A3"
              }}
            >
              ← Back to current admin
            </Link>
          </div>
        </div>

        <DesignSampleClient />
      </div>
    </>
  );
}
