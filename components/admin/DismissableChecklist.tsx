"use client";

import { useCallback, useState, useTransition } from "react";
import { X } from "lucide-react";

import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { cn } from "@/lib/utils";

type DismissableChecklistProps = {
  children: React.ReactNode;
};

export function DismissableChecklist({ children }: DismissableChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDismiss = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetchWithCsrf("/api/admin/dashboard", {
          method: "PATCH",
          body: JSON.stringify({ action: "dismiss_checklist" })
        });

        if (res.ok) {
          setDismissed(true);
        }
      } catch {
        // Silently fail -- checklist remains visible
      }
    });
  }, []);

  if (dismissed) {
    return null;
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-line-subtle bg-bg-surface p-5 transition-opacity duration-300",
        isPending && "pointer-events-none opacity-50"
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4 border-b-0 pb-0">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white">
            Get started with Ghost ProtoClaw
          </h2>
          <p className="text-sm text-ink-secondary">
            Complete the essentials to bring your first Ghost ProtoClaw business
            online.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isPending}
          title="Hide Get Started guide"
          className="mt-1 shrink-0 rounded-lg p-1.5 text-ghost-muted transition-colors hover:bg-bg-surface-2 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </section>
  );
}
