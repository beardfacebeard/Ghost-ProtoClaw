"use client";

import { MoreVertical, Package, Pencil, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type AdCloneProductCardProps = {
  product: {
    id: string;
    name: string;
    imageUrl?: string | null;
    notes?: string | null;
  };
  onEdit: (product: AdCloneProductCardProps["product"]) => void;
  onDelete: (id: string) => void;
};

export function AdCloneProductCard({
  product,
  onEdit,
  onDelete,
}: AdCloneProductCardProps) {
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
            <DropdownMenuItem onClick={() => onEdit(product)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-400 focus:text-red-400"
              onClick={() => onDelete(product.id)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-12 w-12 rounded-lg object-cover"
            />
          ) : (
            <Package className="h-6 w-6 text-ink-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-white">{product.name}</h3>
          {product.notes && (
            <p className="mt-1 line-clamp-2 text-xs text-ink-secondary">
              {product.notes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
