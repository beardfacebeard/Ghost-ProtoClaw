/**
 * Unicode-safe string utilities for prompts and other LLM-bound text.
 *
 * JavaScript strings are sequences of UTF-16 code units. Characters outside
 * the BMP (most emoji, many CJK extensions, etc.) are encoded as a pair of
 * surrogate code units — a high surrogate (0xD800–0xDBFF) followed by a low
 * surrogate (0xDC00–0xDFFF). A plain `str.slice(0, 160)` will happily cut
 * right between the two halves, leaving a lone high surrogate that is not a
 * valid Unicode scalar value.
 *
 * Anthropic's API rejects such strings outright with:
 *
 *   invalid_request_error: "The request body is not valid JSON: no low
 *   surrogate in string: line 1 column N"
 *
 * …because the JSON serializer encodes the orphan surrogate as a \uD8XX
 * escape that the server-side parser then refuses to accept. OpenAI is more
 * forgiving and usually replaces it with the U+FFFD replacement character,
 * but "works on OpenAI" isn't good enough when the Anthropic path is the
 * one the user just hit a 400 on.
 *
 * safeTrim and safeEllipsize below never split a surrogate pair, so any
 * prompt snippet or display string they produce is guaranteed to serialize.
 */

/**
 * Return a prefix of `s` that is at most `maxCodeUnits` UTF-16 code units,
 * never ending on an orphan high surrogate. If the cut would split a pair,
 * the final code unit is dropped so only complete characters survive.
 */
export function safeTrim(s: string, maxCodeUnits: number): string {
  if (s.length <= maxCodeUnits) return s;
  const cut = s.slice(0, maxCodeUnits);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) {
    return cut.slice(0, -1);
  }
  return cut;
}

/**
 * Same as safeTrim but appends an ellipsis when any characters are dropped.
 * `marker` defaults to a horizontal-ellipsis character but callers can pass
 * "..." for ASCII-only contexts.
 */
export function safeEllipsize(
  s: string,
  maxCodeUnits: number,
  marker = "…"
): string {
  if (s.length <= maxCodeUnits) return s;
  return safeTrim(s, maxCodeUnits) + marker;
}
