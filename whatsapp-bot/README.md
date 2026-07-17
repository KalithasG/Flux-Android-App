# Flux WhatsApp Bot

A Cloudflare Worker that lets Flux users log expenses/income and check
budgets & analytics from WhatsApp. Runs entirely on free tiers:

- **Meta WhatsApp Cloud API, dev mode** — free test number, up to 5 recipient
  numbers, no business verification. User-initiated conversations (and every
  reply inside the 24-hour service window) are free; the bot never sends paid
  template messages.
- **Cloudflare Workers free plan** — 100k requests/day, no card required.
- **Firestore / Gemini** — the same free-tier project and API key the app uses.

## Chat commands

| Message | What happens |
|---|---|
| `LINK 123456` | Links this WhatsApp number to the Flux account that generated the code |
| `Spent 60 on tea via UPI` (freeform) | Gemini parses it and logs the transaction |
| `summary` or `summary june` | Income, expenses and net for the month |
| `budget` | This month's budgets vs actual spend |
| `budget Food 6000` | Sets this month's Food budget |
| `analytics` | Top 5 spending categories this month |
| `unlink` | Disconnects the number |
| `help` | Command list |

## One-time setup

### 1. Cloudflare

```bash
cd whatsapp-bot
npm install
npx wrangler login       # opens browser, free account is fine
npx wrangler deploy      # note the printed URL, e.g. https://flux-whatsapp-bot.<you>.workers.dev
```

### 2. Meta (developers.facebook.com)

1. Create an app → type **Business** → add the **WhatsApp** product.
2. On *WhatsApp → API Setup* copy:
   - the **temporary access token** (or create a permanent one via a System User),
   - the **Phone number ID** of the free **test number**,
   - and under *App settings → Basic*, the **App secret**.
3. Still on *API Setup*, add up to **5 recipient phone numbers** (yours and
   family) — dev mode only delivers to these.
4. *WhatsApp → Configuration*: set the **Callback URL** to
   `https://<your-worker>.workers.dev/webhook`, set the **Verify token** to the
   same value you'll store as `WEBHOOK_VERIFY_TOKEN`, click **Verify and save**,
   then **subscribe** to the `messages` webhook field.

### 3. Firebase service account

Firebase Console → Project settings → Service accounts → **Generate new
private key**. Keep the JSON out of git (already gitignored).

### 4. Secrets

```bash
npx wrangler secret put WHATSAPP_TOKEN
npx wrangler secret put PHONE_NUMBER_ID
npx wrangler secret put META_APP_SECRET
npx wrangler secret put WEBHOOK_VERIFY_TOKEN     # any random string; must match step 2.4
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT # paste the whole JSON on one line
```

### 5. App config

Put the test number (digits only, e.g. `15551234567`) in the app's `.env` as
`VITE_WA_BOT_NUMBER` and rebuild the APK — the *Settings → WhatsApp → Link*
button deep-links into that chat with the code prefilled.

## Linking flow

1. Flux app → Settings → WhatsApp → **Link** writes a 6-digit code to
   `waLinkCodes/{code}` (10-minute expiry) and opens `wa.me` with
   `LINK <code>` prefilled.
2. User taps send; the Worker validates the code, stores
   `waLinks/{phone} → uid`, mirrors `whatsappNumber` onto the user doc, and
   deletes the code.
3. Security rules give clients create-only access to `waLinkCodes` and no
   access to `waLinks`; only this Worker (service account) reads them.

## Local development

```bash
cp .dev.vars.example .dev.vars   # fill in real values
npm run dev                      # wrangler dev on http://localhost:8787
```

Simulate a signed webhook (PowerShell users: run via Git Bash):

```bash
BODY='{"entry":[{"changes":[{"value":{"messages":[{"from":"15551230000","type":"text","text":{"body":"help"}}]}}]}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$META_APP_SECRET" -hex | sed 's/^.* /sha256=/')
curl -X POST http://localhost:8787/webhook -H "Content-Type: application/json" -H "X-Hub-Signature-256: $SIG" -d "$BODY"
```

## Limits & notes

- Per-number rate limit: 30 messages/hour (Firestore counter).
- Replies are only possible within 24h of the user's last message — fine,
  since the bot only ever replies.
- Dev-mode access tokens from the API Setup page expire every 24h; create a
  **System User token** (Business settings → System users) for a permanent one.
