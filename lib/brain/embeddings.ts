import { resolveIntegrationCredentials } from "@/lib/integrations/resolve";

/**
 * OpenAI text-embedding-3-small — 1536-dim vectors. Chosen for:
 *   - High quality semantic similarity for retrieval
 *   - Cheap: ~$0.02 / 1M tokens (so embedding one 1,000-token KB item
 *     costs $0.00002)
 *   - Fast: sub-second per call
 *
 * We resolve the OpenAI key via the same resolver the rest of the
 * integrations use (Integration table per-org → env var fallback), so
 * the user can paste their key into /admin/integrations or set
 * OPENAI_API_KEY on Railway — either works.
 */

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;
/** Chars, not tokens — trimmed defensively before an API call so we
 *  never blow up on a huge KB entry. ~8k chars ≈ ~2k tokens, well
 *  under the model's 8k input limit. */
const MAX_INPUT_CHARS = 8000;

export type EmbeddingResult =
  | { success: true; vector: number[]; model: string }
  | { success: false; error: string };

function truncate(text: string): string {
  if (text.length <= MAX_INPUT_CHARS) return text;
  return text.slice(0, MAX_INPUT_CHARS);
}

export async function resolveOpenAiKey(
  organizationId: string | undefined
): Promise<string | null> {
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "openai",
    { api_key: "OPENAI_API_KEY" }
  );
  return creds.api_key || null;
}

/**
 * Embed a single piece of text. Caller is responsible for combining
 * title + content into one prompt-friendly string if that's desired.
 */
export async function embedText(params: {
  text: string;
  organizationId: string | undefined;
}): Promise<EmbeddingResult> {
  const apiKey = await resolveOpenAiKey(params.organizationId);
  if (!apiKey) {
    return {
      success: false,
      error:
        "OpenAI is not configured. Add it under /admin/integrations or set OPENAI_API_KEY on Railway."
    };
  }

  const input = truncate(params.text.trim());
  if (input.length === 0) {
    return { success: false, error: "Cannot embed empty text." };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        success: false,
        error: `OpenAI embeddings ${response.status}: ${body.slice(0, 200)}`
      };
    }
    const data = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
      model?: string;
    };
    const vector = data.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIM) {
      return {
        success: false,
        error: `Unexpected embedding shape (dim=${vector?.length ?? 0}).`
      };
    }
    return {
      success: true,
      vector,
      model: data.model ?? EMBEDDING_MODEL
    };
  } catch (err) {
    return {
      success: false,
      error: `Embedding call failed: ${err instanceof Error ? err.message : "unknown"}`
    };
  }
}

/**
 * Cosine similarity of two same-length vectors. Returns a number in
 * [-1, 1] where higher = more similar. Guards against zero-length
 * vectors (returns 0).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Text used as the input to the embedding call. Combine title +
 * content for richer retrieval signal than content alone.
 */
export function buildEmbeddingInput(item: {
  title: string;
  content: string;
}): string {
  return `${item.title}\n\n${item.content}`.trim();
}
