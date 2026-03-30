import Link from "next/link";
import { BookOpen, Building2, LayoutDashboard } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { WelcomeCookieSetter } from "@/components/admin/WelcomeCookieSetter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminWelcomePage() {
  const welcomeCookie = cookies().get("gpc_welcomed")?.value;

  if (welcomeCookie === "true") {
    redirect("/admin");
  }

  const actions = [
    {
      href: "/admin/businesses/create",
      title: "Create a Business",
      description:
        "Start your first business profile and unlock the Business Builder workflow.",
      icon: Building2
    },
    {
      href: "/admin",
      title: "View Dashboard",
      description:
        "Open the Mission Control dashboard to review system status and next steps.",
      icon: LayoutDashboard
    },
    {
      href: "/admin/docs",
      title: "Read Docs",
      description:
        "Browse the built-in guidance and operating notes for your deployment.",
      icon: BookOpen
    }
  ];

  return (
    <div className="space-y-8">
      <WelcomeCookieSetter />
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-white">
          Welcome to Ghost ProtoClaw Mission Control
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-400">
          Your admin shell is ready. From here you can launch businesses,
          configure agents, and bring your OpenClaw operations under one clean
          control plane.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <Card
              key={action.href}
              variant="hover"
              className="border-ghost-border bg-ghost-surface"
            >
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ghost-raised text-brand-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{action.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm leading-6 text-slate-400">
                  {action.description}
                </p>
                <Button asChild className="w-full">
                  <Link href={action.href}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
