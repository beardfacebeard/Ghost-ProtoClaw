import type { LucideIcon } from "lucide-react";
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
  CloudUpload,
  Film,
  FileText,
  FolderKanban,
  FolderOpen,
  GitBranch,
  Ghost,
  HeartPulse,
  Image as ImageIcon,
  Inbox,
  LifeBuoy,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessageSquare,
  Network,
  Plug,
  Radar,
  Server,
  Settings,
  Sparkles,
  Sun,
  Target
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
};

export type AdminNavSection = {
  /** Section label rendered above the items. `null` = no header (used
   *  for the primary "Today" section at the top of the sidebar). */
  label: string | null;
  items: AdminNavItem[];
  /** When true, the section renders with a chevron-toggle header and
   *  collapses its items until clicked. Default false.
   *  Used by the System section (admin-level plumbing the user rarely
   *  visits unless something is wrong). */
  collapsible?: boolean;
  /** When collapsible is true, this controls whether the section starts
   *  expanded. Default false. */
  defaultOpen?: boolean;
};

/**
 * Admin sidebar IA — the 2026 redesign.
 *
 * Six primary sections (Today / Work / Team / Automate / Library /
 * Connect) + one collapsed System drawer + a footer pair (Settings,
 * Help). Down from 28 flat items in 5 sections to 6 clean sections
 * users actually reach for daily.
 *
 * Pulse was removed from the nav (user specifically asked to kill the
 * "neural" feed) but its /admin/pulse route still exists, so any bookmarks
 * keep working. It'll get folded into Today in a future pass.
 */
export const adminNavSections: AdminNavSection[] = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Today", href: "/admin/today", icon: Sun }
    ]
  },
  {
    label: "Work",
    items: [
      { label: "Chat", href: "/admin/chat", icon: MessageSquare },
      { label: "Inbox", href: "/admin/inbox", icon: Inbox },
      { label: "Approvals", href: "/admin/approvals", icon: CheckSquare },
      { label: "Todos & Ideas", href: "/admin/todos", icon: ListChecks },
      { label: "Master Agent", href: "/admin/master-agent", icon: Radar }
    ]
  },
  {
    label: "Team",
    items: [
      { label: "Agents", href: "/admin/agents", icon: Bot },
      { label: "Org Chart", href: "/admin/agents/org-chart", icon: Network },
      { label: "Skills", href: "/admin/skills", icon: Sparkles },
      { label: "Businesses", href: "/admin/businesses", icon: Building2 }
    ]
  },
  {
    label: "Automate",
    items: [
      { label: "Workflows", href: "/admin/workflows", icon: GitBranch },
      { label: "Projects", href: "/admin/projects", icon: FolderKanban },
      { label: "Issues", href: "/admin/issues", icon: CircleDot },
      { label: "Goals", href: "/admin/goals", icon: Target },
      { label: "Outreach Targets", href: "/admin/targets", icon: Ghost },
      { label: "Video Clips", href: "/admin/clips", icon: Film }
    ]
  },
  {
    label: "Library",
    items: [
      { label: "Knowledge", href: "/admin/knowledge", icon: BookOpen },
      { label: "Brand Assets", href: "/admin/brand-assets", icon: ImageIcon },
      {
        label: "Workspace Files",
        href: "/admin/workspace",
        icon: FolderOpen
      },
      { label: "Uploads", href: "/admin/uploads", icon: CloudUpload },
      { label: "Memory", href: "/admin/memory", icon: Brain }
    ]
  },
  {
    label: "Connect",
    items: [
      { label: "Integrations", href: "/admin/integrations", icon: Plug },
      { label: "MCP Servers", href: "/admin/mcp", icon: Server }
    ]
  },
  {
    label: "System",
    collapsible: true,
    defaultOpen: false,
    items: [
      { label: "Usage & Costs", href: "/admin/costs", icon: BarChart3 },
      { label: "Activity", href: "/admin/activity", icon: Activity },
      { label: "Logs", href: "/admin/logs", icon: FileText },
      { label: "Backups", href: "/admin/backups", icon: Archive },
      { label: "Health", href: "/admin/health", icon: HeartPulse }
    ]
  }
];

/** Items rendered below the System drawer, above the user pill. Small
 *  housekeeping links that don't belong in a grouped section. */
export const adminNavFooterItems: AdminNavItem[] = [
  { label: "Settings", href: "/admin/settings", icon: Settings },
  { label: "Help", href: "/admin/help", icon: LifeBuoy }
];

export const mobileNavItems: Array<
  AdminNavItem | { label: string; icon: LucideIcon }
> = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Chat", href: "/admin/chat", icon: MessageSquare },
  { label: "Agents", href: "/admin/agents", icon: Bot },
  { label: "Workflows", href: "/admin/workflows", icon: GitBranch },
  { label: "More", icon: Menu }
];
