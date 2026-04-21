"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Bot,
  Building2,
  GitBranch,
  Plus,
  Search
} from "lucide-react";

import {
  adminNavFooterItems,
  adminNavSections,
  type AdminNavItem
} from "@/components/admin/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type SearchResult = {
  id: string;
  label: string;
  href: string;
  type: "business" | "agent" | "workflow";
  detail?: string;
};

/**
 * Flat list of every nav item across every section + the footer items.
 * Derived from the same IA config the sidebar uses so ⌘K always stays in
 * sync when we add/remove pages. Order here is what the user sees in the
 * "Navigation" group when the palette opens with no query.
 */
const NAV_ITEMS: AdminNavItem[] = [
  ...adminNavSections.flatMap((section) => section.items),
  ...adminNavFooterItems
];

const QUICK_ACTIONS = [
  { label: "Create Business", href: "/admin/businesses/create", icon: Plus },
  { label: "Create Agent", href: "/admin/agents/create", icon: Plus },
  { label: "Create Workflow", href: "/admin/workflows/create", icon: Plus }
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [shortcut, setShortcut] = useState<string>("\u2318 K");
  const router = useRouter();

  // Platform-aware shortcut hint. Rendered client-side only to avoid
  // SSR mismatch. Mac → ⌘K. Windows/Linux → Ctrl+K.
  useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || "");
    setShortcut(isMac ? "\u2318 K" : "Ctrl+K");
  }, []);

  // Global keyboard shortcut — ⌘K on Mac, Ctrl+K on Windows/Linux.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const search = useCallback(async (value: string) => {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/search?q=${encodeURIComponent(value)}`,
        { credentials: "same-origin" }
      );
      if (response.ok) {
        const data = (await response.json()) as { results: SearchResult[] };
        setResults(data.results);
      }
    } catch {
      // Silent — search is non-critical.
    } finally {
      setLoading(false);
    }
  }, []);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[560px] gap-0 overflow-hidden border-line bg-bg-surface/95 p-0 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_80px_rgba(91,127,176,0.15)] backdrop-blur-xl">
        <Command className="bg-transparent" shouldFilter={false} loop>
          {/* ── Search input ──────────────────────────────────────── */}
          <div className="flex items-center gap-2.5 border-b border-line-subtle px-4">
            <Search
              className="h-4 w-4 shrink-0 text-ink-muted"
              strokeWidth={1.5}
            />
            <Command.Input
              value={query}
              onValueChange={search}
              placeholder="Search pages, actions, businesses…"
              className="flex h-12 w-full bg-transparent font-sans text-[14px] text-ink-primary outline-none placeholder:text-ink-muted"
            />
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-line bg-bg-surface-2 px-1.5 font-mono text-[10px] font-medium text-ink-secondary sm:inline-flex">
              ESC
            </kbd>
          </div>

          {/* ── Results list ──────────────────────────────────────── */}
          <Command.List className="max-h-[400px] overflow-y-auto px-2 py-2">
            <Command.Empty className="py-8 text-center text-[13px] text-ink-muted">
              {loading ? "Searching…" : "No results found."}
            </Command.Empty>

            {results.length > 0 ? (
              <Command.Group>
                <GroupHeading label="Search Results" />
                {results.map((result) => {
                  const Icon =
                    result.type === "business"
                      ? Building2
                      : result.type === "agent"
                        ? Bot
                        : GitBranch;
                  return (
                    <Command.Item
                      key={result.id}
                      value={result.id}
                      onSelect={() => navigate(result.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[13px] text-ink-secondary transition aria-selected:bg-steel/10 aria-selected:text-ink-primary"
                    >
                      <Icon
                        className="h-4 w-4 shrink-0 text-ink-muted"
                        strokeWidth={1.5}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{result.label}</div>
                        {result.detail ? (
                          <div className="truncate text-[11px] text-ink-muted">
                            {result.detail}
                          </div>
                        ) : null}
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ) : null}

            {!query ? (
              <>
                <Command.Group>
                  <GroupHeading label="Quick Actions" />
                  {QUICK_ACTIONS.map((action) => (
                    <Command.Item
                      key={action.href}
                      value={action.label}
                      onSelect={() => navigate(action.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[13px] text-ink-secondary transition aria-selected:bg-steel/10 aria-selected:text-ink-primary"
                    >
                      <action.icon
                        className="h-4 w-4 shrink-0 text-steel"
                        strokeWidth={1.5}
                      />
                      <span>{action.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group>
                  <GroupHeading label="Navigation" />
                  {NAV_ITEMS.map((item) => (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      onSelect={() => navigate(item.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[13px] text-ink-secondary transition aria-selected:bg-steel/10 aria-selected:text-ink-primary"
                    >
                      <item.icon
                        className="h-4 w-4 shrink-0 text-ink-muted"
                        strokeWidth={1.5}
                      />
                      <span>{item.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            ) : null}
          </Command.List>

          {/* ── Footer ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-t border-line-subtle px-4 py-2 text-[10px] text-ink-muted">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <KbdHint>↑</KbdHint>
                <KbdHint>↓</KbdHint> Navigate
              </span>
              <span className="flex items-center gap-1">
                <KbdHint>↵</KbdHint> Select
              </span>
              <span className="flex items-center gap-1">
                <KbdHint>esc</KbdHint> Close
              </span>
            </div>
            <span>
              Press <KbdHint>{shortcut}</KbdHint> anywhere
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function GroupHeading({ label }: { label: string }) {
  return (
    <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
      {label}
    </div>
  );
}

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none select-none rounded border border-line bg-bg-surface-2 px-1 py-px font-mono text-[10px] text-ink-secondary">
      {children}
    </kbd>
  );
}
