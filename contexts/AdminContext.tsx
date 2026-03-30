"use client";

import * as React from "react";

import type { AdminSession } from "@/components/admin/types";

type AdminContextValue = {
  session: AdminSession;
  isSuperAdmin: boolean;
  organizationId: string | null;
  planTier: string;
  refresh: () => void;
};

const AdminContext = React.createContext<AdminContextValue | null>(null);

type AdminProviderProps = {
  session: AdminSession;
  refresh: () => void;
  children: React.ReactNode;
};

export function AdminProvider({
  session,
  refresh,
  children
}: AdminProviderProps) {
  const value: AdminContextValue = {
    session,
    isSuperAdmin: session.role === "super_admin",
    organizationId: session.organizationId,
    planTier: session.planTier,
    refresh
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = React.useContext(AdminContext);

  if (!context) {
    throw new Error("useAdmin must be used within an AdminProvider.");
  }

  return context;
}
