"use client";

import { useMemo, useRef, useState } from "react";
import {
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Music,
  Trash2,
  Upload,
  Video
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type BrandAssetRow = {
  id: string;
  businessId: string;
  businessName: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  url: string | null;
  description: string | null;
  category: string;
  createdAt: string;
};

type BusinessOption = { id: string; name: string };

const CATEGORY_OPTIONS: Array<{
  value: string;
  label: string;
  description: string;
}> = [
  {
    value: "logo",
    label: "🎯 Logo",
    description: "Primary + secondary logos, icons."
  },
  {
    value: "brand_guide",
    label: "📘 Brand Guide",
    description: "Colors, typography, voice, usage rules."
  },
  {
    value: "product_image",
    label: "📦 Product Image",
    description: "Hero shots, packaging, mockups."
  },
  {
    value: "marketing",
    label: "📣 Marketing",
    description: "Social posts, banners, ad creatives, video B-roll."
  },
  {
    value: "document",
    label: "📄 Document",
    description: "PDFs, decks, one-pagers."
  },
  {
    value: "general",
    label: "📂 General",
    description: "Anything that doesn't fit above."
  }
];

function fileTypeIcon(fileType: string) {
  switch (fileType) {
    case "image":
      return ImageIcon;
    case "video":
      return Video;
    case "audio":
      return Music;
    case "document":
      return FileText;
    default:
      return FileText;
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

async function presign(params: {
  filename: string;
  contentType: string;
  size: number;
  folder: string;
  businessId: string;
}): Promise<{ uploadUrl: string; key: string }> {
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
  businessId: string;
  title?: string;
  description?: string;
  asBrandAsset: true;
  brandAssetCategory: string;
}): Promise<{ brandAssetId: string | null; publicUrl: string }> {
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
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

type Props = {
  businesses: BusinessOption[];
  defaultBusinessId: string | null;
  assets: BrandAssetRow[];
  r2Configured: boolean;
};

export function BrandAssetsClient({
  businesses,
  defaultBusinessId,
  assets,
  r2Configured
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<BrandAssetRow[]>(assets);
  const [businessFilter, setBusinessFilter] = useState<string>(
    defaultBusinessId ?? "__all__"
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("__all__");
  const [uploadBusinessId, setUploadBusinessId] = useState<string>(
    defaultBusinessId ?? ""
  );
  const [uploadCategory, setUploadCategory] = useState<string>("logo");
  const [uploadDescription, setUploadDescription] = useState<string>("");
  const [uploadTitle, setUploadTitle] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [phase, setPhase] = useState<
    "idle" | "presigning" | "uploading" | "finalizing" | "done" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return items.filter((asset) => {
      if (businessFilter !== "__all__" && asset.businessId !== businessFilter) {
        return false;
      }
      if (categoryFilter !== "__all__" && asset.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [items, businessFilter, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, BrandAssetRow[]>();
    for (const asset of filtered) {
      const existing = map.get(asset.category) ?? [];
      existing.push(asset);
      map.set(asset.category, existing);
    }
    return map;
  }, [filtered]);

  async function handleUpload() {
    if (!file || !uploadBusinessId) {
      toast.error("Pick a file and a business.");
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
        folder: `brand-assets/${uploadCategory}`,
        businessId: uploadBusinessId
      });
      setPhase("uploading");
      await uploadWithProgress(presigned.uploadUrl, file, setProgress);
      setPhase("finalizing");
      const result = await finalize({
        key: presigned.key,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        businessId: uploadBusinessId,
        title: uploadTitle || file.name,
        description: uploadDescription || undefined,
        asBrandAsset: true,
        brandAssetCategory: uploadCategory
      });
      setPhase("done");
      const businessName =
        businesses.find((b) => b.id === uploadBusinessId)?.name ?? "Unknown";
      setItems((prev) => [
        {
          id: result.brandAssetId ?? `tmp-${Date.now()}`,
          businessId: uploadBusinessId,
          businessName,
          fileName: uploadTitle || file.name,
          fileType: file.type.startsWith("video/")
            ? "video"
            : file.type.startsWith("audio/")
              ? "audio"
              : file.type.startsWith("image/")
                ? "image"
                : "document",
          mimeType: file.type,
          fileSize: file.size,
          url: result.publicUrl,
          description: uploadDescription || null,
          category: uploadCategory,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
      toast.success("Brand asset uploaded.");
      setUploadTitle("");
      setUploadDescription("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setPhase("error");
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
      toast.error(message);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const response = await fetchWithCsrf(`/api/admin/brand-assets/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Delete failed");
      }
      setItems((prev) => prev.filter((a) => a.id !== id));
      toast.success("Brand asset removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied.");
    } catch {
      toast.error("Clipboard not available.");
    }
  }

  const busy =
    phase === "presigning" || phase === "uploading" || phase === "finalizing";

  return (
    <div className="space-y-6 pb-12">
      {!r2Configured ? (
        <Card>
          <CardContent className="p-4 text-sm space-y-2">
            <p className="font-medium text-status-error">
              Cloudflare R2 not configured.
            </p>
            <p className="text-muted-foreground">
              Add it under{" "}
              <a href="/admin/integrations" className="text-brand-cyan underline">
                /admin/integrations → Cloudflare R2 Storage
              </a>
              . Existing brand assets still show below — new uploads need R2.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="text-sm font-semibold">Upload new brand asset</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">Business</Label>
              <Select
                value={uploadBusinessId}
                onValueChange={setUploadBusinessId}
              >
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
              <Label className="text-xs">Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {
                  CATEGORY_OPTIONS.find((c) => c.value === uploadCategory)
                    ?.description
                }
              </p>
            </div>
          </div>
          <div>
            <Label className="text-xs">Name (optional)</Label>
            <Input
              className="mt-1"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Primary logo — light version"
            />
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="What is this for? When should agents use it?"
            />
          </div>
          <div>
            <Label className="text-xs">File</Label>
            <Input
              ref={fileInputRef}
              className="mt-1"
              type="file"
              accept="image/*,video/*,audio/*,application/pdf,text/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
            {file ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {file.name} · {formatSize(file.size)} · {file.type || "unknown"}
              </p>
            ) : null}
          </div>
          {busy ? (
            <p className="text-xs text-muted-foreground">
              {phase === "presigning"
                ? "Requesting upload URL…"
                : phase === "uploading"
                  ? `Uploading (${progress}%)…`
                  : "Finalizing…"}
            </p>
          ) : null}
          {error ? (
            <p className="text-xs text-status-error">{error}</p>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleUpload}
              disabled={busy || !file || !uploadBusinessId || !r2Configured}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Working…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1" />
                  Upload as {
                    CATEGORY_OPTIONS.find((c) => c.value === uploadCategory)
                      ?.label
                  }
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Filter business</Label>
          <Select value={businessFilter} onValueChange={setBusinessFilter}>
            <SelectTrigger className="mt-1 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All businesses</SelectItem>
              {businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Filter category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="mt-1 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All categories</SelectItem>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {items.length} assets
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No brand assets yet. Upload above, or ask an agent to call
          generate_image in chat.
        </div>
      ) : (
        <div className="space-y-6">
          {CATEGORY_OPTIONS.filter((c) => grouped.has(c.value)).map((c) => {
            const rows = grouped.get(c.value) ?? [];
            return (
              <section key={c.value} className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {c.label}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({rows.length})
                  </span>
                </h3>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((asset) => {
                    const Icon = fileTypeIcon(asset.fileType);
                    const canPreview =
                      asset.fileType === "image" && asset.url;
                    return (
                      <Card key={asset.id} className="overflow-hidden">
                        {canPreview ? (
                          <a
                            href={asset.url ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-video bg-muted/40"
                            style={{
                              backgroundImage: `url(${asset.url})`,
                              backgroundSize: "contain",
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat"
                            }}
                          />
                        ) : (
                          <div className="flex aspect-video items-center justify-center bg-muted/30">
                            <Icon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">
                                {asset.fileName}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {asset.businessName} · {formatSize(asset.fileSize)}{" "}
                                · {new Date(asset.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="default" className="text-[10px]">
                              {asset.fileType}
                            </Badge>
                          </div>
                          {asset.description ? (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {asset.description}
                            </p>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            {asset.url ? (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-7"
                              >
                                <a
                                  href={asset.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Open
                                </a>
                              </Button>
                            ) : null}
                            {asset.url ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7"
                                onClick={() => copyUrl(asset.url!)}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy URL
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 text-status-error"
                              onClick={() => handleDelete(asset.id)}
                              disabled={deletingId === asset.id}
                            >
                              {deletingId === asset.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
