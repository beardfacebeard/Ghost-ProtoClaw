"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Upload, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

type BusinessOption = {
  id: string;
  name: string;
};

type UploadedAsset = {
  filename: string;
  publicUrl: string;
  contentType: string;
  kind: string;
  size: number;
  uploadedAt: string;
};

type Props = {
  businesses: BusinessOption[];
  defaultBusinessId: string | null;
  r2Configured: boolean;
};

async function presign(params: {
  filename: string;
  contentType: string;
  size: number;
  folder?: string;
  businessId?: string;
}): Promise<{
  uploadUrl: string;
  key: string;
  method: "PUT";
  headers: Record<string, string>;
}> {
  const response = await fetchWithCsrf("/api/admin/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Presign failed");
  }
  return response.json();
}

async function finalize(params: {
  key: string;
  filename: string;
  contentType: string;
  size: number;
  title?: string;
  description?: string;
  businessId?: string;
}): Promise<{ publicUrl: string; kind: string }> {
  const response = await fetchWithCsrf("/api/admin/uploads/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "Finalize failed");
  }
  return response.json();
}

function uploadWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(`Upload failed (${xhr.status}). ${xhr.responseText.slice(0, 200)}`)
        );
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

export function R2Uploader({
  businesses,
  defaultBusinessId,
  r2Configured
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [businessId, setBusinessId] = useState<string>(
    defaultBusinessId ?? ""
  );
  const [folder, setFolder] = useState<string>("videos");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [phase, setPhase] = useState<
    "idle" | "presigning" | "uploading" | "finalizing" | "done" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<UploadedAsset[]>([]);

  async function handleUpload() {
    if (!file) {
      toast.error("Pick a file first.");
      return;
    }
    if (!businessId) {
      toast.error("Choose a business.");
      return;
    }
    setError(null);
    setProgress(0);

    try {
      setPhase("presigning");
      const presigned = await presign({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        folder: folder || "uploads",
        businessId
      });

      setPhase("uploading");
      await uploadWithProgress(
        presigned.uploadUrl,
        file,
        file.type || "application/octet-stream",
        setProgress
      );

      setPhase("finalizing");
      const finalized = await finalize({
        key: presigned.key,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        title: title || file.name,
        description: description || undefined,
        businessId
      });

      setPhase("done");
      setRecent((prev) => [
        {
          filename: file.name,
          publicUrl: finalized.publicUrl,
          contentType: file.type,
          kind: finalized.kind,
          size: file.size,
          uploadedAt: new Date().toISOString()
        },
        ...prev
      ]);
      toast.success(`${file.name} uploaded.`);
      setTitle("");
      setDescription("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setPhase("error");
      const message =
        err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      toast.error(message);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("URL copied.");
    } catch {
      toast.error("Clipboard not available.");
    }
  }

  if (!r2Configured) {
    return (
      <Card>
        <CardContent className="p-6 text-sm space-y-3">
          <p className="font-medium text-status-error">
            Cloudflare R2 is not configured yet.
          </p>
          <p className="text-muted-foreground">
            Easiest path: go to{" "}
            <a
              href="/admin/integrations"
              className="text-brand-cyan underline"
            >
              /admin/integrations
            </a>{" "}
            and add the <strong>Cloudflare R2 Storage</strong> integration
            with your account id, API token, and bucket name. The
            Uploads page starts working as soon as you save.
          </p>
          <details className="text-muted-foreground">
            <summary className="cursor-pointer text-xs">
              Advanced: set env vars on Railway instead
            </summary>
            <ul className="mt-2 list-disc pl-5 text-xs">
              <li>
                <code>R2_ACCOUNT_ID</code>
              </li>
              <li>
                <code>R2_ACCESS_KEY_ID</code>
              </li>
              <li>
                <code>R2_SECRET_ACCESS_KEY</code>
              </li>
              <li>
                <code>R2_BUCKET</code>
              </li>
              <li>
                <code>R2_PUBLIC_BASE_URL</code> (optional — without it,
                files get 24-hour presigned GET URLs)
              </li>
            </ul>
          </details>
          <p className="text-muted-foreground text-xs">
            Create the bucket at Cloudflare → R2 → Create bucket. Then
            create an API token scoped to that bucket with
            Object:Read+Write permission.
          </p>
        </CardContent>
      </Card>
    );
  }

  const busy =
    phase === "presigning" ||
    phase === "uploading" ||
    phase === "finalizing";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">Business</Label>
              <Select value={businessId} onValueChange={setBusinessId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a business" />
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
            <div>
              <Label className="text-xs">Folder</Label>
              <Input
                className="mt-1"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="videos"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Title (optional)</Label>
            <Input
              className="mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Demo video — v3"
            />
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context your agents should know when they use this asset."
            />
          </div>
          <div>
            <Label className="text-xs">File</Label>
            <Input
              ref={fileInputRef}
              className="mt-1"
              type="file"
              accept="video/*,image/*,audio/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
            {file ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB ·{" "}
                {file.type || "unknown"}
              </p>
            ) : null}
          </div>
          {busy ? (
            <div className="space-y-1">
              <Progress value={progress} />
              <p className="text-[11px] text-muted-foreground">
                {phase === "presigning"
                  ? "Requesting upload URL…"
                  : phase === "uploading"
                    ? `Uploading (${progress}%)…`
                    : "Finalizing…"}
              </p>
            </div>
          ) : null}
          {phase === "done" ? (
            <p className="text-xs text-status-active inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Upload complete.
            </p>
          ) : null}
          {phase === "error" && error ? (
            <p className="text-xs text-status-error inline-flex items-center gap-1">
              <XCircle className="h-3 w-3" /> {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleUpload}
              disabled={busy || !file || !businessId}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Working…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {recent.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold">This session</h3>
            {recent.map((asset) => (
              <div
                key={asset.publicUrl}
                className="flex items-center justify-between gap-3 rounded border p-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{asset.filename}</div>
                  <div className="text-muted-foreground">
                    {asset.kind} · {(asset.size / (1024 * 1024)).toFixed(1)} MB
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {asset.publicUrl}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copy(asset.publicUrl)}
                  >
                    Copy URL
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={asset.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
