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
          toast: "border border-ghost-border bg-ghost-surface text-white",
          title: "text-white",
          description: "text-zinc-300",
          actionButton: "bg-brand-primary text-white",
          cancelButton: "bg-ghost-raised text-zinc-100"
        }
      }}
      {...props}
    />
  );
};

export { Toaster };
