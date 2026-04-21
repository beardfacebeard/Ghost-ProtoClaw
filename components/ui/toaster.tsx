"use client";

import * as React from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      closeButton
      expand
      richColors
      position="top-right"
      theme="dark"
      toastOptions={{
        classNames: {
          toast: "border border-line-subtle bg-bg-surface text-ink-primary",
          title: "text-ink-primary",
          description: "text-ink-secondary",
          actionButton: "bg-steel text-ink-primary",
          cancelButton: "bg-bg-surface-2 text-ink-primary"
        }
      }}
      {...props}
    />
  );
};

export { Toaster };
