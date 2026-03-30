const knowledgeCategories = {
  about_business: "About the Business",
  products_services: "Products & Services",
  pricing: "Pricing & Packages",
  policies: "Policies & Terms",
  faqs: "FAQs",
  contacts: "Key Contacts",
  brand_voice: "Brand Voice & Tone",
  processes: "Processes & SOPs",
  custom: "Custom"
} as const;

export const KNOWLEDGE_CATEGORIES = knowledgeCategories;

export type KnowledgeCategoryKey = keyof typeof KNOWLEDGE_CATEGORIES;

export const KNOWLEDGE_CATEGORY_OPTIONS: Array<{
  value: KnowledgeCategoryKey;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: "about_business",
    label: KNOWLEDGE_CATEGORIES.about_business,
    shortLabel: "About",
    description: "Core facts about the business, mission, audience, and positioning."
  },
  {
    value: "products_services",
    label: KNOWLEDGE_CATEGORIES.products_services,
    shortLabel: "Products & Services",
    description: "What the business sells, how it works, and who it helps."
  },
  {
    value: "pricing",
    label: KNOWLEDGE_CATEGORIES.pricing,
    shortLabel: "Pricing",
    description: "Packages, pricing ranges, discounts, and offer structure."
  },
  {
    value: "policies",
    label: KNOWLEDGE_CATEGORIES.policies,
    shortLabel: "Policies",
    description: "Rules, terms, refund policies, service boundaries, and compliance notes."
  },
  {
    value: "faqs",
    label: KNOWLEDGE_CATEGORIES.faqs,
    shortLabel: "FAQs",
    description: "Frequently asked questions with direct, reusable answers."
  },
  {
    value: "contacts",
    label: KNOWLEDGE_CATEGORIES.contacts,
    shortLabel: "Contacts",
    description: "Important internal and external contacts the agents should recognize."
  },
  {
    value: "brand_voice",
    label: KNOWLEDGE_CATEGORIES.brand_voice,
    shortLabel: "Brand Voice",
    description: "Voice, tone, phrasing preferences, and positioning rules."
  },
  {
    value: "processes",
    label: KNOWLEDGE_CATEGORIES.processes,
    shortLabel: "Processes",
    description: "Operational steps, SOPs, and internal decision rules."
  },
  {
    value: "custom",
    label: KNOWLEDGE_CATEGORIES.custom,
    shortLabel: "Custom",
    description: "Anything useful that does not fit a standard category."
  }
];

export function formatKnowledgeCategory(category: string) {
  return (
    KNOWLEDGE_CATEGORIES[category as KnowledgeCategoryKey] ??
    category
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function estimateTokenCount(content: string) {
  const normalized = content.trim();
  if (normalized.length === 0) {
    return 0;
  }

  return Math.ceil(normalized.length / 4);
}
