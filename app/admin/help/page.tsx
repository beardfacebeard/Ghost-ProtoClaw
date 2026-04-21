import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";

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
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-steel/15 text-steel-bright">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-bold text-white">Help Center</h1>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-ink-secondary">
          Plain-English guides to everything this app can do. The Help
          Assistant on the right is powered by Claude Opus 4.6 — it knows
          every article on this page for app-specific questions, and can also
          help you with the broader work (writing prompts, explaining
          concepts, general advice).
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-10">
          <nav
            aria-label="Help sections"
            className="flex flex-wrap gap-2 rounded border border-line-subtle bg-bg-surface px-3 py-2"
          >
            {helpSections.map((section) => (
              <a
                key={section.id}
                href={`#section-${section.id}`}
                className="rounded-full border border-line-subtle bg-bg-surface-2 px-3 py-1 text-xs text-ink-primary transition-colors hover:border-steel/40 hover:text-white"
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
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-white">
                  {section.title}
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-ink-secondary">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Still stuck?</CardTitle>
              <CardDescription>
                A few more places you can look.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-ink-primary">
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
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <HelpAssistant />
        </aside>
      </div>
    </div>
  );
}
