import Link from "next/link";
import {
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  Key,
  LayoutDashboard,
  Rocket,
  Settings
} from "lucide-react";
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

  const quickStartSteps = [
    {
      step: 1,
      title: "Connect your AI provider",
      description:
        "Add your OpenRouter API key in Settings. One key gives you access to hundreds of AI models.",
      href: "/admin/settings",
      icon: Key,
      cta: "Open Settings"
    },
    {
      step: 2,
      title: "Create a business",
      description:
        "Set up your first business profile. This is the workspace where your agents will operate.",
      href: "/admin/businesses/create",
      icon: Building2,
      cta: "Create Business"
    },
    {
      step: 3,
      title: "Create your first agent",
      description:
        "Build an AI agent — pick a role like CEO, CMO, or Support Lead, choose a model, and start chatting.",
      href: "/admin/agents/create",
      icon: Bot,
      cta: "Create Agent"
    },
    {
      step: 4,
      title: "Test it out",
      description:
        "Open your agent and click Test to have a conversation. Try asking it to help with a real business task.",
      href: "/admin/agents",
      icon: Rocket,
      cta: "View Agents"
    }
  ];

  const resources = [
    {
      href: "/admin",
      title: "Dashboard",
      description: "See system status and activity at a glance.",
      icon: LayoutDashboard
    },
    {
      href: "/admin/settings",
      title: "Settings",
      description: "Configure API keys, models, and system preferences.",
      icon: Settings
    },
    {
      href: "/admin/docs",
      title: "Documentation",
      description: "Guides, tips, and operating notes.",
      icon: BookOpen
    }
  ];

  return (
    <div className="space-y-10">
      <WelcomeCookieSetter />

      {/* Hero */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-white">
          Welcome to Ghost ProtoClaw
        </h1>
        <p className="max-w-2xl text-base leading-7 text-ink-secondary">
          Your AI-powered business control panel is ready. Follow the steps
          below to get up and running in about 5 minutes.
        </p>
      </div>

      {/* Quick Start Steps */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Rocket className="h-5 w-5 text-steel-bright" />
          Quick Start
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {quickStartSteps.map((item) => {
            const Icon = item.icon;

            return (
              <Card
                key={item.step}
                variant="hover"
                className="border-line-subtle bg-bg-surface"
              >
                <CardContent className="flex gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-steel/10 text-sm font-bold text-steel-bright">
                    {item.step}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-steel-bright" />
                      <span className="text-sm font-semibold text-white">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-ink-secondary">
                      {item.description}
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link href={item.href}>{item.cta}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tip box */}
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="flex items-start gap-3 p-5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-emerald-300">
              Only need one API key
            </p>
            <p className="text-sm leading-6 text-ink-secondary">
              OpenRouter gives you access to OpenAI, Anthropic, Google, DeepSeek,
              and hundreds more models through a single API key. You can start
              with their free models and upgrade anytime.
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
              >
                Get your key
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Resources</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {resources.map((item) => {
            const Icon = item.icon;

            return (
              <Card
                key={item.href}
                variant="hover"
                className="border-line-subtle bg-bg-surface"
              >
                <CardHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded bg-bg-surface-2 text-steel-bright">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-sm leading-6 text-ink-secondary">
                    {item.description}
                  </p>
                  <Button asChild className="w-full">
                    <Link href={item.href}>Open</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
