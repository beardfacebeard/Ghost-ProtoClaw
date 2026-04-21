"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  type LucideIcon
} from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { cn } from "@/lib/utils";

type SidebarProps = {
  session: AdminSession;
  onClose?: () => void;
  /** When true, renders the icon-only 56px rail variant. */
  compact?: boolean;
  /** Called when the user clicks the collapse/expand toggle at the
   *  bottom of the sidebar. Only rendered on desktop — mobile uses the
   *  Sheet overlay which is always expanded. */
  onToggleCompact?: () => void;
};

export function Sidebar({
  session,
  onClose,
  compact = false,
  onToggleCompact
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const displayName = getDisplayName(session.email, session.displayName);
  const initials = getInitials(displayName);

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
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col bg-bg-app text-ink-primary">
        {/* ── Logo ──────────────────────────────────────────────────── */}
        <div
          className={cn(
            "border-b border-line-subtle",
            compact ? "flex justify-center py-4" : "px-5 py-4"
          )}
        >
          <Link
            href="/admin"
            onClick={onClose}
            className="flex items-center gap-3 transition-opacity hover:opacity-90"
          >
            <Logo className="h-8 w-8 flex-shrink-0" />
            {!compact ? (
              <div className="min-w-0">
                <div className="text-[12px] font-semibold tracking-[0.14em] text-ink-primary">
                  GHOST PROTOCLAW
                </div>
              </div>
            ) : null}
          </Link>
        </div>

        {/* ── Sections ──────────────────────────────────────────────── */}
        <nav
          className={cn(
            "min-h-0 flex-1 overflow-y-auto pb-4",
            compact ? "px-2" : "px-3"
          )}
        >
          {adminNavSections.map((section, idx) => (
            <SectionBlock
              key={section.label ?? `section-${idx}`}
              section={section}
              isFirst={idx === 0}
              isActive={isActive}
              pendingCount={session.pendingApprovalsCount ?? 0}
              compact={compact}
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

          {/* ── Footer items (Settings, Help) below a thin divider ──── */}
          <div className="mt-4 border-t border-line-subtle pt-4">
            <div className="space-y-0.5">
              {adminNavFooterItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={isActive(item.href)}
                  compact={compact}
                  onClick={onClose}
                />
              ))}
            </div>
          </div>
        </nav>

        {/* ── Collapse toggle (desktop only) ───────────────────────── */}
        {onToggleCompact ? (
          <div
            className={cn(
              "border-t border-line-subtle",
              compact ? "flex justify-center py-2" : "px-3 py-2"
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCompact}
                  className={cn(
                    "flex items-center gap-2 rounded-md text-[11px] font-medium text-ink-muted transition-colors hover:bg-bg-surface-2 hover:text-ink-primary",
                    compact ? "h-8 w-8 justify-center" : "w-full px-2 py-1.5"
                  )}
                  aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {compact ? (
                    <ChevronsRight className="h-4 w-4" strokeWidth={1.5} />
                  ) : (
                    <>
                      <ChevronsLeft className="h-4 w-4" strokeWidth={1.5} />
                      <span>Collapse</span>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              {compact ? (
                <TooltipContent side="right" className="font-mono text-[11px]">
                  Expand sidebar
                </TooltipContent>
              ) : null}
            </Tooltip>
          </div>
        ) : null}

        {/* ── User pill ─────────────────────────────────────────────── */}
        <div className="border-t border-line-subtle px-3 py-3">
          {compact ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full justify-center rounded-md p-1 transition hover:bg-bg-surface-2"
                  aria-label="Sign out"
                >
                  <Avatar className="h-7 w-7 border border-line bg-bg-surface-2">
                    <AvatarFallback className="text-[11px] font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-mono text-[11px]">
                {displayName} — click to sign out
              </TooltipContent>
            </Tooltip>
          ) : (
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
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ── Section block ─────────────────────────────────────────────────────

type SectionBlockProps = {
  section: AdminNavSection;
  isFirst: boolean;
  isActive: (href: string) => boolean;
  pendingCount: number;
  open: boolean | undefined;
  compact: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
};

function SectionBlock({
  section,
  isFirst,
  isActive,
  pendingCount,
  open,
  compact,
  onToggle,
  onItemClick
}: SectionBlockProps) {
  // In compact mode, we skip headers entirely and just render the
  // icon-only items. Collapsible sections always show their items in
  // compact so nothing is hidden.
  if (compact) {
    return (
      <div className={cn("space-y-0.5", isFirst ? "pt-2" : "pt-3")}>
        {section.items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isActive(item.href)}
            compact
            pendingBadge={
              item.href === "/admin/approvals" && pendingCount > 0
                ? pendingCount
                : undefined
            }
            onClick={onItemClick}
          />
        ))}
      </div>
    );
  }

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
  compact?: boolean;
  pendingBadge?: number;
  onClick?: () => void;
};

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  compact = false,
  pendingBadge,
  onClick
}: NavLinkProps) {
  const content = (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center rounded-md transition-all duration-150",
        compact
          ? "h-9 w-9 justify-center"
          : "gap-2.5 px-3 py-1.5 text-[13px]",
        active
          ? "bg-bg-surface-3 text-ink-primary"
          : "text-ink-secondary hover:bg-bg-surface-2 hover:text-ink-primary"
      )}
      aria-label={compact ? label : undefined}
    >
      {active ? (
        <span
          aria-hidden
          className={cn(
            "absolute bg-steel",
            compact
              ? "left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full"
              : "left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full"
          )}
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
      {!compact ? (
        <>
          <span className="min-w-0 truncate">{label}</span>
          {pendingBadge !== undefined ? (
            <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded bg-state-warning/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-state-warning">
              {pendingBadge}
            </span>
          ) : null}
        </>
      ) : pendingBadge !== undefined ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[14px] items-center justify-center rounded-full bg-state-warning px-1 font-mono text-[9px] font-semibold text-bg-app">
          {pendingBadge}
        </span>
      ) : null}
    </Link>
  );

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-mono text-[11px]">
          {label}
          {pendingBadge !== undefined ? ` · ${pendingBadge} pending` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
