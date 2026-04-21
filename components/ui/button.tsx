import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Shared Button primitive. 2026 redesign:
 * - Default (primary) is steel blue with a subtle hover glow.
 * - Outline is a neutral ghost-style with line-subtle border.
 * - Ghost is fully transparent until hover.
 * - Destructive uses state-danger.
 *
 * Focus ring is steel at 40% alpha — visible but not loud.
 * Disabled state keeps the layout but drops opacity.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-steel/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-steel text-bg-app hover:bg-steel-bright hover:shadow-steel-sm",
        outline:
          "border border-line bg-bg-surface text-ink-primary hover:border-steel/50 hover:bg-bg-surface-2",
        ghost:
          "bg-transparent text-ink-secondary hover:bg-bg-surface-2 hover:text-ink-primary",
        destructive:
          "bg-state-danger/90 text-ink-primary hover:bg-state-danger"
      },
      size: {
        sm: "h-8 px-3 text-[12px]",
        default: "h-9 px-4",
        lg: "h-10 px-5",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
