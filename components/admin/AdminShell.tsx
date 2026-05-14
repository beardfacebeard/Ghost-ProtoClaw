"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CommandPalette } from "@/components/admin/CommandPalette";
import {
  KillSwitchBanner,
  KillSwitchProvider
} from "@/components/admin/KillSwitch";
import { MobileNav } from "@/components/admin/MobileNav";
import { Sidebar } from "@/components/admin/Sidebar";
import { TopBar } from "@/components/admin/TopBar";
import type { AdminSession } from "@/components/admin/types";
import { AdminProvider } from "@/contexts/AdminContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  session: AdminSession;
  children: React.ReactNode;
};

const COMPACT_STORAGE_KEY = "ghost-sidebar-compact";

export function AdminShell({ session, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const router = useRouter();

  // Load persisted compact preference on mount. Render the sidebar in
  // expanded mode during SSR / first paint to avoid a width jump on load.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(COMPACT_STORAGE_KEY);
      if (stored === "1") setCompact(true);
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, []);

  function toggleCompact() {
    setCompact((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COMPACT_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <AdminProvider session={session} refresh={() => router.refresh()}>
      <KillSwitchProvider>
        <div className="flex h-screen overflow-hidden bg-bg-app text-ink-primary">
          <aside
            className={cn(
              "hidden h-screen shrink-0 border-r border-line-subtle transition-[width] duration-200 ease-out lg:block",
              compact ? "w-[56px]" : "w-[240px]"
            )}
          >
            <Sidebar
              session={session}
              compact={compact}
              onToggleCompact={toggleCompact}
            />
          </aside>

          <div className="flex min-w-0 flex-1 flex-col bg-bg-app">
            <TopBar
              session={session}
              onMenuClick={() => setSidebarOpen(true)}
            />
            <KillSwitchBanner session={session} />
            <div className="min-h-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
              <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
                {children}
              </div>
            </div>
          </div>

          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent
              side="left"
              className="w-[260px] max-w-[260px] border-r border-line-subtle bg-bg-app p-0 sm:max-w-[260px]"
            >
              <Sidebar session={session} onClose={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>

          <MobileNav onMoreClick={() => setSidebarOpen(true)} />
          <CommandPalette />
        </div>
      </KillSwitchProvider>
    </AdminProvider>
  );
}
