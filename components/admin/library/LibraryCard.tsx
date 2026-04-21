"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

type LibraryCardProps = {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  badges: string[];
  source: string;
  icon?: string;
  selected: boolean;
  onToggle: (id: string) => void;
  footer?: React.ReactNode;
};

export function LibraryCard({
  id,
  title,
  subtitle,
  description,
  badges,
  source,
  icon,
  selected,
  onToggle,
  footer
}: LibraryCardProps) {
  return (
    <Card
      className={`transition cursor-pointer hover:border-primary/60 ${
        selected ? "border-primary ring-1 ring-primary" : ""
      }`}
      onClick={() => onToggle(id)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div
            className="pt-1"
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggle(id)}
              aria-label={`Select ${title}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              {icon ? (
                <span className="text-xl leading-none" aria-hidden>
                  {icon}
                </span>
              ) : null}
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-foreground leading-tight">
                  {title}
                </h3>
                {subtitle ? (
                  <p className="text-xs text-ink-muted mt-0.5">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-ink-muted line-clamp-3">
          {description}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {badges.slice(0, 6).map((badge) => (
            <Badge key={badge} variant="default" className="text-[10px]">
              {badge}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between pt-1 text-[11px] text-ink-muted">
          <span>{source}</span>
          {footer}
        </div>
      </CardContent>
    </Card>
  );
}
