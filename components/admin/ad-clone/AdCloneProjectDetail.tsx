"use client";

import { useCallback, useRef, useState } from "react";
import {
  Check,
  Image as ImageIcon,
  Star,
  Upload,
  Video,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

type ProjectRecord = {
  id: string;
  name: string;
  status: string;
  productId?: string | null;
  brandId?: string | null;
  inputAdUrl?: string | null;
  aiVersion1Url?: string | null;
  aiVersion2Url?: string | null;
  aiVersion3Url?: string | null;
  aiVersion4Url?: string | null;
  aiVersion5Url?: string | null;
  chosenVersionKey?: string | null;
  editRound1Notes?: string | null;
  editRound1Url?: string | null;
  editRound2Notes?: string | null;
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

type ProductOption = { id: string; name: string };
type BrandOption = { id: string; name: string };

type AdCloneProjectDetailProps = {
  project: ProjectRecord;
  products: ProductOption[];
  brands: BrandOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

const AI_VERSION_KEYS = [
  { key: "aiVersion1Url", label: "Variation 1" },
  { key: "aiVersion2Url", label: "Variation 2" },
  { key: "aiVersion3Url", label: "Variation 3" },
  { key: "aiVersion4Url", label: "Variation 4" },
  { key: "aiVersion5Url", label: "Variation 5" },
] as const;

const RESIZE_SLOTS = [
  { key: "resize916Url", label: "9:16", field: "resize916Url" },
  { key: "resize11Url", label: "1:1", field: "resize11Url" },
  { key: "resize43Url", label: "4:3", field: "resize43Url" },
] as const;

function StepHeader({
  step,
  title,
  done,
}: {
  step: number;
  title: string;
  done: boolean;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done
            ? "bg-green-600 text-white"
            : "border border-slate-600 bg-slate-800 text-ink-secondary"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : step}
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
  );
}

function UploadArea({
  label,
  currentUrl,
  onUpload,
  accept,
}: {
  label: string;
  currentUrl?: string | null;
  onUpload: (file: File) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div>
      {currentUrl ? (
        <div className="group relative">
          {accept?.includes("video") ? (
            <video
              src={currentUrl}
              controls
              className="w-full rounded-md border border-slate-700"
            />
          ) : (
            <img
              src={currentUrl}
              alt={label}
              className="w-full rounded-md border border-slate-700 object-contain"
            />
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center rounded-md bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Upload className="mr-2 h-4 w-4 text-white" />
            <span className="text-sm text-white">Replace</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-700 bg-slate-800/30 py-8 text-sm text-ink-secondary transition-colors hover:border-slate-500 hover:bg-slate-700/30"
        >
          <Upload className="h-5 w-5" />
          {label}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept ?? "image/*"}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}

export function AdCloneProjectDetail({
  project: initialProject,
  products,
  brands,
  open,
  onOpenChange,
  onUpdated,
}: AdCloneProjectDetailProps) {
  const [project, setProject] = useState(initialProject);
  const [saving, setSaving] = useState(false);

  // Keep in sync when parent re-passes project
  if (initialProject.id !== project.id) {
    setProject(initialProject);
  }

  const patchProject = useCallback(
    async (fields: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetchWithCsrf(
          `/api/admin/ad-clone/projects/${project.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(fields),
          }
        );
        if (res.ok) {
          const updated = await res.json();
          setProject(updated);
          onUpdated();
        }
      } finally {
        setSaving(false);
      }
    },
    [project.id, onUpdated]
  );

  const uploadFile = useCallback(
    async (file: File, field: string) => {
      setSaving(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("field", field);

        const res = await fetchWithCsrf(
          `/api/admin/ad-clone/projects/${project.id}/upload`,
          {
            method: "POST",
            body: formData,
          }
        );
        if (res.ok) {
          const updated = await res.json();
          setProject(updated);
          onUpdated();
        }
      } finally {
        setSaving(false);
      }
    },
    [project.id, onUpdated]
  );

  const hasAiVersion =
    project.aiVersion1Url ||
    project.aiVersion2Url ||
    project.aiVersion3Url ||
    project.aiVersion4Url ||
    project.aiVersion5Url;

  const hasResize =
    project.resize916Url || project.resize11Url || project.resize43Url;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-[60vw]"
      >
        <SheetHeader className="mb-6">
          <SheetTitle>Project Details</SheetTitle>
          <SheetDescription>
            Complete each step to build your ad creative
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8 pb-8">
          {/* ===== STEP 1 - Setup ===== */}
          <section>
            <StepHeader step={1} title="Setup" done={!!project.inputAdUrl} />

            <div className="space-y-4 pl-10">
              {/* Project name */}
              <div>
                <label className="mb-1 block text-xs text-ink-secondary">
                  Project Name
                </label>
                <Input
                  defaultValue={project.name}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value && value !== project.name) {
                      patchProject({ name: value });
                    }
                  }}
                />
              </div>

              {/* Product selector */}
              <div>
                <label className="mb-1 block text-xs text-ink-secondary">
                  Product
                </label>
                <Select
                  value={project.productId ?? ""}
                  onValueChange={(val) =>
                    patchProject({ productId: val || null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Brand selector */}
              <div>
                <label className="mb-1 block text-xs text-ink-secondary">
                  Brand
                </label>
                <Select
                  value={project.brandId ?? ""}
                  onValueChange={(val) =>
                    patchProject({ brandId: val || null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Input ad upload */}
              <div>
                <label className="mb-1 block text-xs text-ink-secondary">
                  Input Ad
                </label>
                <UploadArea
                  label="Upload your winning ad image"
                  currentUrl={project.inputAdUrl}
                  onUpload={(file) => uploadFile(file, "inputAdUrl")}
                />
              </div>
            </div>
          </section>

          {/* ===== STEP 2 - AI Variations ===== */}
          <section>
            <StepHeader
              step={2}
              title="AI Variations"
              done={!!hasAiVersion}
            />

            <div className="pl-10">
              <p className="mb-3 text-xs text-ink-secondary">
                Generate variations using MakeUGC, Creatify, or Arcads, then
                upload them here.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {AI_VERSION_KEYS.map(({ key, label }) => (
                  <div key={key}>
                    <p className="mb-1 text-center text-xs text-ink-muted">
                      {label}
                    </p>
                    <UploadArea
                      label="Upload"
                      currentUrl={
                        project[key as keyof ProjectRecord] as
                          | string
                          | null
                      }
                      onUpload={(file) => uploadFile(file, key)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ===== STEP 3 - Choose Favorite ===== */}
          <section>
            <StepHeader
              step={3}
              title="Choose Favorite"
              done={!!project.chosenVersionKey}
            />

            <div className="pl-10">
              <p className="mb-3 text-xs text-ink-secondary">
                Click a variation to select it as your favorite.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {AI_VERSION_KEYS.map(({ key, label }) => {
                  const url = project[key as keyof ProjectRecord] as
                    | string
                    | null;
                  if (!url) return null;

                  const isChosen = project.chosenVersionKey === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => patchProject({ chosenVersionKey: key })}
                      className={`relative overflow-hidden rounded-md border-2 transition-all ${
                        isChosen
                          ? "border-blue-500 ring-2 ring-blue-500"
                          : "border-slate-700 hover:border-slate-500"
                      }`}
                    >
                      <img
                        src={url}
                        alt={label}
                        className="aspect-square w-full object-cover"
                      />
                      {isChosen && (
                        <div className="absolute right-1 top-1 rounded-full bg-blue-500 p-1">
                          <Star className="h-3 w-3 fill-white text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ===== STEP 4 - Edit Round 1 ===== */}
          <section>
            <StepHeader
              step={4}
              title="Edit Round 1"
              done={!!project.editRound1Url}
            />

            <div className="space-y-3 pl-10">
              <div>
                <label className="mb-1 block text-xs text-ink-secondary">
                  Describe your edits
                </label>
                <Textarea
                  defaultValue={project.editRound1Notes ?? ""}
                  placeholder="What changes did you make?"
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value !== (project.editRound1Notes ?? "")) {
                      patchProject({ editRound1Notes: value });
                    }
                  }}
                />
              </div>
              <UploadArea
                label="Upload edited result"
                currentUrl={project.editRound1Url}
                onUpload={(file) => uploadFile(file, "editRound1Url")}
              />
            </div>
          </section>

          {/* ===== STEP 5 - Edit Round 2 ===== */}
          <section>
            <StepHeader
              step={5}
              title="Edit Round 2"
              done={!!project.editRound2Url}
            />

            <div className="space-y-3 pl-10">
              <div>
                <label className="mb-1 block text-xs text-ink-secondary">
                  Describe your edits
                </label>
                <Textarea
                  defaultValue={project.editRound2Notes ?? ""}
                  placeholder="What changes did you make?"
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value !== (project.editRound2Notes ?? "")) {
                      patchProject({ editRound2Notes: value });
                    }
                  }}
                />
              </div>
              <UploadArea
                label="Upload edited result"
                currentUrl={project.editRound2Url}
                onUpload={(file) => uploadFile(file, "editRound2Url")}
              />
            </div>
          </section>

          {/* ===== STEP 6 - Final Image ===== */}
          <section>
            <StepHeader
              step={6}
              title="Final Image"
              done={!!project.finalImageUrl}
            />

            <div className="pl-10">
              <UploadArea
                label="Upload your final approved creative"
                currentUrl={project.finalImageUrl}
                onUpload={(file) => uploadFile(file, "finalImageUrl")}
              />
            </div>
          </section>

          {/* ===== STEP 7 - Video (Optional) ===== */}
          <section>
            <StepHeader
              step={7}
              title="Video (Optional)"
              done={!!project.videoUrl}
            />

            <div className="pl-10">
              <UploadArea
                label="Upload video version"
                currentUrl={project.videoUrl}
                onUpload={(file) => uploadFile(file, "videoUrl")}
                accept="video/*"
              />
            </div>
          </section>

          {/* ===== STEP 8 - Resize ===== */}
          <section>
            <StepHeader step={8} title="Resize" done={!!hasResize} />

            <div className="pl-10">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {RESIZE_SLOTS.map(({ key, label, field }) => (
                  <div key={key}>
                    <div className="mb-2 flex items-center justify-center">
                      <Badge className="bg-slate-700 text-ink-primary">
                        {label}
                      </Badge>
                    </div>
                    <UploadArea
                      label={`Upload ${label}`}
                      currentUrl={
                        project[field as keyof ProjectRecord] as
                          | string
                          | null
                      }
                      onUpload={(file) => uploadFile(file, field)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {saving && (
          <div className="fixed bottom-4 right-4 rounded-md bg-slate-800 px-3 py-1.5 text-xs text-ink-primary shadow-lg">
            Saving...
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
