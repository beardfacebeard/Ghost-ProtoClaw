"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

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

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  /** If provided, the user must type this exact text to enable the confirm button. */
  confirmText?: string;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  loading = false,
  confirmText
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [typedText, setTypedText] = useState("");
  const busy = loading || submitting;
  const textMatch = confirmText
    ? typedText.trim().toLowerCase() === confirmText.trim().toLowerCase()
    : true;

  function handleOpenChange(next: boolean) {
    if (!next) setTypedText("");
    onOpenChange(next);
  }

  async function handleConfirm() {
    if (!textMatch) return;
    try {
      setSubmitting(true);
      await onConfirm();
      handleOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {confirmText ? (
          <div className="space-y-2 py-2">
            <p className="text-sm text-slate-400">
              Type{" "}
              <span className="font-semibold text-white">{confirmText}</span>{" "}
              to confirm.
            </p>
            <Input
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={confirmText}
              autoFocus
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={busy || !textMatch}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {busy ? "Working..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
