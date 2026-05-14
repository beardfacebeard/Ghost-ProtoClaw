"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, LogOut, Menu, Search } from "lucide-react";

import { KillSwitchTrigger } from "@/components/admin/KillSwitch";
import type { AdminSession } from "@/components/admin/types";
import {
  getDisplayName,
  getInitials,
  formatRouteTitle
} from "@/components/admin/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

type TopBarProps = {
  session: AdminSession;
  onMenuClick: () => void;
};

export function TopBar({ session, onMenuClick }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const displayName = getDisplayName(session.email, session.displayName);
  const initials = getInitials(displayName);
  const pageTitle = formatRouteTitle(pathname);

  // Platform-aware ⌘/Ctrl hint. Rendered client-side only to avoid SSR
  // mismatches — default to "⌘K" before hydration then swap to "Ctrl+K"
  // if the user's on Windows/Linux.
  const [shortcut, setShortcut] = useState<string>("\u2318 K");
  useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || "");
    setShortcut(isMac ? "\u2318 K" : "Ctrl K");
  }, []);

  async function handleSignOut() {
    await fetchWithCsrf("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function openCommandPalette() {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true })
    );
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line-subtle bg-bg-app/90 px-4 backdrop-blur-md md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="text-ink-secondary hover:bg-bg-surface-2 hover:text-ink-primary lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-[15px] font-medium text-ink-primary md:text-base">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* ── Command palette pill trigger ─────────────────────────── */}
        <button
          type="button"
          onClick={openCommandPalette}
          className="group hidden items-center gap-2 rounded-md border border-line-subtle bg-bg-surface px-3 py-1.5 text-[12px] text-ink-muted transition hover:border-line hover:bg-bg-surface-2 hover:text-ink-secondary sm:flex"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Search & jump to…</span>
          <kbd className="pointer-events-none hidden rounded border border-line bg-bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-secondary md:inline-flex">
            {shortcut}
          </kbd>
        </button>

        <KillSwitchTrigger session={session} />

        <Link href="/admin/inbox">
          <Button
            variant="ghost"
            size="icon"
            className="relative text-ink-secondary hover:bg-bg-surface-2 hover:text-ink-primary"
            aria-label="Inbox"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
            {(session.pendingApprovalsCount ?? 0) > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-state-warning px-1 font-mono text-[10px] font-bold text-bg-app">
                {session.pendingApprovalsCount}
              </span>
            ) : null}
          </Button>
        </Link>

        <Badge
          variant="admin"
          className="hidden border-steel/30 bg-steel/10 text-steel-bright sm:inline-flex"
        >
          {session.role === "super_admin" ? "Super Admin" : "Admin"}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-md border border-line-subtle bg-bg-surface p-1 transition hover:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-steel/40"
              aria-label="Open user menu"
            >
              <Avatar className="h-7 w-7 bg-bg-surface-2">
                <AvatarFallback className="text-[11px] font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-2">
              <div className="text-sm font-medium text-ink-primary">
                {displayName}
              </div>
              <div className="truncate text-xs text-ink-muted">
                {session.email}
              </div>
            </div>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
