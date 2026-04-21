"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type ProjectRecord = {
  id: string;
  name: string;
  status: string;
  inputAdUrl?: string | null;
  aiVersion1Url?: string | null;
  aiVersion2Url?: string | null;
  aiVersion3Url?: string | null;
  aiVersion4Url?: string | null;
  aiVersion5Url?: string | null;
  chosenVersionKey?: string | null;
  editRound1Url?: string | null;
  editRound2Url?: string | null;
  finalImageUrl?: string | null;
  videoUrl?: string | null;
  resize916Url?: string | null;
  resize11Url?: string | null;
  resize43Url?: string | null;
  createdAt: string | Date;
  product?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
};

type AdCloneProjectCardProps = {
  project: ProjectRecord;
  onClick: () => void;
};

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-600 text-ink-primary" },
  in_progress: { label: "In Progress", className: "bg-blue-600 text-white" },
  editing: { label: "Editing", className: "bg-amber-600 text-white" },
  finalized: { label: "Finalized", className: "bg-green-600 text-white" },
};

function computeProgress(project: ProjectRecord): number {
  let completed = 0;
  const total = 7; // 7 required steps (video is optional)

  // Step 1: Input ad uploaded
  if (project.inputAdUrl) completed++;
  // Step 2: At least 1 AI variation
  if (
    project.aiVersion1Url ||
    project.aiVersion2Url ||
    project.aiVersion3Url ||
    project.aiVersion4Url ||
    project.aiVersion5Url
  )
    completed++;
  // Step 3: Favorite chosen
  if (project.chosenVersionKey) completed++;
  // Step 4: Edit round 1
  if (project.editRound1Url) completed++;
  // Step 5: Edit round 2
  if (project.editRound2Url) completed++;
  // Step 6: Final image
  if (project.finalImageUrl) completed++;
  // Step 7 (video) is optional, skip
  // Step 8: At least 1 resize
  if (project.resize916Url || project.resize11Url || project.resize43Url)
    completed++;

  return completed;
}

export function AdCloneProjectCard({
  project,
  onClick,
}: AdCloneProjectCardProps) {
  const status = STATUS_MAP[project.status] ?? STATUS_MAP.draft;
  const progress = computeProgress(project);
  const progressPercent = Math.round((progress / 7) * 100);
  const createdDate = new Date(project.createdAt).toLocaleDateString();

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-line-subtle bg-bg-surface p-4 text-left transition-colors hover:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
    >
      {/* Thumbnail */}
      <div className="mb-3 aspect-video w-full overflow-hidden rounded-md bg-slate-800">
        {project.inputAdUrl ? (
          <img
            src={project.inputAdUrl}
            alt="Input ad"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">
            No ad uploaded
          </div>
        )}
      </div>

      {/* Name + Status */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="truncate font-medium text-white">{project.name}</h3>
        <Badge className={status.className}>{status.label}</Badge>
      </div>

      {/* Product / Brand */}
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs text-ink-secondary">
        {project.product && <span>{project.product.name}</span>}
        {project.product && project.brand && (
          <span className="text-ink-muted">/</span>
        )}
        {project.brand && <span>{project.brand.name}</span>}
      </div>

      {/* Progress */}
      <div className="mb-1 flex items-center justify-between text-xs text-ink-secondary">
        <span>
          {progress}/7 steps
        </span>
        <span>{progressPercent}%</span>
      </div>
      <Progress value={progressPercent} className="h-1.5" />

      {/* Date */}
      <p className="mt-2 text-xs text-ink-muted">{createdDate}</p>
    </button>
  );
}
