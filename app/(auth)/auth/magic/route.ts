import { NextRequest } from "next/server";

import {
  handleMagicLinkGet,
  handleMagicLinkPost
} from "@/lib/auth/magic-route";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleMagicLinkGet(request);
}

export async function POST(request: NextRequest) {
  return handleMagicLinkPost(request);
}
