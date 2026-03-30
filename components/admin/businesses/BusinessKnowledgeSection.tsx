"use client";

import { KnowledgeManager } from "@/components/admin/knowledge/KnowledgeManager";

type BusinessKnowledgeSectionProps = {
  businessId: string;
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

export function BusinessKnowledgeSection({
  businessId,
  items
}: BusinessKnowledgeSectionProps) {
  return (
    <KnowledgeManager
      businessId={businessId}
      items={items}
      showSummary={false}
      emptyDescription="Add pricing, policies, FAQs, and brand guidance so this business stays consistent everywhere."
    />
  );
}
