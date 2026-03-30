const workspaceCategories = {
  core: "Core Documents",
  knowledge: "Knowledge Files",
  memory: "Memory Files",
  timeline: "Timeline & History",
  templates: "Templates",
  other: "Other"
} as const;

export const WORKSPACE_CATEGORIES = workspaceCategories;

export type WorkspaceCategoryKey = keyof typeof WORKSPACE_CATEGORIES;

export const MEMORY_TIERS = {
  hot: "Hot - actively used, loaded every session",
  warm: "Warm - available, loaded on request",
  cold: "Cold - archived, not loaded automatically"
} as const;

export type MemoryTierKey = keyof typeof MEMORY_TIERS;

export const WORKSPACE_CATEGORY_OPTIONS: Array<{
  value: WorkspaceCategoryKey;
  label: string;
}> = Object.entries(WORKSPACE_CATEGORIES).map(([value, label]) => ({
  value: value as WorkspaceCategoryKey,
  label
}));

export const MEMORY_TIER_OPTIONS: Array<{
  value: MemoryTierKey;
  label: string;
  description: string;
}> = [
  {
    value: "hot",
    label: "Hot",
    description: MEMORY_TIERS.hot
  },
  {
    value: "warm",
    label: "Warm",
    description: MEMORY_TIERS.warm
  },
  {
    value: "cold",
    label: "Cold",
    description: MEMORY_TIERS.cold
  }
];

export function formatWorkspaceCategory(category: string) {
  return (
    WORKSPACE_CATEGORIES[category as WorkspaceCategoryKey] ??
    category
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function formatMemoryTier(tier: string) {
  return (
    MEMORY_TIER_OPTIONS.find((option) => option.value === tier)?.label ??
    tier.replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function normalizeWorkspaceFilePath(filePath: string) {
  return filePath.trim().replaceAll("\\", "/");
}

export function validateWorkspaceFilePath(filePath: string) {
  const normalized = normalizeWorkspaceFilePath(filePath);

  if (!normalized) {
    return {
      valid: false,
      normalized,
      error: "File path is required."
    } as const;
  }

  if (
    normalized.startsWith("/") ||
    normalized.startsWith("\\") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.startsWith("//")
  ) {
    return {
      valid: false,
      normalized,
      error: "Use a relative workspace path without a leading slash."
    } as const;
  }

  const segments = normalized.split("/");
  if (
    segments.some(
      (segment) =>
        segment.length === 0 || segment === "." || segment === ".."
    )
  ) {
    return {
      valid: false,
      normalized,
      error: "File paths cannot contain empty segments, ./, or ../."
    } as const;
  }

  if (!/^[A-Za-z0-9._/-]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        "Use only letters, numbers, dashes, underscores, slashes, and periods."
    } as const;
  }

  return {
    valid: true,
    normalized
  } as const;
}

export function getWorkspaceSyncMode() {
  return process.env.WORKSPACE_SYNC_MODE === "disk" ? "disk" : "database";
}

export function estimateWorkspaceTokens(content: string) {
  const normalized = content.trim();
  if (normalized.length === 0) {
    return 0;
  }

  return Math.ceil(normalized.length / 4);
}

export function getWorkspaceExtension(filePath: string) {
  const lastSegment = normalizeWorkspaceFilePath(filePath).split("/").pop() ?? "";
  const dotIndex = lastSegment.lastIndexOf(".");

  if (dotIndex < 0) {
    return "";
  }

  return lastSegment.slice(dotIndex).toLowerCase();
}
