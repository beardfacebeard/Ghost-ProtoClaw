"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, LogOut, type LucideIcon } from "lucide-react";

import {
  adminNavFooterItems,
  adminNavSections,
  type AdminNavSection
} from "@/components/admin/navigation";
import { Logo } from "@/components/admin/Logo";
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

  // Collapsible state for any section marked collapsible: true. Keyed
  // by section.label so multiple collapsibles work independently.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const section of adminNavSections) {
        if (section.collapsible && section.label) {
          initial[section.label] = section.defaultOpen ?? false;
        }
      }
      return initial;
    }
  );

  async function handleSignOut() {
    await fetchWithCsrf("/api/auth/logout", {
      method: "POST"
    });
    router.push("/login");
    router.refresh();
    onClose?.();
  }

  function isActive(href: string): boolean {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

  return (
    <div className="flex h-full flex-col bg-bg-app text-ink-primary">
      {/* ── Logo ───────────────────────────────────────────────────── */}
      <div className="border-b border-line-subtle px-5 py-4">
        <Link
          href="/admin"
          onClick={onClose}
          className="flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <Logo className="h-8 w-8 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[12px] font-semibold tracking-[0.14em] text-ink-primary">
              GHOST PROTOCLAW
            </div>
          </div>
        </Link>
      </div>

      {/* ── Sections ───────────────────────────────────────────────── */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {adminNavSections.map((section, idx) => (
          <SectionBlock
            key={section.label ?? `section-${idx}`}
            section={section}
            isFirst={idx === 0}
            isActive={isActive}
            pendingCount={session.pendingApprovalsCount ?? 0}
            open={
              section.collapsible && section.label
                ? openSections[section.label]
                : true
            }
            onToggle={() => {
              if (!section.collapsible || !section.label) return;
              setOpenSections((prev) => ({
                ...prev,
                [section.label as string]: !prev[section.label as string]
              }));
            }}
            onItemClick={onClose}
          />
        ))}

        {/* ── Footer items (Settings, Help) below a thin divider ────── */}
        <div className="mt-4 border-t border-line-subtle pt-4">
          <div className="space-y-0.5">
            {adminNavFooterItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={isActive(item.href)}
                onClick={onClose}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* ── User pill ──────────────────────────────────────────────── */}
      <div className="border-t border-line-subtle px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-2 transition hover:bg-bg-surface-2">
          <Avatar className="h-7 w-7 border border-line bg-bg-surface-2">
            <AvatarFallback className="text-[11px] font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-ink-primary">
              {displayName}
            </div>
            <div className="truncate text-[10.5px] text-ink-muted">
              {session.email}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="h-7 w-7 p-0 text-ink-muted hover:text-ink-primary"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Section block ─────────────────────────────────────────────────────

type SectionBlockProps = {
  section: AdminNavSection;
  isFirst: boolean;
  isActive: (href: string) => boolean;
  pendingCount: number;
  open: boolean | undefined;
  onToggle: () => void;
  onItemClick?: () => void;
};

function SectionBlock({
  section,
  isFirst,
  isActive,
  pendingCount,
  open,
  onToggle,
  onItemClick
}: SectionBlockProps) {
  // First section ("Today") renders without a label header — it's the
  // primary landing group and labels there would feel like clutter.
  if (!section.label) {
    return (
      <div className={cn("space-y-0.5", isFirst ? "pt-2" : "pt-4")}>
        {section.items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isActive(item.href)}
            onClick={onItemClick}
          />
        ))}
      </div>
    );
  }

  const spacing = isFirst ? "pt-2" : "pt-5";

  if (section.collapsible) {
    return (
      <div className={spacing}>
        <button
          type="button"
          onClick={onToggle}
          className="group flex w-full items-center justify-between px-3 pb-1 pt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-muted transition hover:text-ink-secondary"
        >
          <span>{section.label}</span>
          <ChevronRight
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              open ? "rotate-90" : ""
            )}
          />
        </button>
        {open ? (
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={isActive(item.href)}
                pendingBadge={
                  item.href === "/admin/approvals" && pendingCount > 0
                    ? pendingCount
                    : undefined
                }
                onClick={onItemClick}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={spacing}>
      <div className="px-3 pb-1 pt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-muted">
        {section.label}
      </div>
      <div className="space-y-0.5">
        {section.items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isActive(item.href)}
            pendingBadge={
              item.href === "/admin/approvals" && pendingCount > 0
                ? pendingCount
                : undefined
            }
            onClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
}

// ── Individual nav link ───────────────────────────────────────────────

type NavLinkProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  pendingBadge?: number;
  onClick?: () => void;
};

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  pendingBadge,
  onClick
}: NavLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] transition-all duration-150",
        active
          ? "bg-bg-surface-3 text-ink-primary"
          : "text-ink-secondary hover:bg-bg-surface-2 hover:text-ink-primary"
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-steel"
        />
      ) : null}
      <Icon
        className={cn(
          "h-4 w-4 flex-shrink-0 transition-colors",
          active
            ? "text-steel-bright"
            : "text-ink-muted group-hover:text-ink-secondary"
        )}
        strokeWidth={1.5}
      />
      <span className="min-w-0 truncate">{label}</span>
      {pendingBadge !== undefined ? (
        <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded bg-state-warning/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-state-warning">
          {pendingBadge}
        </span>
      ) : null}
    </Link>
  );
}
