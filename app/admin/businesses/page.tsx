import Link from "next/link";
import { Building2 } from "lucide-react";

import { BusinessesFilterBar } from "@/components/admin/businesses/BusinessesFilterBar";
import { BusinessCard } from "@/components/admin/businesses/BusinessCard";
import { EmptyState } from "@/components/admin/EmptyState";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Button } from "@/components/ui/button";
import { requireServerSession } from "@/lib/auth/server-session";
import {
  getBusinessStatusCounts,
  listBusinesses
} from "@/lib/repository/businesses";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type BusinessesPageProps = {
  searchParams?: {
    status?: string;
    search?: string;
    page?: string;
  };
};

function buildPageHref(search: string | undefined, status: string, page: number) {
  const params = new URLSearchParams();

  if (search?.trim()) {
    params.set("search", search.trim());
  }

  if (status && status !== "all") {
    params.set("status", status);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/admin/businesses?${query}` : "/admin/businesses";
}

export default async function BusinessesPage({
  searchParams
}: BusinessesPageProps) {
  const session = await requireServerSession();
  const status = searchParams?.status ?? "all";
  const search = searchParams?.search ?? "";
  const page = Math.max(Number.parseInt(searchParams?.page ?? "1", 10) || 1, 1);
  const offset = (page - 1) * PAGE_SIZE;

  const emptyResult = {
    businesses: [],
    total: 0
  };

  const emptyCounts = {
    total: 0,
    active: 0,
    paused: 0,
    planning: 0,
    archived: 0
  };

  const businessIds = session.role === "admin" ? session.businessIds : undefined;

  const [{ businesses, total }, counts] = session.organizationId
    ? await Promise.all([
        listBusinesses(session.organizationId, {
          status,
          search,
          limit: PAGE_SIZE,
          offset,
          businessIds
        }),
        getBusinessStatusCounts(session.organizationId, businessIds)
      ])
    : [emptyResult, emptyCounts];

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Team · Businesses"
        title="Every business you run."
        description="Each business gets its own agents, workflows, and knowledge. Switch between them or deploy a new one from a template."
        action={
          <Button asChild>
            <Link href="/admin/businesses/create">New Business</Link>
          </Button>
        }
      />

      <BusinessesFilterBar
        initialSearch={search}
        currentStatus={status}
        counts={counts}
      />

      {businesses.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No businesses yet"
          description="Create your first business to start building AI-powered operations."
          action={
            <Button asChild>
              <Link href="/admin/businesses/create">Create Business</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            {businesses.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>

          {total > PAGE_SIZE ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-line-subtle bg-bg-surface px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-ink-secondary">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-3">
                <Button
                  asChild
                  variant="outline"
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                >
                  <Link href={buildPageHref(search, status, page - 1)}>Previous</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className={
                    page >= totalPages ? "pointer-events-none opacity-50" : ""
                  }
                >
                  <Link href={buildPageHref(search, status, page + 1)}>Next</Link>
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
