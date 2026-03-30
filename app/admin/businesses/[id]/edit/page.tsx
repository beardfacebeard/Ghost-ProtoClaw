import { notFound } from "next/navigation";

import { BusinessEditClient } from "@/components/admin/businesses/BusinessEditClient";
import { db } from "@/lib/db";
import { requireServerSession } from "@/lib/auth/server-session";

export const dynamic = "force-dynamic";

type EditBusinessPageProps = {
  params: {
    id: string;
  };
};

export default async function EditBusinessPage({
  params
}: EditBusinessPageProps) {
  const session = await requireServerSession();

  if (
    session.role === "admin" &&
    !session.businessIds.includes(params.id)
  ) {
    notFound();
  }

  if (!session.organizationId) {
    notFound();
  }

  const business = await db.business.findFirst({
    where: {
      id: params.id,
      organizationId: session.organizationId
    }
  });

  if (!business) {
    notFound();
  }

  return (
    <BusinessEditClient
      businessId={business.id}
      businessName={business.name}
      defaultValues={{
        name: business.name,
        summary: business.summary ?? "",
        brandVoice: business.brandVoice ?? "",
        mainGoals: business.mainGoals ?? "",
        coreOffers: business.coreOffers ?? "",
        offerAndAudienceNotes: business.offerAndAudienceNotes ?? "",
        systemPrompt: business.systemPrompt ?? "",
        guardrails: business.guardrails ?? "",
        bannedClaims: business.bannedClaims ?? "",
        safetyMode: business.safetyMode ?? "ask_before_acting",
        primaryModel: business.primaryModel ?? "",
        fallbackModel: business.fallbackModel ?? "",
        status: business.status
      }}
    />
  );
}
