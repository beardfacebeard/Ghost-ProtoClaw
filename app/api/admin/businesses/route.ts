import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { db } from "@/lib/db";
import { apiErrorResponse, badRequest, forbidden, unauthorized } from "@/lib/errors";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import {
  createBusiness,
  listBusinesses
} from "@/lib/repository/businesses";
import { businessCreateApiSchema } from "@/components/admin/businesses/schema";
import {
  canUserAccessTemplate,
  getBusinessTemplateById,
  materializeTemplate
} from "@/lib/templates/business-templates";

const listQuerySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

function applyBusinessName(
  template: string,
  businessName: string,
  affiliateLink?: string
) {
  return template
    .replaceAll("{{businessName}}", businessName)
    .replaceAll(
      "{{affiliateLink}}",
      affiliateLink ?? "https://tiptaxrefund.org/9fpc"
    );
}

function mapHandsOnPreferenceToSafetyMode(value?: string) {
  switch (value) {
    case "ask_first":
      return "ask_before_acting";
    case "autonomous":
      return "full_auto";
    case "balanced":
    default:
      return "auto_low_risk";
  }
}

function buildBusinessBuilderDefaults(
  input: z.infer<typeof businessCreateApiSchema>
) {
  const answers = input.templateAnswers;
  const offerAndAudienceNotes =
    input.offerAndAudienceNotes ||
    (answers?.idealCustomers
      ? `Ideal customers: ${answers.idealCustomers}`.trim()
      : undefined);

  return {
    summary: input.summary || answers?.businessDescription,
    brandVoice:
      input.brandVoice || "Clear, supportive, practical, and easy to trust.",
    mainGoals: input.mainGoals || answers?.mainGoalsRightNow,
    offerAndAudienceNotes,
    bannedClaims: input.bannedClaims || answers?.neverSayOrDo,
    safetyMode:
      input.safetyMode ||
      mapHandsOnPreferenceToSafetyMode(answers?.handsOnPreference),
    systemPrompt:
      input.systemPrompt ||
      `You are the main operating agent for ${input.name}. Support the business clearly, explain actions in plain language, and prioritize what matters most right now.`,
    guardrails:
      input.guardrails ||
      `Never make guarantees, legal claims, or policy exceptions for ${input.name}. Escalate anything customer-facing or high impact before it goes out.`
  };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const parsedQuery = listQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );

    const result = await listBusinesses(session.organizationId, {
      status: parsedQuery.status,
      search: parsedQuery.search,
      limit: parsedQuery.limit,
      offset: parsedQuery.offset,
      businessIds: session.role === "admin" ? session.businessIds : undefined
    });

    return addSecurityHeaders(
      NextResponse.json({
        businesses: result.businesses,
        total: result.total
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const body = businessCreateApiSchema.parse(await request.json());
    const template = getBusinessTemplateById(body.templateId || "blank");

    if (!template && body.templateId) {
      throw badRequest("Unknown business template.");
    }

    // Private/unlisted templates are gated by ownerEmail — the selector UI
    // hides them client-side, but the server is the authoritative gate in
    // case someone posts a templateId directly.
    if (template && !canUserAccessTemplate(template, session.email)) {
      throw forbidden("You do not have access to this template.");
    }

    // Regulated templates require jurisdiction declaration up front — this is
    // an airtight gate, not a recommendation. Client-side validation in
    // validateBusinessDetailsStep enforces the same rule for UX, but the
    // server is the source of truth.
    if (body.templateId === "forex_trading_desk") {
      const allowed = ["US", "UK", "EU", "AU", "CA", "SG", "JP", "OTHER"];
      if (!body.jurisdiction || !allowed.includes(body.jurisdiction)) {
        throw badRequest(
          "The Forex Research & Execution Desk requires a declared jurisdiction (US, UK, EU, AU, CA, SG, JP, or OTHER) before it can be created."
        );
      }
    }

    const builderDefaults =
      body.templateId === "business_builder"
        ? buildBusinessBuilderDefaults(body)
        : undefined;

    // Affiliate link — optional per-business override. Only
    // tiptax_affiliate_engine uses it today; other templates ignore it but
    // accept it for forward-compat. Falls back to the TipTax default when
    // unset, which is baked into applyContext / applyBusinessName.
    const affiliateLink =
      typeof body.affiliateLink === "string" && body.affiliateLink.trim().length > 0
        ? body.affiliateLink.trim()
        : undefined;

    const created = await createBusiness({
      organizationId: session.organizationId,
      name: body.name,
      summary:
        builderDefaults?.summary ||
        body.summary ||
        template?.defaults.summary,
      brandVoice:
        builderDefaults?.brandVoice ||
        body.brandVoice ||
        template?.defaults.brandVoice,
      mainGoals:
        builderDefaults?.mainGoals ||
        body.mainGoals ||
        template?.defaults.mainGoals,
      coreOffers: body.coreOffers || template?.defaults.coreOffers,
      systemPrompt:
        builderDefaults?.systemPrompt ||
        body.systemPrompt ||
        (template?.systemPromptTemplate
          ? applyBusinessName(template.systemPromptTemplate, body.name, affiliateLink)
          : undefined),
      guardrails:
        builderDefaults?.guardrails ||
        body.guardrails ||
        (template?.guardrailsTemplate
          ? applyBusinessName(template.guardrailsTemplate, body.name, affiliateLink)
          : undefined),
      offerAndAudienceNotes:
        builderDefaults?.offerAndAudienceNotes ||
        body.offerAndAudienceNotes ||
        template?.defaults.offerAndAudienceNotes,
      bannedClaims: builderDefaults?.bannedClaims || body.bannedClaims,
      safetyMode:
        builderDefaults?.safetyMode ||
        body.safetyMode ||
        template?.defaults.safetyMode,
      primaryModel: body.primaryModel || template?.defaults.primaryModel,
      fallbackModel: body.fallbackModel,
      jurisdiction: body.jurisdiction,
      // tradingMode is NEVER taken from user input at create time. The Prisma
      // default ("research") is authoritative — repository ignores any
      // tradingMode passed in the create call.
      config: {
        templateId: template?.id ?? "blank",
        templateAnswers: body.templateAnswers ?? null,
        ...(affiliateLink ? { affiliateLink } : {})
      },
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    const materialized =
      template && template.id !== "blank"
        ? await materializeTemplate(template, {
            businessId: created.id,
            businessName: created.name,
            organizationId: created.organizationId,
            affiliateLink
          })
        : {
            agents: [],
            workflows: [],
            knowledgeItems: [],
            workspaceDocs: []
          };

    const response = NextResponse.json({
      business: created,
      materialized: {
        agents: materialized.agents.length,
        workflows: materialized.workflows.length,
        knowledgeItems: materialized.knowledgeItems.length,
        workspaceDocs: materialized.workspaceDocs.length
      }
    });

    if (session.role === "admin" && !session.businessIds.includes(created.id)) {
      const nextBusinessIds = [...session.businessIds, created.id];

      await db.missionControlAdminUser.update({
        where: {
          id: session.userId
        },
        data: {
          businessIds: nextBusinessIds
        }
      });

      const token = await createSession({
        userId: session.userId,
        email: session.email,
        role: session.role,
        organizationId: session.organizationId,
        businessIds: nextBusinessIds,
        planTier: session.planTier
      });

      setSessionCookie(response, token);
    }

    return addSecurityHeaders(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
