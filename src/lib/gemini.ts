import type { GoogleGenAI } from '@google/genai';

// Ordered by measured latency on free-tier keys (2026-07): flash-lite ~1.4s,
// 2.5-flash ~0.7s, 3.5-flash often congested (503s / 15s+ responses) so it is
// the last resort. All three have free-tier quota (pro models have none).
const MODELS = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-3.5-flash'];

const RETRYABLE = /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|high demand/i;
const CONFIG_REJECTED = /INVALID_ARGUMENT|\b400\b/i;

interface GenerateOptions {
  /** Ask the API for a JSON response body (skips markdown fences). */
  json?: boolean;
}

export async function generateContentWithFallback(ai: GoogleGenAI, prompt: string, opts: GenerateOptions = {}) {
  // Disable "thinking": these are short extraction/summary tasks and thinking
  // multiplies latency on flash models.
  const config = {
    thinkingConfig: { thinkingBudget: 0 },
    ...(opts.json ? { responseMimeType: 'application/json' } : {})
  };

  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      return await ai.models.generateContent({ model, contents: prompt, config });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (CONFIG_REJECTED.test(msg)) {
        // Model rejected the config (e.g. thinking budget unsupported): retry
        // the same model without it before falling through.
        try {
          return await ai.models.generateContent({ model, contents: prompt });
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          if (!RETRYABLE.test(retryMsg)) throw retryErr;
          lastErr = retryErr;
          continue;
        }
      }
      if (!RETRYABLE.test(msg)) throw err;
      console.warn(`Gemini model ${model} unavailable (quota/load), trying next fallback`);
      lastErr = err;
    }
  }
  throw lastErr;
}
