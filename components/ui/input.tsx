import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Shared Input primitive. 2026 redesign: neutral bg-surface-2 background
 * with 1px line-subtle border, steel focus ring. Uses ink tokens for
 * placeholder + text.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-line-subtle bg-bg-surface-2 px-3 py-2 text-[13px] text-ink-primary transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-ink-muted focus-visible:border-steel/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-steel/30 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
