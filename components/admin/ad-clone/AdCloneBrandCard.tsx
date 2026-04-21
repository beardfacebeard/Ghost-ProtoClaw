"use client";

import { ExternalLink, MoreVertical, Palette, Pencil, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type AdCloneBrandCardProps = {
  brand: {
    id: string;
    name: string;
    font?: string | null;
    colors?: string | null;
    website?: string | null;
  };
  onEdit: (brand: AdCloneBrandCardProps["brand"]) => void;
  onDelete: (id: string) => void;
};

function parseColors(colors: string | null | undefined): string[] {
  if (!colors) return [];
  return colors
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c));
}

export function AdCloneBrandCard({
  brand,
  onEdit,
  onDelete,
}: AdCloneBrandCardProps) {
  const colorSwatches = parseColors(brand.colors);

  return (
    <div className="group relative rounded-lg border border-line-subtle bg-bg-surface p-4 transition-colors hover:border-line">
      <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(brand)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-400 focus:text-red-400"
              onClick={() => onDelete(brand.id)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800">
          <Palette className="h-6 w-6 text-ink-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-white">{brand.name}</h3>

          {colorSwatches.length > 0 && (
            <div className="mt-1.5 flex gap-1.5">
              {colorSwatches.map((color, i) => (
                <div
                  key={i}
                  className="h-5 w-5 rounded-full border border-slate-600"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
            {brand.font && <span>{brand.font}</span>}
            {brand.website && (
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                Website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
