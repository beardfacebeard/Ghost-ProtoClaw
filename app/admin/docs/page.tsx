import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Building2,
  GitBranch,
  Plug,
  Settings,
  Shield
} from "lucide-react";

import { PageHeader, Panel, PanelBody, PanelHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "Create your first business",
    step: "01",
    icon: Building2,
    href: "/admin/businesses/create",
    description:
      "Every operation starts with a business profile. Pick a template that matches your business type and the system generates starter agents and workflows for you."
  },
  {
    title: "Meet your agents",
    step: "02",
    icon: Bot,
    href: "/admin/agents",
    description:
      "Agents are your AI workers. Each business gets a main agent plus optional specialists. Customize personality, tools, and escalation rules — test before going live."
  },
  {
    title: "Set up workflows",
    step: "03",
    icon: GitBranch,
    href: "/admin/workflows",
    description:
      "Workflows automate recurring tasks: daily summaries, lead intake, content queues. Each has a trigger, an output type, and an approval mode so you stay in control."
  },
  {
    title: "Connect integrations",
    step: "04",
    icon: Plug,
    href: "/admin/integrations",
    description:
      "Link external services — email, CRM, Stripe, social platforms. Integrations let agents act in the tools you already use. Each connection is scoped per business or org-wide."
  },
  {
    title: "Configure settings",
    step: "05",
    icon: Settings,
    href: "/admin/settings",
    description:
      "Review your profile, AI provider keys, email configuration, and system health. Settings shows what's connected and what still needs attention."
  },
  {
    title: "Approvals & safety",
    step: "06",
    icon: Shield,
    href: "/admin/approvals",
    description:
      "When an agent wants to act on something that needs your sign-off, it creates an approval request. You decide what runs automatically and what waits for you."
  },
  {
    title: "Monitor health",
    step: "07",
    icon: Activity,
    href: "/admin/health",
    description:
      "The Health dashboard shows the live status of your database, AI runtime, email provider, and integrations. Fixes show up here with guidance."
  }
];

const helpLinks = [
  {
    href: "/admin/health",
    label: "Health dashboard",
    detail: "Check whether every service is connected and responding."
  },
  {
    href: "/admin/activity",
    label: "Activity feed",
    detail: "See recent actions and changes across your businesses."
  },
  {
    href: "/admin/settings",
    label: "Settings",
    detail: "Verify your profile, API keys, and connected services."
  }
];

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System · Getting started"
        title="Getting started"
        description="Mission Control is your admin panel for running AI-powered business operations. Follow these steps to get up and running — each card links to the page where you can take action."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Link
              key={section.href}
              href={section.href}
              className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-line-subtle bg-bg-surface p-4 transition-colors duration-150 hover:border-line hover:bg-bg-surface-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-line-subtle bg-bg-surface-2 text-steel-bright transition-colors group-hover:border-steel/40">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="font-mono text-[10.5px] text-ink-muted">
                  {section.step}
                </span>
              </div>
              <div className="mt-4 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[13.5px] font-semibold text-ink-primary">
                    {section.title}
                  </h3>
                  <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted transition-colors group-hover:text-steel-bright" />
                </div>
                <p className="mt-1.5 text-[12px] leading-6 text-ink-secondary">
                  {section.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <Panel>
        <PanelHeader label="Need more help?" />
        <PanelBody className="space-y-2 p-0">
          {helpLinks.map((link, index) => (
            <Link
              key={link.href}
              href={link.href}
              className={`group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-bg-surface-2 ${
                index !== helpLinks.length - 1 ? "border-b border-line-subtle" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium text-ink-primary transition-colors group-hover:text-steel-bright">
                    {link.label}
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-ink-muted transition-colors group-hover:text-steel-bright" />
                </div>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-secondary">
                  {link.detail}
                </p>
              </div>
            </Link>
          ))}
        </PanelBody>
      </Panel>
    </div>
  );
}
