"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type Business = { id: string; name: string };
type Agent = { id: string; displayName: string; emoji: string | null };
type Project = { id: string; name: string };

type NewIssueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  defaultBusinessId?: string;
  defaultProjectId?: string;
};

export function NewIssueDialog({
  open,
  onOpenChange,
  onCreated,
  defaultBusinessId,
  defaultProjectId
}: NewIssueDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [businessId, setBusinessId] = useState(defaultBusinessId ?? "");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [assigneeAgentId, setAssigneeAgentId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!open) return;

    fetch("/api/admin/businesses", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setBusinesses(d.businesses ?? []))
      .catch(() => {});

    fetch("/api/admin/agents", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => {});

    fetch("/api/admin/projects", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim() || !businessId) {
      toast.error("Title and business are required.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetchWithCsrf("/api/admin/issues", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          projectId: projectId || null,
          assigneeAgentId: assigneeAgentId || null,
          title: title.trim(),
          description: description.trim() || null,
          priority
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message ?? "Failed to create issue.");
      }

      toast.success("Issue created.");
      setTitle("");
      setDescription("");
      setAssigneeAgentId("");
      setPriority("medium");
      onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create issue."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Issue</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm text-ink-primary">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="border-line-subtle bg-bg-surface-2 text-white placeholder:text-ink-muted"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-ink-primary">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more detail..."
              className="min-h-[80px] border-line-subtle bg-bg-surface-2 text-white placeholder:text-ink-muted"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm text-ink-primary">Business</Label>
              <Select value={businessId} onValueChange={setBusinessId}>
                <SelectTrigger className="border-line-subtle bg-bg-surface-2 text-white">
                  <SelectValue placeholder="Select business" />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-ink-primary">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="border-line-subtle bg-bg-surface-2 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm text-ink-primary">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="border-line-subtle bg-bg-surface-2 text-white">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-ink-primary">Assign to Agent</Label>
              <Select
                value={assigneeAgentId}
                onValueChange={setAssigneeAgentId}
              >
                <SelectTrigger className="border-line-subtle bg-bg-surface-2 text-white">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.emoji ?? "🤖"} {a.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !title.trim() || !businessId}
              className="bg-steel text-white hover:bg-steel/90"
            >
              {saving ? "Creating..." : "Create Issue"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
