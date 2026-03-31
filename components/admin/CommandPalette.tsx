"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Activity,
  Archive,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  Building2,
  CheckSquare,
  CircleDot,
  FileText,
  FolderKanban,
  FolderOpen,
  GitBranch,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  Network,
  Plug,
  Plus,
  Search,
  Server,
  Settings,
  Sparkles,
  Target
} from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

type SearchResult = {
  id: string;
  label: string;
  href: string;
  type: "business" | "agent" | "workflow";
  detail?: string;
};

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Inbox", href: "/admin/inbox", icon: Inbox },
  { label: "Businesses", href: "/admin/businesses", icon: Building2 },
  { label: "Agents", href: "/admin/agents", icon: Bot },
  { label: "Org Chart", href: "/admin/agents/org-chart", icon: Network },
  { label: "Workflows", href: "/admin/workflows", icon: GitBranch },
  { label: "Issues", href: "/admin/issues", icon: CircleDot },
  { label: "Projects", href: "/admin/projects", icon: FolderKanban },
  { label: "Goals", href: "/admin/goals", icon: Target },
  { label: "Skills", href: "/admin/skills", icon: Sparkles },
  { label: "Integrations", href: "/admin/integrations", icon: Plug },
  { label: "MCP Servers", href: "/admin/mcp", icon: Server },
  { label: "Knowledge", href: "/admin/knowledge", icon: BookOpen },
  { label: "Workspace Files", href: "/admin/workspace", icon: FolderOpen },
  { label: "Memory", href: "/admin/memory", icon: Brain },
  { label: "Usage & Costs", href: "/admin/costs", icon: BarChart3 },
  { label: "Activity", href: "/admin/activity", icon: Activity },
  { label: "Logs", href: "/admin/logs", icon: FileText },
  { label: "Approvals", href: "/admin/approvals", icon: CheckSquare },
  { label: "Backups", href: "/admin/backups", icon: Archive },
  { label: "Health", href: "/admin/health", icon: HeartPulse },
  { label: "Settings", href: "/admin/settings", icon: Settings }
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
  const router = useRouter();

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
      // silently fail — search is non-critical
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
      <DialogContent className="max-w-[540px] gap-0 overflow-hidden p-0">
        <Command
          className="bg-transparent"
          shouldFilter={false}
          loop
        >
          <div className="flex items-center gap-2 border-b border-ghost-border px-4">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <Command.Input
              value={query}
              onValueChange={search}
              placeholder="Search or jump to..."
              className="flex h-12 w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-ghost-border bg-ghost-raised px-1.5 font-mono text-[10px] font-medium text-zinc-500 sm:inline-flex">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[360px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-zinc-500">
              {loading ? "Searching..." : "No results found."}
            </Command.Empty>

            {results.length > 0 ? (
              <Command.Group
                heading="Search Results"
                className="px-1 pb-2 text-xs font-medium uppercase tracking-wider text-zinc-600"
              >
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
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 aria-selected:bg-ghost-raised aria-selected:text-white"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{result.label}</div>
                        {result.detail ? (
                          <div className="truncate text-xs text-zinc-600">
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
                <Command.Group
                  heading="Quick Actions"
                  className="px-1 pb-2 text-xs font-medium uppercase tracking-wider text-zinc-600"
                >
                  {QUICK_ACTIONS.map((action) => (
                    <Command.Item
                      key={action.href}
                      value={action.label}
                      onSelect={() => navigate(action.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 aria-selected:bg-ghost-raised aria-selected:text-white"
                    >
                      <action.icon className="h-4 w-4 shrink-0 text-brand-primary" />
                      <span>{action.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group
                  heading="Navigation"
                  className="px-1 pb-2 text-xs font-medium uppercase tracking-wider text-zinc-600"
                >
                  {NAV_ITEMS.map((item) => (
                    <Command.Item
                      key={item.href}
                      value={item.label}
                      onSelect={() => navigate(item.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 aria-selected:bg-ghost-raised aria-selected:text-white"
                    >
                      <item.icon className="h-4 w-4 shrink-0 text-zinc-500" />
                      <span>{item.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              </>
            ) : null}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
