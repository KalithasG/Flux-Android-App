/**
 * Flux WhatsApp bot — Cloudflare Worker.
 *
 * Receives WhatsApp Cloud API webhooks, verifies their HMAC signature, and
 * lets a linked user log transactions and read budgets/analytics over chat.
 * All replies are service messages inside the user-initiated 24h window, so
 * the bot costs nothing to run. Firestore is reached over REST with a
 * service-account JWT (Admin access — security rules do not apply here, so
 * every handler must check the phone→uid link first).
 */

export interface Env {
  WHATSAPP_TOKEN: string;          // Cloud API access token
  PHONE_NUMBER_ID: string;         // Meta test/business phone number id
  META_APP_SECRET: string;         // for X-Hub-Signature-256 verification
  WEBHOOK_VERIFY_TOKEN: string;    // echoed during Meta webhook setup
  GEMINI_API_KEY: string;
  FIREBASE_SERVICE_ACCOUNT: string; // full service-account JSON
  FIREBASE_PROJECT_ID: string;      // from wrangler.toml [vars]
}

const RATE_LIMIT_PER_HOUR = 30;
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

const CATEGORIES = [
  'Food', 'Transport', 'Health', 'Entertainment', 'Shopping', 'Utilities',
  'Education', 'Rent', 'SIP', 'Electricity', 'Grocery', 'Vegetables',
  'Fruits', 'Debt Given', 'EMI', 'RD', 'FD', 'Savings', 'Emergency fund',
  'Trading', 'Housing Loan', 'Personal Loan', 'Fashion', 'Gold', 'Bonds',
  'Beauty parlour/Haircut', 'Wedding Gifts', 'Festival', 'Other',
  'Salary', 'Freelance', 'Investment', 'Interest', 'Debt Received',
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', AUD: 'A$',
  CAD: 'C$', SGD: 'S$', AED: 'د.إ', SAR: '﷼', CHF: 'CHF', MYR: 'RM',
  LKR: 'Rs', BDT: '৳',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/webhook') return new Response('Not found', { status: 404 });

    if (request.method === 'GET') {
      // Meta verification handshake.
      if (
        url.searchParams.get('hub.mode') === 'subscribe' &&
        url.searchParams.get('hub.verify_token') === env.WEBHOOK_VERIFY_TOKEN
      ) {
        return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
      }
      return new Response('Forbidden', { status: 403 });
    }

    if (request.method === 'POST') {
      const raw = await request.text();
      const signature = request.headers.get('x-hub-signature-256');
      if (!(await verifySignature(raw, signature, env.META_APP_SECRET))) {
        return new Response('Invalid signature', { status: 401 });
      }
      // Ack immediately (Meta retries slow webhooks); process async.
      ctx.waitUntil(handleWebhook(raw, env));
      return new Response('OK', { status: 200 });
    }

    return new Response('Method not allowed', { status: 405 });
  },
};

// ---------------------------------------------------------------------------
// Webhook plumbing
// ---------------------------------------------------------------------------

async function verifySignature(body: string, header: string | null, secret: string): Promise<boolean> {
  if (!header?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = 'sha256=' + toHex(mac);
  // Constant-time comparison.
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

async function handleWebhook(raw: string, env: Env): Promise<void> {
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      // Surface async delivery failures (e.g. 131047 outside the 24h service
      // window) — the send API returns 200 and the real error only arrives
      // here, so without this log a dropped reply is invisible.
      for (const st of change.value?.statuses ?? []) {
        if (st.status === 'failed' || st.errors) {
          console.error('delivery status', st.status, st.recipient_id, JSON.stringify(st.errors ?? []).slice(0, 300));
        }
      }
      for (const msg of change.value?.messages ?? []) {
        if (msg.type !== 'text' || !msg.from || !msg.text?.body) continue;
        try {
          await handleMessage(msg.from, msg.text.body, env);
        } catch (err) {
          console.error('handleMessage failed', String(err));
          await sendText(env, msg.from, 'Something went wrong on my side — please try again in a bit.').catch(() => {});
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Message routing
// ---------------------------------------------------------------------------

async function handleMessage(phone: string, text: string, env: Env): Promise<void> {
  // Rate-limit bump and link lookup are independent — run them in parallel
  // to keep reply latency down.
  const [overLimit, link] = await Promise.all([
    bumpRateLimit(env, phone),
    fsGet(env, `waLinks/${phone}`),
  ]);
  if (overLimit === 'warn') {
    await sendText(env, phone, `You've hit the limit of ${RATE_LIMIT_PER_HOUR} messages per hour. Please try again later.`);
    return;
  }
  if (overLimit === 'drop') return;

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  const linkMatch = lower.match(/^link\s+(\d{6})$/);
  if (linkMatch) {
    await handleLink(env, phone, linkMatch[1]);
    return;
  }

  if (!link?.uid) {
    await sendText(env, phone,
      'This number is not linked to a Flux account yet.\n\n' +
      'Open the Flux app → Settings → WhatsApp → *Link*, then send me the LINK code it gives you.');
    return;
  }
  const uid: string = link.uid;

  if (lower === 'unlink') {
    await fsDelete(env, `waLinks/${phone}`);
    await fsPatch(env, `users/${uid}`, { whatsappNumber: null }, ['whatsappNumber']);
    await sendText(env, phone, 'Unlinked. You can re-link anytime from Flux Settings.');
    return;
  }

  if (['help', 'hi', 'hello', 'menu', 'start'].includes(lower)) {
    await sendText(env, phone, helpText());
    return;
  }

  if (lower === 'summary' || lower === 'balance' || lower.startsWith('summary ') || lower.startsWith('balance ')) {
    const month = parseMonth(trimmed.split(/\s+/).slice(1).join(' '));
    await handleSummary(env, phone, uid, month);
    return;
  }

  if (lower === 'analytics' || lower.startsWith('analytics ')) {
    const month = parseMonth(trimmed.split(/\s+/).slice(1).join(' '));
    await handleAnalytics(env, phone, uid, month);
    return;
  }

  if (lower === 'budget' || lower === 'budgets') {
    await handleBudgetList(env, phone, uid, currentMonth());
    return;
  }

  const budgetMatch = trimmed.match(/^budget\s+(.+?)\s+(\d+(?:\.\d+)?)$/i);
  if (budgetMatch) {
    await handleBudgetSet(env, phone, uid, budgetMatch[1], parseFloat(budgetMatch[2]));
    return;
  }

  // Anything else: try to parse it as a transaction with Gemini.
  await handleFreeform(env, phone, uid, trimmed);
}

function helpText(): string {
  return (
    '*Flux Chat* 🤖\n\n' +
    'Just tell me what you spent or earned:\n' +
    '_"Spent 60 on tea via UPI"_\n' +
    '_"Got salary 50000"_\n\n' +
    'Commands:\n' +
    '• *summary* [month] — income, expenses & net\n' +
    '• *budget* — this month\'s budgets vs spent\n' +
    '• *budget <category> <amount>* — set a budget\n' +
    '• *analytics* [month] — top spending categories\n' +
    '• *unlink* — disconnect this number\n' +
    '• *help* — show this message'
  );
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function handleLink(env: Env, phone: string, code: string): Promise<void> {
  const codeDoc = await fsGet(env, `waLinkCodes/${code}`);
  if (!codeDoc?.uid) {
    await sendText(env, phone, 'That code is not valid. Generate a fresh one from Flux Settings → WhatsApp.');
    return;
  }
  const expiresAt = codeDoc.expiresAt instanceof Date ? codeDoc.expiresAt : new Date(codeDoc.expiresAt);
  if (!(expiresAt.getTime() > Date.now())) {
    await fsDelete(env, `waLinkCodes/${code}`);
    await sendText(env, phone, 'That code has expired. Generate a fresh one from Flux Settings → WhatsApp.');
    return;
  }
  await fsPatch(env, `waLinks/${phone}`, { uid: codeDoc.uid, linkedAt: new Date() });
  await fsPatch(env, `users/${codeDoc.uid}`, { whatsappNumber: phone }, ['whatsappNumber']);
  await fsDelete(env, `waLinkCodes/${code}`);
  await sendText(env, phone, '✅ Linked to your Flux account!\n\n' + helpText());
}

async function handleSummary(env: Env, phone: string, uid: string, month: string): Promise<void> {
  const [txs, sym] = await Promise.all([monthTransactions(env, uid, month), currencySymbol(env, uid)]);
  if (!txs.length) {
    await sendText(env, phone, `No transactions in ${monthLabel(month)} yet.`);
    return;
  }
  let income = 0, expense = 0;
  for (const t of txs) t.type === 'income' ? (income += t.amount) : (expense += t.amount);
  const net = income - expense;
  await sendText(env, phone,
    `*${monthLabel(month)} summary*\n\n` +
    `Income: ${sym}${fmt(income)}\n` +
    `Expenses: ${sym}${fmt(expense)}\n` +
    `Net: ${net >= 0 ? '+' : '-'}${sym}${fmt(Math.abs(net))}\n` +
    `Transactions: ${txs.length}`);
}

async function handleAnalytics(env: Env, phone: string, uid: string, month: string): Promise<void> {
  const [txs, sym] = await Promise.all([monthTransactions(env, uid, month), currencySymbol(env, uid)]);
  const expenses = txs.filter(t => t.type === 'expense');
  if (!expenses.length) {
    await sendText(env, phone, `No expenses in ${monthLabel(month)} yet.`);
    return;
  }
  const byCat = new Map<string, number>();
  let total = 0;
  for (const t of expenses) {
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
    total += t.amount;
  }
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const lines = top.map(([cat, amt], i) =>
    `${i + 1}. ${cat}: ${sym}${fmt(amt)} (${Math.round((amt / total) * 100)}%)`);
  await sendText(env, phone,
    `*${monthLabel(month)} top spending*\n\n${lines.join('\n')}\n\nTotal: ${sym}${fmt(total)}`);
}

async function handleBudgetList(env: Env, phone: string, uid: string, month: string): Promise<void> {
  const [budgets, txs, sym] = await Promise.all([
    monthBudgets(env, uid, month),
    monthTransactions(env, uid, month),
    currencySymbol(env, uid),
  ]);
  if (!budgets.length) {
    await sendText(env, phone,
      `No budgets set for ${monthLabel(month)}.\nSet one with: *budget Food 6000*`);
    return;
  }
  const spentByCat = new Map<string, number>();
  for (const t of txs) {
    if (t.type === 'expense') spentByCat.set(t.category, (spentByCat.get(t.category) ?? 0) + t.amount);
  }
  const lines = budgets.map(b => {
    const spent = spentByCat.get(b.category) ?? 0;
    const flag = spent > b.amount ? ' ⚠️' : '';
    return `• ${b.category}: ${sym}${fmt(spent)} / ${sym}${fmt(b.amount)}${flag}`;
  });
  await sendText(env, phone, `*${monthLabel(month)} budgets*\n\n${lines.join('\n')}`);
}

async function handleBudgetSet(env: Env, phone: string, uid: string, rawCategory: string, amount: number): Promise<void> {
  if (!(amount >= 0) || amount > 1e11) {
    await sendText(env, phone, 'That amount looks off — try something like *budget Food 6000*.');
    return;
  }
  const category = matchCategory(rawCategory);
  const month = currentMonth();
  const sym = await currencySymbol(env, uid);
  const existing = (await monthBudgets(env, uid, month)).find(b => b.category === category);
  if (existing) {
    await fsPatch(env, `users/${uid}/budgets/${existing.id}`, { amount }, ['amount']);
  } else {
    await fsCreate(env, `users/${uid}/budgets`, {
      month, category, amount, authorUid: uid, createdAt: new Date(),
    });
  }
  await sendText(env, phone, `✅ ${monthLabel(month)} budget for *${category}* set to ${sym}${fmt(amount)}.`);
}

async function handleFreeform(env: Env, phone: string, uid: string, text: string): Promise<void> {
  // Fetch the currency symbol while Gemini parses — both are needed for the
  // success reply and neither depends on the other.
  const [parsed, sym] = await Promise.all([geminiParse(env, text), currencySymbol(env, uid)]);
  if (!parsed || !(parsed.amount > 0) || parsed.amount > 1e11 || !parsed.title) {
    await sendText(env, phone,
      `I couldn't read a transaction from that. Try: _"Spent 60 on tea via UPI"_ — or send *help* for commands.`);
    return;
  }
  const type = parsed.type === 'income' ? 'income' : 'expense';
  const tx: Record<string, unknown> = {
    title: String(parsed.title).slice(0, 256),
    amount: parsed.amount,
    type,
    category: matchCategory(String(parsed.category ?? 'Other')),
    date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date ?? '') ? parsed.date : today(),
    authorUid: uid,
    createdAt: new Date(),
  };
  if (parsed.paymentMethod) tx.paymentMethod = String(parsed.paymentMethod).slice(0, 128);
  if (parsed.note) tx.note = String(parsed.note).slice(0, 1024);
  await fsCreate(env, `users/${uid}/transactions`, tx);
  await sendText(env, phone,
    `✅ Logged ${sym}${fmt(parsed.amount)} ${type === 'income' ? 'income' : ''} for *${tx.title}* (${tx.category}).`);
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

interface ParsedTx {
  title?: string; amount: number; type?: string; category?: string;
  date?: string; paymentMethod?: string; note?: string;
}

async function geminiParse(env: Env, text: string): Promise<ParsedTx | null> {
  const prompt =
    `Parse this message into a financial transaction. Today is ${today()}.\n` +
    `Message: "${text.replace(/"/g, "'")}"\n\n` +
    `Reply with ONLY a JSON object: {"title": string, "amount": number, ` +
    `"type": "income"|"expense", "category": string, "date": "YYYY-MM-DD", ` +
    `"paymentMethod": "UPI"|"Card"|"Cash"|null, "note": string|null}.\n` +
    `Pick category from: ${CATEGORIES.join(', ')}. Use "Other" if unsure.\n` +
    `If the message is not a transaction at all, reply with {"error": "not a transaction"}.`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!res.ok) {
    console.error('Gemini error', res.status, await res.text());
    return null;
  }
  const data: any = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim());
    if (parsed.error) return null;
    return parsed as ParsedTx;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// WhatsApp send
// ---------------------------------------------------------------------------

async function sendText(env: Env, to: string, body: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v23.0/${env.PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  });
  if (!res.ok) console.error('WhatsApp send failed', res.status, await res.text());
}

// ---------------------------------------------------------------------------
// Rate limiting (Firestore counter per phone, hourly window)
// ---------------------------------------------------------------------------

async function bumpRateLimit(env: Env, phone: string): Promise<'ok' | 'warn' | 'drop'> {
  const path = `waRate/${phone}`;
  const now = Date.now();
  const doc = await fsGet(env, path);
  let count = 1;
  let windowStart = now;
  if (doc && typeof doc.windowStart === 'number' && now - doc.windowStart < 3600_000) {
    count = (doc.count ?? 0) + 1;
    windowStart = doc.windowStart;
  }
  await fsPatch(env, path, { count, windowStart });
  if (count === RATE_LIMIT_PER_HOUR + 1) return 'warn';
  if (count > RATE_LIMIT_PER_HOUR + 1) return 'drop';
  return 'ok';
}

// ---------------------------------------------------------------------------
// Firestore REST (service-account JWT via crypto.subtle)
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(env: Env): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;

  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  }));
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    'pkcs8', pemToBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`OAuth token exchange failed: ${res.status} ${await res.text()}`);
  const data: any = await res.json();
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

function fsBase(env: Env): string {
  return `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;
}

async function fsFetch(env: Env, url: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken(env);
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
  });
}

/** GET a document; returns decoded fields or null if it doesn't exist. */
async function fsGet(env: Env, path: string): Promise<any | null> {
  const res = await fsFetch(env, `${fsBase(env)}/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET ${path}: ${res.status}`);
  const doc: any = await res.json();
  return decodeFields(doc.fields ?? {});
}

/** PATCH (upsert) a document; mask limits which fields are replaced. */
async function fsPatch(env: Env, path: string, data: Record<string, unknown>, mask?: string[]): Promise<void> {
  const fields = mask ?? Object.keys(data);
  const params = fields.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const res = await fsFetch(env, `${fsBase(env)}/${path}?${params}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore PATCH ${path}: ${res.status} ${await res.text()}`);
}

/** POST a new document with an auto id. */
async function fsCreate(env: Env, collectionPath: string, data: Record<string, unknown>): Promise<void> {
  const res = await fsFetch(env, `${fsBase(env)}/${collectionPath}`, {
    method: 'POST',
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore POST ${collectionPath}: ${res.status} ${await res.text()}`);
}

async function fsDelete(env: Env, path: string): Promise<void> {
  const res = await fsFetch(env, `${fsBase(env)}/${path}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`Firestore DELETE ${path}: ${res.status}`);
}

/** runQuery over a subcollection of users/{uid}; returns decoded docs with id. */
async function fsQuery(env: Env, uid: string, structuredQuery: unknown): Promise<any[]> {
  const res = await fsFetch(env, `${fsBase(env)}/users/${uid}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`Firestore runQuery: ${res.status} ${await res.text()}`);
  const rows: any[] = await res.json();
  return rows
    .filter(r => r.document)
    .map(r => ({ id: r.document.name.split('/').pop(), ...decodeFields(r.document.fields ?? {}) }));
}

async function monthTransactions(env: Env, uid: string, month: string): Promise<any[]> {
  return fsQuery(env, uid, {
    from: [{ collectionId: 'transactions' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          { fieldFilter: { field: { fieldPath: 'date' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: `${month}-01` } } },
          { fieldFilter: { field: { fieldPath: 'date' }, op: 'LESS_THAN_OR_EQUAL', value: { stringValue: `${month}-31` } } },
        ],
      },
    },
    limit: 1000,
  });
}

async function monthBudgets(env: Env, uid: string, month: string): Promise<any[]> {
  return fsQuery(env, uid, {
    from: [{ collectionId: 'budgets' }],
    where: { fieldFilter: { field: { fieldPath: 'month' }, op: 'EQUAL', value: { stringValue: month } } },
    limit: 200,
  });
}

async function currencySymbol(env: Env, uid: string): Promise<string> {
  const profile = await fsGet(env, `users/${uid}`);
  return CURRENCY_SYMBOLS[profile?.currency ?? 'INR'] ?? '₹';
}

// --- Firestore value (en/de)coding -----------------------------------------

function encodeFields(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = encodeValue(v);
  return out;
}

function encodeValue(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  return { mapValue: { fields: encodeFields(v as Record<string, unknown>) } };
}

function decodeFields(fields: Record<string, any>): any {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

function decodeValue(v: any): any {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields ?? {});
  return null;
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64url(data: string | ArrayBuffer): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMonth(): string {
  return today().slice(0, 7);
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];

/** Accepts "2026-06", "june"/"jun", or empty → current month. */
function parseMonth(arg: string): string {
  const a = arg.trim().toLowerCase();
  if (!a) return currentMonth();
  if (/^\d{4}-\d{2}$/.test(a)) return a;
  const idx = MONTH_NAMES.findIndex(m => m.startsWith(a.slice(0, 3)) && a.length >= 3);
  if (idx !== -1) return `${new Date().getFullYear()}-${String(idx + 1).padStart(2, '0')}`;
  return currentMonth();
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1][0].toUpperCase()}${MONTH_NAMES[m - 1].slice(1)} ${y}`;
}

function matchCategory(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return CATEGORIES.find(c => c.toLowerCase() === lower)
    ?? CATEGORIES.find(c => c.toLowerCase().startsWith(lower))
    ?? (raw.trim() ? raw.trim()[0].toUpperCase() + raw.trim().slice(1) : 'Other');
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
