"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

export function MasterAgentProvisioner() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    try {
      setCreating(true);
      const res = await fetchWithCsrf("/api/admin/master-agent", {
        method: "POST"
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Failed to create master agent.");
        return;
      }
      toast.success("Master agent created.");
      router.refresh();
    } catch {
      toast.error("Failed to create master agent.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md space-y-4 rounded-2xl border border-ghost-border bg-ghost-surface p-6 text-center">
        <div className="text-4xl">🛰️</div>
        <h2 className="text-lg font-semibold text-white">
          Set up your master agent
        </h2>
        <p className="text-sm leading-6 text-slate-400">
          The master agent is your single point of contact across every
          business. It communicates with your business CEO agents on your
          behalf, answering questions and relaying updates. It can&apos;t
          directly execute actions — only ask CEOs to perform them.
        </p>
        <Button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating}
        >
          {creating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {creating ? "Creating..." : "Create Master Agent"}
        </Button>
      </div>
    </div>
  );
}
