"use client";

import { BUSINESS_TEMPLATES } from "@/lib/templates/business-templates";
import { cn } from "@/lib/utils";

type TemplateSelectorProps = {
  onSelect: (templateId: string) => void;
  selected?: string;
};

export function TemplateSelector({
  onSelect,
  selected
}: TemplateSelectorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {BUSINESS_TEMPLATES.map((template) => {
        const active = template.id === selected;

        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template.id)}
            className={cn(
              "rounded-2xl border bg-bg-surface p-5 text-left transition-all",
              active
                ? "border-steel bg-steel/10 shadow-brand"
                : "border-line-subtle hover:border-line hover:-translate-y-0.5"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-3xl">{template.icon}</div>
              {template.id === "business_builder" ? (
                <span className="rounded-full border border-steel/20 bg-steel/10 px-2 py-0.5 text-[11px] font-medium text-steel-bright">
                  Recommended for beginners
                </span>
              ) : null}
            </div>
            <div className="mt-4 space-y-2">
              <div className="text-lg font-semibold text-white">
                {template.name}
              </div>
              <p className="text-sm leading-6 text-ink-secondary">
                {template.description}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-line-subtle bg-bg-surface-2 px-2 py-0.5 text-[11px] text-ink-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
