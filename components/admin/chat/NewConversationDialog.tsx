"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

type AgentOption = {
  id: string;
  displayName: string;
  emoji: string | null;
  role: string;
  businessId: string | null;
  businessName: string;
  status: string;
};

type NewConversationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: AgentOption[];
};

export function NewConversationDialog({
  open,
  onOpenChange,
  agents
}: NewConversationDialogProps) {
  const router = useRouter();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // Group agents by business
  const grouped = new Map<string, AgentOption[]>();
  for (const agent of agents) {
    if (!agent.businessId || agent.status === "disabled") continue;
    const key = agent.businessName;
    const group = grouped.get(key) ?? [];
    group.push(agent);
    grouped.set(key, group);
  }

  async function handleCreate() {
    if (!selectedAgentId) return;

    setCreating(true);
    try {
      const res = await fetchWithCsrf("/api/admin/chat/conversations", {
        method: "POST",
        body: JSON.stringify({
          agentId: selectedAgentId,
          title: title.trim() || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create conversation");
        return;
      }

      onOpenChange(false);
      setSelectedAgentId(null);
      setTitle("");
      router.push(`/admin/chat/${data.conversation.id}`);
    } catch {
      toast.error("Failed to create conversation");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Choose an agent to start a conversation with.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-white">
              Select Agent
            </Label>
            <div className="max-h-[300px] space-y-4 overflow-y-auto rounded-xl border border-ghost-border bg-ghost-base p-3">
              {[...grouped.entries()].map(([businessName, businessAgents]) => (
                <div key={businessName} className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    {businessName}
                  </div>
                  {businessAgents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        selectedAgentId === agent.id
                          ? "border border-brand-cyan/50 bg-brand-cyan/10"
                          : "border border-transparent hover:bg-ghost-surface"
                      }`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ghost-raised text-lg">
                        {agent.emoji || "🤖"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white">
                          {agent.displayName}
                        </div>
                        <div className="truncate text-xs text-slate-400">
                          {agent.role}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ))}

              {grouped.size === 0 && (
                <div className="py-4 text-center text-sm text-slate-500">
                  No active agents available. Activate a business first.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="conv-title"
              className="text-sm font-medium text-white"
            >
              Title (optional)
            </Label>
            <Input
              id="conv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q2 Marketing Strategy"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedAgentId || creating}
            onClick={() => void handleCreate()}
          >
            {creating ? "Creating..." : "Start Conversation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
