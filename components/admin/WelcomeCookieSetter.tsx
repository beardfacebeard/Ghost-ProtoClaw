"use client";

import { useEffect } from "react";

export function WelcomeCookieSetter() {
  useEffect(() => {
    document.cookie = "gpc_welcomed=true; Path=/; Max-Age=31536000; SameSite=Lax";
  }, []);

  return null;
}
