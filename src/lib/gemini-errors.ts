/**
 * Maps errors thrown by the `@google/genai` SDK (and a handful of
 * locally-synthesized error conditions, like safety blocks) to a short,
 * human-readable message plus an HTTP status the API route can return.
 *
 * The SDK's `ApiError` (see `@google/genai`'s `throwErrorIfNotOK`) carries a
 * numeric `status` and a `message` that is the *entire* Gemini error body
 * JSON-stringified, e.g.:
 *
 *   {"error":{"code":429,"message":"...","status":"RESOURCE_EXHAUSTED",
 *     "details":[
 *       {"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[...]},
 *       {"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"49s"}
 *     ]}}
 *
 * This module is a pure function over that shape (or any other `Error`), so
 * it can be unit tested without hitting the live Gemini API.
 */

import { FinishReason } from '@google/genai';

export type GeminiErrorKind =
  | 'daily_quota_exceeded'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'invalid_api_key'
  | 'permission_denied'
  | 'safety_blocked'
  | 'unavailable'
  | 'timeout'
  | 'unknown';

export interface MappedGeminiError {
  /** HTTP status code the API route should respond with. */
  status: number;
  /** Plain-English, user-facing message. Never contains SDK/API internals. */
  message: string;
  /** Machine-readable category, for callers that want to branch on it. */
  kind: GeminiErrorKind;
  /** Seconds the upstream API suggested waiting before retrying, if known. */
  retryDelaySeconds?: number;
}

interface QuotaViolation {
  quotaId?: string;
  quotaMetric?: string;
  [key: string]: unknown;
}

interface GoogleErrorDetail {
  '@type'?: string;
  violations?: QuotaViolation[];
  retryDelay?: string;
  reason?: string;
  [key: string]: unknown;
}

interface GoogleErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: GoogleErrorDetail[];
  };
}

/**
 * Thrown by the route when Gemini returns a response that was blocked by
 * safety filters (no generated image, but also no transport-level error).
 * Routing this through the same catch block keeps a single mapping function
 * as the source of truth for user-facing copy.
 */
export class GeminiSafetyBlockError extends Error {
  constructor(reason: string) {
    super(`Content blocked by Gemini safety filters: ${reason}`);
    this.name = 'GeminiSafetyBlockError';
  }
}

/**
 * Thrown by the route when `GOOGLE_GENERATIVE_AI_API_KEY` isn't configured.
 * This is a server misconfiguration, not a transport-level SDK error, but it
 * should read exactly like the "invalid API key" case to the user - routing
 * it through the same catch block and mapping function keeps that wording in
 * one place instead of duplicating it.
 */
export class GeminiMissingApiKeyError extends Error {
  constructor() {
    super('GOOGLE_GENERATIVE_AI_API_KEY is not configured');
    this.name = 'GeminiMissingApiKeyError';
  }
}

const INVALID_API_KEY_ERROR: Omit<MappedGeminiError, 'retryDelaySeconds'> = {
  status: 500,
  kind: 'invalid_api_key',
  message: "The image editor isn't configured with a valid Gemini API key. Please contact the site owner to fix the configuration.",
};

// Finish reasons that mean "the model refused/blocked the output", as opposed
// to reasons like STOP, MAX_TOKENS, RECITATION, LANGUAGE, or a tool-call
// failure. Sourced from the SDK's own `FinishReason` enum (rather than a
// hand-typed list of strings) so a future SDK upgrade that adds another
// safety-style reason shows up here as a type-level option instead of
// silently falling through as a false "success".
const SAFETY_FINISH_REASONS = new Set<string>([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.IMAGE_SAFETY,
]);

interface GenerateContentResponseLike {
  promptFeedback?: { blockReason?: string | null } | null;
  candidates?: Array<{ finishReason?: string | null }> | null;
}

/**
 * Gemini doesn't throw when it blocks a response - it returns a normal 200
 * with `promptFeedback.blockReason` and/or a `finishReason` on the (empty)
 * candidate instead. A generated image can be missing for other reasons too
 * (e.g. a text-only reply), so this only counts as a block when there's also
 * no generated image.
 *
 * Returns a `GeminiSafetyBlockError` to throw (routing the block through the
 * same catch-block mapping as any other failure), or `null` if the response
 * looks fine.
 */
export function detectSafetyBlock(
  response: GenerateContentResponseLike,
  hasGeneratedImage: boolean
): GeminiSafetyBlockError | null {
  if (hasGeneratedImage) return null;

  const blockReason = response.promptFeedback?.blockReason;
  const finishReason = response.candidates?.[0]?.finishReason;

  if (blockReason || (finishReason && SAFETY_FINISH_REASONS.has(finishReason))) {
    return new GeminiSafetyBlockError(String(blockReason ?? finishReason));
  }

  return null;
}

function tryParseGoogleErrorBody(message: string): GoogleErrorBody | null {
  try {
    const parsed: unknown = JSON.parse(message);
    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      return parsed as GoogleErrorBody;
    }
  } catch {
    // Not JSON. Most non-API errors (network issues, SDK validation, etc.)
    // have a plain string message, which is expected.
  }
  return null;
}

function parseRetryDelaySeconds(details: GoogleErrorDetail[] | undefined): number | undefined {
  const retryInfo = details?.find((detail) => detail['@type']?.includes('RetryInfo'));
  const raw = retryInfo?.retryDelay;
  if (typeof raw !== 'string') return undefined;
  const match = raw.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Math.ceil(parseFloat(match[1])) : undefined;
}

function getQuotaViolations(details: GoogleErrorDetail[] | undefined): QuotaViolation[] {
  const quotaFailure = details?.find((detail) => detail['@type']?.includes('QuotaFailure'));
  return quotaFailure?.violations ?? [];
}

function retrySuffix(retryDelaySeconds: number | undefined): string {
  if (!retryDelaySeconds) return '';
  const unit = retryDelaySeconds === 1 ? 'second' : 'seconds';
  return ` The API suggested waiting about ${retryDelaySeconds} ${unit} before trying again.`;
}

/**
 * Maps a caught error (or a `GeminiSafetyBlockError`) to a user-facing
 * status + message. Never includes API keys, credentials, or raw SDK/API
 * payloads in the returned message — those should only go to
 * `console.error` by the caller.
 */
export function mapGeminiError(error: unknown): MappedGeminiError {
  const err = error instanceof Error ? error : new Error(String(error));
  const rawMessage = err.message ?? '';

  if (err.name === 'GeminiSafetyBlockError') {
    return {
      status: 400,
      kind: 'safety_blocked',
      message:
        "Gemini declined to process this request because it was flagged by its safety filters. Try a different image, or rephrase your instructions.",
    };
  }

  if (err.name === 'GeminiMissingApiKeyError') {
    return { ...INVALID_API_KEY_ERROR };
  }

  // Timeouts: an aborted fetch (AbortError), or Node's low-level timeout codes.
  if (err.name === 'AbortError' || /\betimedout\b|\btimed out\b/i.test(rawMessage)) {
    return {
      status: 504,
      kind: 'timeout',
      message:
        'The request to Nano Banana timed out. Please try again — a smaller image or a simpler instruction may help.',
    };
  }

  const sdkStatus = (error as { status?: number } | null | undefined)?.status;
  const body = tryParseGoogleErrorBody(rawMessage);
  const apiStatus = body?.error?.status;
  const httpCode = body?.error?.code ?? sdkStatus;
  const details = body?.error?.details;
  const retryDelaySeconds = parseRetryDelaySeconds(details);

  // Quota / rate limiting.
  if (httpCode === 429 || apiStatus === 'RESOURCE_EXHAUSTED') {
    const violations = getQuotaViolations(details);
    const isDaily = violations.some((violation) => /perday/i.test(String(violation.quotaId ?? '')));
    const isPerMinute = violations.some((violation) => /perminute/i.test(String(violation.quotaId ?? '')));
    const suffix = retrySuffix(retryDelaySeconds);

    if (isDaily) {
      // Deliberately omit the retry-delay sentence (and the field itself)
      // here: RetryInfo.retryDelay is a short backoff hint (seconds), but a
      // *daily* quota won't have reset by then - surfacing it would produce
      // self-contradictory advice like "quota exhausted for today... try
      // again in 49 seconds".
      return {
        status: 429,
        kind: 'daily_quota_exceeded',
        message: 'This demo has used up its Gemini API quota for today. Please try again later once the quota resets.',
      };
    }

    if (isPerMinute) {
      return {
        status: 429,
        kind: 'rate_limited',
        retryDelaySeconds,
        message: `You're sending requests a little too fast. Please wait a moment and try again.${suffix}`,
      };
    }

    return {
      status: 429,
      kind: 'quota_exceeded',
      retryDelaySeconds,
      message: `Nano Banana is temporarily out of capacity due to usage limits. Please try again in a little while.${suffix}`,
    };
  }

  // Invalid / missing API key.
  if (
    apiStatus === 'API_KEY_INVALID' ||
    (httpCode === 400 && /api key not valid/i.test(rawMessage)) ||
    /api[_ ]key[_ ]invalid/i.test(rawMessage)
  ) {
    return { ...INVALID_API_KEY_ERROR };
  }

  // Permission denied (key lacks access, API not enabled, etc.).
  if (httpCode === 401 || httpCode === 403 || apiStatus === 'PERMISSION_DENIED') {
    return {
      status: 500,
      kind: 'permission_denied',
      message: "Access to the Gemini API was denied. Please contact the site owner to check the API key's permissions.",
    };
  }

  // Upstream 5xx / model overloaded.
  if (httpCode === 503 || apiStatus === 'UNAVAILABLE') {
    return {
      status: 503,
      kind: 'unavailable',
      message: 'Nano Banana is temporarily overloaded or unavailable. Please try again in a moment.',
    };
  }

  if (typeof httpCode === 'number' && httpCode >= 500) {
    return {
      status: 503,
      kind: 'unavailable',
      message: 'Nano Banana is temporarily unavailable. Please try again in a moment.',
    };
  }

  return {
    status: 500,
    kind: 'unknown',
    message: 'Something went wrong while processing your image. Please try again in a moment.',
  };
}
