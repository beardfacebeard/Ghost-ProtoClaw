"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  FolderOpen,
  Plus
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { NewProjectDialog } from "@/components/admin/projects/NewProjectDialog";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  targetDate: string | null;
  createdAt: string;
  _count: { issues: number };
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-state-success/15 text-state-success" },
  completed: {
    label: "Completed",
    cls: "bg-steel/15 text-steel-bright"
  },
  archived: { label: "Archived", cls: "bg-bg-surface-2 text-ink-secondary" }
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/projects", {
        credentials: "same-origin"
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Projects
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Group related work and track progress.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-steel text-white hover:bg-steel/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {loading ? (
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-steel border-t-transparent" />
          </CardContent>
        </Card>
      ) : projects.length === 0 ? (
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
            <FolderOpen className="h-10 w-10 text-ink-muted" />
            <div className="text-center">
              <p className="text-sm font-medium text-ink-secondary">
                No projects yet
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Create a project to organize related issues.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const statusMeta =
              STATUS_META[project.status] ?? STATUS_META.active;

            return (
              <button
                key={project.id}
                onClick={() =>
                  router.push(`/admin/issues?projectId=${project.id}`)
                }
                className="group rounded-2xl border border-line-subtle bg-bg-surface p-5 text-left transition-all hover:-translate-y-[1px] hover:border-line"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-white">
                    {project.name}
                  </h3>
                  <Badge className={cn("shrink-0 text-[10px]", statusMeta.cls)}>
                    {statusMeta.label}
                  </Badge>
                </div>

                {project.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-ink-muted">
                    {project.description}
                  </p>
                ) : null}

                <div className="mt-4 flex items-center gap-4 text-xs text-ink-muted">
                  <span>{project._count.issues} issues</span>
                  {project.targetDate ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(project.targetDate).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" }
                      )}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <NewProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          fetchProjects();
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
