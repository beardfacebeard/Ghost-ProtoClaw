import Link from "next/link";
import {
  BookOpen,
  Building2,
  Bot,
  GitBranch,
  Plug,
  Shield,
  Activity,
  Settings,
  ExternalLink
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "1. Create Your First Business",
    icon: Building2,
    href: "/admin/businesses/create",
    description:
      "Every operation starts with a business profile. Create one to unlock agents, workflows, and knowledge bases. Pick a template that matches your business type and the system will generate starter agents and workflows for you."
  },
  {
    title: "2. Meet Your Agents",
    icon: Bot,
    href: "/admin/agents",
    description:
      "Agents are your AI workers. Each business gets a main agent plus optional specialists. You can customize their personality, tools, and escalation rules. Test them right from the dashboard before going live."
  },
  {
    title: "3. Set Up Workflows",
    icon: GitBranch,
    href: "/admin/workflows",
    description:
      "Workflows automate recurring tasks: daily summaries, lead intake, content queues, and more. Each workflow has a trigger (manual, scheduled, or webhook), an output type, and an approval mode so you stay in control."
  },
  {
    title: "4. Connect Integrations",
    icon: Plug,
    href: "/admin/integrations",
    description:
      "Link external services like email, CRM, Stripe, or social platforms. Integrations let your agents interact with the tools you already use. Each connection is scoped to a business or your whole organization."
  },
  {
    title: "5. Configure Settings",
    icon: Settings,
    href: "/admin/settings",
    description:
      "Review your profile, AI provider keys, email configuration, and system health. The Settings page shows you what is connected and what still needs attention so nothing is left half-configured."
  },
  {
    title: "6. Approvals & Safety",
    icon: Shield,
    href: "/admin/approvals",
    description:
      "When a workflow or agent wants to take an action that needs your sign-off, it creates an approval request. Review pending approvals here. You decide what runs automatically and what waits for you."
  },
  {
    title: "7. Monitor Health",
    icon: Activity,
    href: "/admin/health",
    description:
      "The Health dashboard shows the live status of your database, AI runtime, email provider, and integrations. If something goes wrong, you will see it here with guidance on how to fix it."
  }
];

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-white">
          <BookOpen className="mr-3 inline-block h-8 w-8 text-steel-bright" />
          Getting Started
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-ink-secondary">
          Ghost ProtoClaw Mission Control is your admin panel for running
          AI-powered business operations. Follow these steps to get up and
          running. Each section links to the relevant page so you can take action
          right away.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Link key={section.href} href={section.href} className="group">
              <Card
                variant="hover"
                className="h-full border-line-subtle bg-bg-surface transition-colors group-hover:border-steel/40"
              >
                <CardHeader>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-surface-2 text-steel-bright">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-ink-secondary">
                    {section.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="border-line-subtle bg-bg-surface">
        <CardContent className="py-6">
          <h2 className="mb-3 text-lg font-semibold text-white">
            Need more help?
          </h2>
          <ul className="space-y-2 text-sm text-ink-secondary">
            <li>
              <ExternalLink className="mr-2 inline-block h-4 w-4 text-steel-bright" />
              Visit the{" "}
              <Link
                href="/admin/health"
                className="text-steel-bright underline-offset-4 hover:underline"
              >
                Health dashboard
              </Link>{" "}
              to check if all services are connected.
            </li>
            <li>
              <ExternalLink className="mr-2 inline-block h-4 w-4 text-steel-bright" />
              Review{" "}
              <Link
                href="/admin/activity"
                className="text-steel-bright underline-offset-4 hover:underline"
              >
                Activity
              </Link>{" "}
              to see recent actions and changes across your businesses.
            </li>
            <li>
              <ExternalLink className="mr-2 inline-block h-4 w-4 text-steel-bright" />
              Check{" "}
              <Link
                href="/admin/settings"
                className="text-steel-bright underline-offset-4 hover:underline"
              >
                Settings
              </Link>{" "}
              to verify your profile and connected services.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
