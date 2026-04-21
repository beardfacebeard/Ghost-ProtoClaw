import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/** Shared Textarea — same token system as Input. */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full rounded-md border border-line-subtle bg-bg-surface-2 px-3 py-2 text-[13px] text-ink-primary transition-colors duration-150 placeholder:text-ink-muted focus-visible:border-steel/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-steel/30 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
