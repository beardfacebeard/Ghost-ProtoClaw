"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { MobileNav } from "@/components/admin/MobileNav";
import { Sidebar } from "@/components/admin/Sidebar";
import { TopBar } from "@/components/admin/TopBar";
import type { AdminSession } from "@/components/admin/types";
import { AdminProvider } from "@/contexts/AdminContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";

type AdminShellProps = {
  session: AdminSession;
  children: React.ReactNode;
};

export function AdminShell({ session, children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  return (
    <AdminProvider session={session} refresh={() => router.refresh()}>
      <div className="flex h-screen overflow-hidden bg-ghost-base">
        <aside className="hidden h-screen w-[250px] shrink-0 border-r border-ghost-border lg:block">
          <Sidebar session={session} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-ghost-base">
          <TopBar session={session} onMenuClick={() => setSidebarOpen(true)} />
          <div className="min-h-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
              {children}
            </div>
          </div>
        </div>

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="w-[260px] max-w-[260px] border-r border-ghost-border bg-[#111111] p-0 sm:max-w-[260px]"
          >
            <Sidebar session={session} onClose={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        <MobileNav onMoreClick={() => setSidebarOpen(true)} />
      </div>
    </AdminProvider>
  );
}
