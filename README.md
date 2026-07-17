# Flux — Control Your Expenses 📱

A Material Design 3 **Android expense tracker** with AI-powered logging, budgets,
savings plans, analytics, PDF reports, and a **WhatsApp bot** — built with React 19
inside a Capacitor 8 WebView, backed by Firebase.

## Features

- **Dashboard** — balance, income/expenses, spending trend, savings, and an
  under-budget **streak** 🔥, all scoped to a globally shared month selector
- **Transactions** — fast entry sheet, search, edit/delete, custom categories
- **AI Quick Log** — type "Spent ₹60 on tea via UPI" and Gemini extracts and logs it
- **WhatsApp bot** — log expenses and query balance/budget/analytics from WhatsApp
  (free Meta Cloud API + Cloudflare Worker; see [whatsapp-bot/](whatsapp-bot/))
- **Budgets & Savings plans** — monthly/yearly planning with progress tracking
- **Analytics & Reports** — charts, insights, AI financial analysis, PDF export
  via the native share sheet
- **Auth** — Google Sign-In (native account picker) + email/password, offline-first
  Firestore persistence
- **Multi-currency** — INR by default, switchable in Settings

## Tech stack

| Layer | Tech |
|---|---|
| UI | React 19 + TypeScript + Tailwind CSS v4 (Material Design 3) |
| Native shell | Capacitor 8 (Android) |
| Backend | Firebase Auth + Firestore (security rules in [firestore.rules](firestore.rules)) |
| AI | Gemini flash models with automatic fallback |
| WhatsApp | Meta WhatsApp Cloud API + Cloudflare Worker webhook |

## Building the Android app

See **[ANDROID.md](ANDROID.md)** for full setup (SDK, `.env` contract,
`google-services.json`, debug/release builds, emulator quirks).

Quick start:

```bash
npm install
cp .env.example .env        # fill in your keys
npm run cap:sync            # vite build + capacitor sync
cd android && ./gradlew assembleDebug
```

`npm run dev` starts a Vite dev server for quick UI iteration in a desktop browser.

## Security

Secrets live in `.env` / `google-services.json` (both gitignored). Firestore access
is locked down per-user with field-level validation. See the security checklist in
[ANDROID.md](ANDROID.md).
