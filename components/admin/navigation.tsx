import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  BookOpen,
  Bot,
  Brain,
  Building2,
  CheckSquare,
  FileText,
  FolderOpen,
  GitBranch,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Plug,
  Server
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
      { label: "Businesses", href: "/admin/businesses", icon: Building2 },
      { label: "Agents", href: "/admin/agents", icon: Bot },
      { label: "Workflows", href: "/admin/workflows", icon: GitBranch },
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
      { label: "Activity", href: "/admin/activity", icon: Activity },
      { label: "Logs", href: "/admin/logs", icon: FileText },
      { label: "Approvals", href: "/admin/approvals", icon: CheckSquare },
      { label: "Backups", href: "/admin/backups", icon: Archive },
      { label: "Health", href: "/admin/health", icon: HeartPulse }
    ]
  },
];

export const mobileNavItems: Array<AdminNavItem | { label: string; icon: LucideIcon }> = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Businesses", href: "/admin/businesses", icon: Building2 },
  { label: "Agents", href: "/admin/agents", icon: Bot },
  { label: "Workflows", href: "/admin/workflows", icon: GitBranch },
  { label: "More", icon: Menu }
];
