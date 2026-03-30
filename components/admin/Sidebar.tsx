"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { PlanBadge } from "@/components/admin/PlanBadge";
import { adminNavSections } from "@/components/admin/navigation";
import type { AdminSession } from "@/components/admin/types";
import { getDisplayName, getInitials } from "@/components/admin/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { cn } from "@/lib/utils";

type SidebarProps = {
  session: AdminSession;
  onClose?: () => void;
};

export function Sidebar({ session, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const displayName = getDisplayName(session.email, session.displayName);
  const initials = getInitials(displayName);

  async function handleSignOut() {
    await fetchWithCsrf("/api/auth/logout", {
      method: "POST"
    });

    router.push("/login");
    router.refresh();
    onClose?.();
  }

  return (
    <div className="flex h-full flex-col bg-[#111111] text-white">
      <div className="border-b border-ghost-border px-5 py-4">
        <Link
          href="/admin"
          onClick={onClose}
          className="flex items-center gap-3 rounded-xl transition-opacity hover:opacity-90"
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-primary/30 bg-brand-primary/10 shadow-brand-sm">
            <div className="absolute inset-2 rounded-xl bg-brand-primary/20 blur-md" />
            <span className="relative text-sm font-bold tracking-[0.2em] text-white">
              GP
            </span>
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold tracking-[0.22em] text-white">
              GHOST PROTOCLAW
            </div>
            <div className="mt-2">
              <PlanBadge planTier={session.planTier} />
            </div>
          </div>
        </Link>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {adminNavSections.map((section) => {
          const items = section.items.filter(
            (item) => !item.superAdminOnly || session.role === "super_admin"
          );

          if (items.length === 0) {
            return null;
          }

          return (
            <div key={section.label} className="pt-4">
              <div className="px-3 pb-1 text-xs uppercase tracking-[0.22em] text-[#555555]">
                {section.label}
              </div>
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ease-out",
                        active
                          ? "bg-ghost-nav-active text-brand-primary"
                          : "text-slate-400 hover:bg-ghost-surface hover:text-white"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          active ? "text-brand-primary" : "text-slate-400"
                        )}
                      />
                      <span>{item.label}</span>
                      {item.href === "/admin/approvals" &&
                      (session.pendingApprovalsCount ?? 0) > 0 ? (
                        <span className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full bg-brand-amber px-2 py-0.5 text-[11px] font-semibold text-ghost-black">
                          {session.pendingApprovalsCount}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-ghost-border px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl bg-ghost-surface px-3 py-3">
          <Avatar className="h-9 w-9 border border-ghost-border bg-ghost-raised">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">
              {displayName}
            </div>
            <div className="truncate text-xs text-slate-500">{session.email}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="h-8 px-2 text-slate-400 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
