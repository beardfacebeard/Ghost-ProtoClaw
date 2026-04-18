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
  FileText,
  FolderKanban,
  FolderOpen,
  GitBranch,
  HeartPulse,
  Inbox,
  LifeBuoy,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Network,
  Plug,
  Radar,
  Server,
  Settings,
  Sparkles,
  Target,
  Waves
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
};

export type AdminNavSection = {
  label: string;
  items: AdminNavItem[];
};

export const adminNavSections: AdminNavSection[] = [
  {
    label: "MAIN",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Master Agent", href: "/admin/master-agent", icon: Radar },
      { label: "Chat", href: "/admin/chat", icon: MessageSquare },
      { label: "Pulse", href: "/admin/pulse", icon: Waves },
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
      { label: "MCP Servers", href: "/admin/mcp", icon: Server }
    ]
  },
  {
    label: "WORKSPACE",
    items: [
      { label: "Knowledge", href: "/admin/knowledge", icon: BookOpen },
      { label: "Workspace Files", href: "/admin/workspace", icon: FolderOpen },
      { label: "Memory", href: "/admin/memory", icon: Brain }
    ]
  },
  {
    label: "OPERATIONS",
    items: [
      { label: "Usage & Costs", href: "/admin/costs", icon: BarChart3 },
      { label: "Activity", href: "/admin/activity", icon: Activity },
      { label: "Logs", href: "/admin/logs", icon: FileText },
      { label: "Approvals", href: "/admin/approvals", icon: CheckSquare },
      { label: "Backups", href: "/admin/backups", icon: Archive },
      { label: "Health", href: "/admin/health", icon: HeartPulse }
    ]
  },
  {
    label: "ACCOUNT",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Help", href: "/admin/help", icon: LifeBuoy }
    ]
  }
];

export const mobileNavItems: Array<AdminNavItem | { label: string; icon: LucideIcon }> = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Chat", href: "/admin/chat", icon: MessageSquare },
  { label: "Agents", href: "/admin/agents", icon: Bot },
  { label: "Workflows", href: "/admin/workflows", icon: GitBranch },
  { label: "More", icon: Menu }
];
