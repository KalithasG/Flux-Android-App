import { auth } from '../firebase';

// All Gemini calls go through the Flux Chat Worker (`POST /ai`), authenticated
// with the caller's Firebase ID token. The API key lives only as a Worker
// secret — it must never appear in a client bundle (web or APK), which is why
// this module deliberately has no direct dependency on the Gemini API.
// The Worker owns the model-fallback chain and thinking/JSON config.

const PROXY_URL = (import.meta.env.VITE_AI_PROXY_URL as string | undefined)?.replace(/\/$/, '');

interface GenerateOptions {
  /** Ask for a JSON response body (skips markdown fences). */
  json?: boolean;
}

export async function generateContent(prompt: string, opts: GenerateOptions = {}): Promise<{ text: string }> {
  if (!PROXY_URL) throw new Error('AI is not configured (VITE_AI_PROXY_URL missing).');
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to use AI features.');

  const idToken = await user.getIdToken();
  const res = await fetch(`${PROXY_URL}/ai`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, json: !!opts.json }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  return await res.json();
}
