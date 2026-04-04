export function getDisplayName(
  email: string,
  displayName?: string | null
): string {
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim();
  }

  const localPart = email.split("@")[0] ?? "Admin";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "GP";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

export function formatRouteTitle(pathname: string) {
  if (/^\/admin\/businesses\/[^/]+\/edit$/.test(pathname)) {
    return "Edit Business";
  }

  if (/^\/admin\/businesses\/[^/]+$/.test(pathname)) {
    return "Business Details";
  }

  const titleMap: Array<{ prefix: string; title: string }> = [
    { prefix: "/admin/inbox", title: "Inbox" },
    { prefix: "/admin/docs", title: "Docs" },
    { prefix: "/admin/businesses/create", title: "Create Business" },
    { prefix: "/admin/businesses", title: "Businesses" },
    { prefix: "/admin/agents/org-chart", title: "Org Chart" },
    { prefix: "/admin/agents/create", title: "Create Agent" },
    { prefix: "/admin/agents", title: "Agents" },
    { prefix: "/admin/costs", title: "Usage & Costs" },
    { prefix: "/admin/workflows/create", title: "Create Workflow" },
    { prefix: "/admin/workflows", title: "Workflows" },
    { prefix: "/admin/issues", title: "Issues" },
    { prefix: "/admin/projects", title: "Projects" },
    { prefix: "/admin/integrations", title: "Integrations" },
    { prefix: "/admin/mcp", title: "MCP Servers" },
    { prefix: "/admin/knowledge", title: "Knowledge" },
    { prefix: "/admin/workspace", title: "Workspace Files" },
    { prefix: "/admin/memory", title: "Memory" },
    { prefix: "/admin/activity", title: "Activity" },
    { prefix: "/admin/logs", title: "Logs" },
    { prefix: "/admin/approvals", title: "Approvals" },
    { prefix: "/admin/backups", title: "Backups" },
    { prefix: "/admin/settings", title: "Settings" },
    { prefix: "/admin/health", title: "System Health" },
    { prefix: "/admin/welcome", title: "Welcome" },
    { prefix: "/admin", title: "Dashboard" }
  ];

  const match = titleMap.find(({ prefix }) => pathname.startsWith(prefix));
  return match?.title ?? "Dashboard";
}

export function formatSlugTitle(slug: string[]) {
  const pathname = `/admin/${slug.join("/")}`;
  const mappedTitle = formatRouteTitle(pathname);

  if (mappedTitle !== "Dashboard") {
    return mappedTitle;
  }

  return (slug[slug.length - 1] ?? "Dashboard")
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
