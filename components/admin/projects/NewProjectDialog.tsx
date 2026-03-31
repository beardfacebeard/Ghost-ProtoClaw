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

type NewProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreated
}: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  useEffect(() => {
    if (!open) return;

    fetch("/api/admin/businesses", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setBusinesses(d.businesses ?? []))
      .catch(() => {});
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !businessId) {
      toast.error("Name and business are required.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetchWithCsrf("/api/admin/projects", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          name: name.trim(),
          description: description.trim() || undefined,
          targetDate: targetDate
            ? new Date(targetDate).toISOString()
            : undefined
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message ?? "Failed to create project.");
      }

      toast.success("Project created.");
      setName("");
      setDescription("");
      setTargetDate("");
      onCreated();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create project."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm text-slate-300">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="border-ghost-border bg-ghost-raised text-white placeholder:text-zinc-500"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-300">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              className="min-h-[80px] border-ghost-border bg-ghost-raised text-white placeholder:text-zinc-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm text-slate-300">Business</Label>
              <Select value={businessId} onValueChange={setBusinessId}>
                <SelectTrigger className="border-ghost-border bg-ghost-raised text-white">
                  <SelectValue placeholder="Select" />
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
              <Label className="text-sm text-slate-300">Target Date</Label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="border-ghost-border bg-ghost-raised text-white"
              />
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
              disabled={saving || !name.trim() || !businessId}
              className="bg-brand-primary text-white hover:bg-brand-primary/90"
            >
              {saving ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
