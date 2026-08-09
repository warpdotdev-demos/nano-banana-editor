import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GeminiMissingApiKeyError, GeminiSafetyBlockError, detectSafetyBlock, mapGeminiError } from './gemini-errors';

/** Mimics `@google/genai`'s `ApiError`: an `Error` with a numeric `status`. */
function apiError(status: number, message: string): Error & { status: number } {
  const error = new Error(message);
  error.name = 'ApiError';
  return Object.assign(error, { status });
}

// The verbatim payload the requester saw in production, reproduced from a
// live 429 response body (see the PR description). Both a per-minute and a
// per-day quota violation are present, plus a RetryInfo.retryDelay.
const QUOTA_EXCEEDED_MESSAGE = JSON.stringify({
  error: {
    code: 429,
    message:
      'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-2.5-flash-preview-image\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-2.5-flash-preview-image',
    status: 'RESOURCE_EXHAUSTED',
    details: [
      {
        '@type': 'type.googleapis.com/google.rpc.Help',
        links: [
          {
            description: 'Learn more about Gemini API quotas',
            url: 'https://ai.google.dev/gemini-api/docs/rate-limits',
          },
        ],
      },
      {
        '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
        violations: [
          {
            quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
            quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
            quotaDimensions: { model: 'gemini-2.5-flash-preview-image', location: 'global' },
            quotaValue: '0',
          },
          {
            quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
            quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
            quotaDimensions: { model: 'gemini-2.5-flash-preview-image', location: 'global' },
            quotaValue: '0',
          },
        ],
      },
      {
        '@type': 'type.googleapis.com/google.rpc.RetryInfo',
        retryDelay: '49s',
      },
    ],
  },
});

test('maps the verbatim quota-exceeded payload to a friendly daily-quota message without a misleading retry delay', () => {
  const result = mapGeminiError(apiError(429, QUOTA_EXCEEDED_MESSAGE));

  assert.equal(result.status, 429);
  assert.equal(result.kind, 'daily_quota_exceeded');
  // The fixture's RetryInfo.retryDelay (49s) is a short backoff hint that
  // does not apply to a *daily* quota - surfacing "try again in 49 seconds"
  // here would contradict "quota exhausted for today", so it must not appear.
  assert.equal(result.retryDelaySeconds, undefined);
  assert.doesNotMatch(result.message, /RESOURCE_EXHAUSTED|generativelanguage\.googleapis\.com|@type/);
  assert.doesNotMatch(result.message, /49 seconds|retryDelay|suggested waiting/i);
  assert.match(result.message, /quota for today/i);
});

test('maps a per-minute-only rate limit to a distinct "slow down" message', () => {
  const message = JSON.stringify({
    error: {
      code: 429,
      message: 'Rate limit exceeded',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [
            {
              quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
            },
          ],
        },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '5s' },
      ],
    },
  });

  const result = mapGeminiError(apiError(429, message));

  assert.equal(result.status, 429);
  assert.equal(result.kind, 'rate_limited');
  assert.equal(result.retryDelaySeconds, 5);
  assert.match(result.message, /too fast/i);
});

test('rounds a decimal retry delay up to the nearest whole second', () => {
  // 4.40179684s is a real observed RetryInfo.retryDelay value.
  const message = JSON.stringify({
    error: {
      code: 429,
      message: 'Rate limit exceeded',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }],
        },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '4.40179684s' },
      ],
    },
  });

  const result = mapGeminiError(apiError(429, message));

  assert.equal(result.kind, 'rate_limited');
  assert.equal(result.retryDelaySeconds, 5);
  assert.match(result.message, /5 seconds/);
});

test('maps a 429 with no quota violation details to a generic quota-exceeded message', () => {
  const message = JSON.stringify({
    error: { code: 429, message: 'quota exceeded', status: 'RESOURCE_EXHAUSTED' },
  });

  const result = mapGeminiError(apiError(429, message));

  assert.equal(result.status, 429);
  assert.equal(result.kind, 'quota_exceeded');
  assert.equal(result.retryDelaySeconds, undefined);
});

test('maps an invalid API key error without leaking the key', () => {
  const message = JSON.stringify({
    error: {
      code: 400,
      message: 'API key not valid. Please pass a valid API key.',
      status: 'INVALID_ARGUMENT',
    },
  });

  const result = mapGeminiError(apiError(400, message));

  assert.equal(result.status, 500);
  assert.equal(result.kind, 'invalid_api_key');
  assert.match(result.message, /contact the site owner/i);
  assert.doesNotMatch(result.message, /API key not valid/);
});

test('maps a 401 permission error to a permission-denied message', () => {
  const message = JSON.stringify({
    error: { code: 401, message: 'Request had invalid authentication credentials.', status: 'UNAUTHENTICATED' },
  });

  const result = mapGeminiError(apiError(401, message));

  assert.equal(result.status, 500);
  assert.equal(result.kind, 'permission_denied');
});

test('maps a 403 PERMISSION_DENIED error to a permission-denied message', () => {
  const message = JSON.stringify({
    error: { code: 403, message: 'Permission denied on resource project.', status: 'PERMISSION_DENIED' },
  });

  const result = mapGeminiError(apiError(403, message));

  assert.equal(result.status, 500);
  assert.equal(result.kind, 'permission_denied');
});

test('maps a safety block to a 400 with actionable copy', () => {
  const result = mapGeminiError(new GeminiSafetyBlockError('SAFETY'));

  assert.equal(result.status, 400);
  assert.equal(result.kind, 'safety_blocked');
  assert.match(result.message, /safety filters/i);
});

test('maps a missing API key configuration error the same way as an invalid key, without leaking env var names', () => {
  const result = mapGeminiError(new GeminiMissingApiKeyError());

  assert.equal(result.status, 500);
  assert.equal(result.kind, 'invalid_api_key');
  assert.match(result.message, /contact the site owner/i);
  assert.doesNotMatch(result.message, /GOOGLE_GENERATIVE_AI_API_KEY/);
});

test('detectSafetyBlock treats an IMAGE_SAFETY finish reason with no image as a safety block', () => {
  // Reproduces the route.ts response shape for a generated-image safety
  // block: a 200 response with a candidate but no inlineData part, so
  // generatedImageData is null and finishReason is IMAGE_SAFETY (no
  // promptFeedback.blockReason is set for this case).
  const response = { candidates: [{ finishReason: 'IMAGE_SAFETY' }] };

  const block = detectSafetyBlock(response, false);
  assert.ok(block instanceof GeminiSafetyBlockError);

  const mapped = mapGeminiError(block);
  assert.equal(mapped.status, 400);
  assert.equal(mapped.kind, 'safety_blocked');
});

test('detectSafetyBlock ignores a blocked-sounding finish reason when an image was actually generated', () => {
  const response = { candidates: [{ finishReason: 'IMAGE_SAFETY' }] };

  assert.equal(detectSafetyBlock(response, true), null);
});

test('detectSafetyBlock returns null for an ordinary STOP finish reason', () => {
  const response = { candidates: [{ finishReason: 'STOP' }] };

  assert.equal(detectSafetyBlock(response, false), null);
});

test('maps a 503 UNAVAILABLE error to an overloaded message', () => {
  const message = JSON.stringify({
    error: { code: 503, message: 'The model is overloaded. Please try again later.', status: 'UNAVAILABLE' },
  });

  const result = mapGeminiError(apiError(503, message));

  assert.equal(result.status, 503);
  assert.equal(result.kind, 'unavailable');
});

test('maps an AbortError to a timeout message', () => {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';

  const result = mapGeminiError(error);

  assert.equal(result.status, 504);
  assert.equal(result.kind, 'timeout');
});

test('falls back to a generic message for unrecognized errors without leaking internals', () => {
  const result = mapGeminiError(new Error('some obscure internal SDK failure with a stack trace'));

  assert.equal(result.status, 500);
  assert.equal(result.kind, 'unknown');
  assert.doesNotMatch(result.message, /stack trace|SDK/);
});

test('handles non-Error thrown values gracefully', () => {
  const result = mapGeminiError('a plain string was thrown');

  assert.equal(result.status, 500);
  assert.equal(result.kind, 'unknown');
});
