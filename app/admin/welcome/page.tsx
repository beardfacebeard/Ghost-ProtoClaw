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
import {
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminWelcomePage() {
  const welcomeCookie = cookies().get("gpc_welcomed")?.value;

  if (welcomeCookie === "true") {
    redirect("/admin");
  }

  const quickStartSteps = [
    {
      step: "01",
      title: "Connect your AI provider",
      description:
        "Add your OpenRouter API key in Settings. One key gives you access to hundreds of AI models.",
      href: "/admin/settings",
      icon: Key,
      cta: "Open Settings"
    },
    {
      step: "02",
      title: "Create a business",
      description:
        "Set up your first business profile. This is the workspace where your agents will operate.",
      href: "/admin/businesses/create",
      icon: Building2,
      cta: "Create Business"
    },
    {
      step: "03",
      title: "Create your first agent",
      description:
        "Build an AI agent — pick a role like CEO, CMO, or Support Lead, choose a model, and start chatting.",
      href: "/admin/agents/create",
      icon: Bot,
      cta: "Create Agent"
    },
    {
      step: "04",
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
    <div className="space-y-8">
      <WelcomeCookieSetter />

      <PageHeader
        eyebrow="System · Welcome"
        title="Welcome to Ghost ProtoClaw"
        description="Your AI-powered business control panel is ready. Follow the four steps below to get live in about five minutes."
      />

      <Panel>
        <PanelHeader
          label="Quick start"
          action={
            <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-ink-muted">
              <Rocket className="h-3 w-3" />
              4 steps · ~5 min
            </span>
          }
        />
        <PanelBody className="p-0">
          <div className="grid gap-px bg-line-subtle md:grid-cols-2">
            {quickStartSteps.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.step}
                  className="flex gap-4 bg-bg-surface p-4 transition-colors hover:bg-bg-surface-2"
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="font-mono text-[10.5px] text-ink-muted">
                      {item.step}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-line-subtle bg-bg-surface-2 text-steel-bright">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="text-[13.5px] font-semibold text-ink-primary">
                      {item.title}
                    </div>
                    <p className="text-[12px] leading-6 text-ink-secondary">
                      {item.description}
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link href={item.href}>{item.cta}</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </PanelBody>
      </Panel>

      <div className="flex items-start gap-3 rounded-lg border border-state-success/25 bg-state-success/5 px-4 py-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-state-success" />
        <div className="space-y-1">
          <p className="text-[13px] font-medium text-ink-primary">
            Only need one API key
          </p>
          <p className="text-[12px] leading-6 text-ink-secondary">
            OpenRouter gives you access to OpenAI, Anthropic, Google, DeepSeek,
            and hundreds more models through a single API key. You can start
            with their free models and upgrade anytime.{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-state-success underline underline-offset-2 hover:brightness-110"
            >
              Get your key →
            </a>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
          Resources
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {resources.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex h-full flex-col rounded-lg border border-line-subtle bg-bg-surface p-4 transition-colors hover:border-line hover:bg-bg-surface-2"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-line-subtle bg-bg-surface-2 text-steel-bright transition-colors group-hover:border-steel/40">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-[13.5px] font-semibold text-ink-primary">
                  {item.title}
                </div>
                <p className="mt-1.5 flex-1 text-[12px] leading-6 text-ink-secondary">
                  {item.description}
                </p>
                <div className="mt-3 inline-flex items-center font-mono text-[10.5px] uppercase tracking-[0.22em] text-steel-bright opacity-0 transition-opacity group-hover:opacity-100">
                  Open →
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
