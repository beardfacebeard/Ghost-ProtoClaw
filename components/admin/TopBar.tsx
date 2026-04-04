"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search } from "lucide-react";

import type { AdminSession } from "@/components/admin/types";
import { getDisplayName, getInitials, formatRouteTitle } from "@/components/admin/utils";
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

  async function handleSignOut() {
    await fetchWithCsrf("/api/auth/logout", {
      method: "POST"
    });

    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ghost-border bg-ghost-base/95 px-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-base font-semibold text-white md:text-lg">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="hidden gap-2 text-zinc-500 hover:text-white sm:flex"
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true })
            );
          }}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-xs">Search</span>
          <kbd className="pointer-events-none hidden rounded-sm border border-ghost-border bg-ghost-raised px-1 font-mono text-[10px] text-zinc-600 md:inline">
            {typeof navigator !== "undefined" &&
            /Mac/.test(navigator.userAgent)
              ? "\u2318K"
              : "Ctrl+K"}
          </kbd>
        </Button>

        <Link href="/admin/inbox">
          <Button
            variant="ghost"
            size="icon"
            className="relative text-slate-400 hover:text-white"
            aria-label="Inbox"
          >
            <Bell className="h-4 w-4" />
            {(session.pendingApprovalsCount ?? 0) > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {session.pendingApprovalsCount}
              </span>
            ) : null}
          </Button>
        </Link>

        <Badge variant="admin" className="hidden sm:inline-flex">
          {session.role === "super_admin" ? "Super Admin" : "Admin"}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded border border-ghost-border bg-ghost-surface p-1 transition-colors hover:border-ghost-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
              <Avatar className="h-8 w-8 bg-ghost-raised">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-2">
              <div className="text-sm font-medium text-white">{displayName}</div>
              <div className="truncate text-xs text-slate-500">{session.email}</div>
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
