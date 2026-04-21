import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHeader, Panel, PanelBody, PanelHeader } from "@/components/admin/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HelpAssistant } from "@/components/admin/help/HelpAssistant";
import { helpSections } from "@/lib/help/knowledge-base";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Help · Ghost ProtoClaw",
};

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System · Help"
        title="Help center"
        description="Plain-English guides to everything this app can do. The Help Assistant on the right is powered by Claude Opus 4.6 — it knows every article on this page and can also help with prompts, concepts, and general advice."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-10">
          <nav
            aria-label="Help sections"
            className="flex flex-wrap gap-1.5 rounded-lg border border-line-subtle bg-bg-surface px-3 py-2.5"
          >
            {helpSections.map((section) => (
              <a
                key={section.id}
                href={`#section-${section.id}`}
                className="rounded-md border border-line-subtle bg-bg-surface-2 px-2.5 py-1 text-[11.5px] text-ink-secondary transition-colors hover:border-line hover:text-steel-bright"
              >
                {section.title}
              </a>
            ))}
          </nav>

          {helpSections.map((section) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              className="space-y-4 scroll-mt-24"
            >
              <div className="space-y-1.5">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                  {section.id.replaceAll("-", " · ")}
                </div>
                <h2 className="font-display text-[20px] font-semibold leading-tight tracking-tight text-ink-primary">
                  {section.title}
                </h2>
                <p className="max-w-3xl text-[13px] leading-relaxed text-ink-secondary">
                  {section.description}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {section.articles.map((article) => (
                  <Card
                    key={article.id}
                    id={`article-${article.id}`}
                    className="scroll-mt-24"
                  >
                    <CardHeader>
                      <CardTitle className="text-base">
                        {article.title}
                      </CardTitle>
                      {article.summary && (
                        <CardDescription>{article.summary}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {article.body.split("\n\n").map((para, idx) => (
                        <p
                          key={idx}
                          className="whitespace-pre-line text-sm leading-6 text-ink-primary"
                        >
                          {para}
                        </p>
                      ))}

                      {article.links && article.links.length > 0 && (
                        <ul className="space-y-1 pt-2">
                          {article.links.map((link) => (
                            <li key={link.href}>
                              <Link
                                href={link.href}
                                className="inline-flex items-center gap-1.5 text-xs text-steel-bright hover:underline"
                              >
                                {link.label}
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}

          <Panel>
            <PanelHeader label="Still stuck?" />
            <PanelBody>
              <p className="mb-3 text-[12px] text-ink-secondary">
                A few more places you can look.
              </p>
              <ul className="space-y-2 text-[13px] text-ink-primary">
                <li>
                  Check the{" "}
                  <Link
                    href="/admin/health"
                    className="text-steel-bright hover:underline"
                  >
                    Health dashboard
                  </Link>{" "}
                  — most problems show up there first with a one-line fix.
                </li>
                <li>
                  Review{" "}
                  <Link
                    href="/admin/activity"
                    className="text-steel-bright hover:underline"
                  >
                    Activity
                  </Link>{" "}
                  to see what your agents and workflows have been doing lately.
                </li>
                <li>
                  Peek at{" "}
                  <Link
                    href="/admin/logs"
                    className="text-steel-bright hover:underline"
                  >
                    Logs
                  </Link>{" "}
                  for raw system messages when something looks wrong.
                </li>
                <li>
                  Ask the Help Assistant on this page — it&apos;s grounded in
                  every article above and can point you to the right one.
                </li>
              </ul>
            </PanelBody>
          </Panel>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <HelpAssistant />
        </aside>
      </div>
    </div>
  );
}
