"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { KnowledgeManager } from "@/components/admin/knowledge/KnowledgeManager";

type KnowledgePageClientProps = {
  businesses: Array<{
    id: string;
    name: string;
  }>;
  selectedBusinessId: string | null;
  items: Array<{
    id: string;
    businessId: string;
    category: string;
    title: string;
    content: string;
    sourceType: string;
    enabled: boolean;
    tokenCount: number | null;
    updatedAt: Date | string;
  }>;
};

export function KnowledgePageClient({
  businesses,
  selectedBusinessId,
  items
}: KnowledgePageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function handleBusinessChange(businessId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("businessId", businessId);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <KnowledgeManager
      businesses={businesses}
      businessId={selectedBusinessId}
      items={items}
      onBusinessChange={handleBusinessChange}
      showSummary
      showMobileFab
    />
  );
}
