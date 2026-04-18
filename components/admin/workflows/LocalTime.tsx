"use client";

import { useEffect, useState } from "react";

import { formatWorkflowDate } from "@/components/admin/workflows/utils";

type LocalTimeProps = {
  value?: Date | string | null;
  fallback?: string;
};

/**
 * Renders a timestamp in the viewer's local timezone.
 *
 * formatWorkflowDate calls toLocaleString() which uses the runtime's default
 * timezone. On server components (app/admin/workflows/[id]/page.tsx) the
 * runtime is Railway's UTC container, so timestamps render as UTC even for
 * users in a different zone. This client wrapper defers the formatting to
 * the browser so the timezone matches the user's OS setting.
 *
 * During SSR we render the UTC-rendered fallback so hydration doesn't flash,
 * then swap to the local render on the client.
 */
export function LocalTime({ value, fallback }: LocalTimeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{fallback ?? formatWorkflowDate(value)}</>;
  }

  return <>{formatWorkflowDate(value)}</>;
}
