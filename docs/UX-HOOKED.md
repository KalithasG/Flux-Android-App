# Flux × Hooked — UX review and roadmap

How Flux measures up against Nir Eyal's Hook Model (Trigger → Action →
Variable Reward → Investment), what already works, and prioritized
improvements. Items marked ✅ shipped with v2; 🔜 are recommended next.

**The core habit loop we want:** feel a money moment (bought chai, got paid)
→ log it in one message → instantly see something about yourself (streak,
insight) → the growing history/budgets make Flux more valuable → repeat.

---

## 1. Trigger

*External triggers get the user in; internal triggers (emotions, routines)
keep them coming back. The goal is pairing the internal trigger "I just spent
money / I feel money anxiety" with Flux.*

| Status | Idea | Why it works |
|---|---|---|
| ✅ | **WhatsApp bot** | Piggybacks on an app the user opens dozens of times a day — the chat thread itself becomes an owned external trigger sitting in their inbox. Zero new habit needed: logging lives where their thumbs already are. |
| 🔜 P1 | **Daily local notification** ("What did you spend today?", ~9 pm, only if nothing logged) | The classic paired-trigger: fires at the moment of daily reflection. Must be skippable/dismissible forever — nagging kills the habit it's meant to build. Use Capacitor Local Notifications; no server needed. |
| 🔜 P2 | **App shortcut** (long-press launcher icon → "Add expense", "AI chat") | Cuts one more step between the internal trigger and the action. Android `shortcuts.xml`, cheap win. |
| 🔜 P3 | **Budget-threshold ping** ("Food budget 80% used with 10 days left") | An external trigger tied to loss-aversion, the strongest money emotion. Needs care: cap at one per category per month. |

## 2. Action

*B = MAT: behavior happens when Motivation, Ability and a Trigger meet.
Flux's job is maximizing Ability — make logging near-zero effort.*

| Status | Idea | Why it works |
|---|---|---|
| ✅ | **Freeform logging** ("Spent 60 on tea") via AI chat and now WhatsApp | One sentence replaces a 5-field form — the single biggest ability win in the app. |
| ✅ | **Amount keypad autofocus** + numeric input in Add sheet | Fewer taps to the only required field. |
| ✅ | **Google one-tap sign-in** | Sign-up friction is where habit products die; this keeps the first session under a minute. |
| 🔜 P1 | **Remember last-used category/payment method** as defaults in the Add sheet | Most people's expenses are highly repetitive; defaults turn 4 choices into 0. |
| 🔜 P2 | **"Log again" on recent transactions** (one tap duplicates yesterday's chai with today's date) | The repeat-purchase case becomes a single tap. |

## 3. Variable Reward

*Rewards must be variable to hold attention — same-every-time rewards fade.
Eyal's three types: the Tribe (social), the Hunt (resources/information), the
Self (mastery, completion).*

| Status | Idea | Type | Why it works |
|---|---|---|---|
| ✅ | **Under-budget streak card** ("🔥 3 days") | Self | Mastery + loss aversion: the streak is something to protect. Already variable — some days it grows, some days it's at risk. |
| 🔜 P1 | **Rotating daily insight card** on the dashboard ("Food is 32% of this month", "₹450 less than last week", "Longest streak yet") | Hunt | The user never knows *which* insight they'll get — that uncertainty is the reward. All computable client-side from existing data; one card slot, swap daily. |
| 🔜 P1 | **Milestone celebrations** (7/30/100-day streaks, 100th transaction) — one confetti moment, next milestone *not* shown | Self | Celebrate, then leave the next reward uncertain. Showing a progress bar to the next milestone would make it predictable — deliberately don't. |
| 🔜 P2 | **Month-end "wrap" summary** (best category, biggest save, streak record) | Self/Hunt | A periodic variable payoff for a month of small investments; shareable image later. |
| 🔜 P3 | **Household/tribe view** (shared budgets with the 5 linked WhatsApp family numbers) | Tribe | The only Tribe reward that makes sense for a family finance app; big lift, do last. |

## 4. Investment

*Every bit of stored value (data, config, reputation, skill) increases the
cost of leaving and loads the next trigger.*

| Status | Idea | Why it works |
|---|---|---|
| ✅ | **Budgets, custom categories, savings plans** | Classic stored value: each one makes Flux more "theirs" and abandoning it costlier. |
| ✅ | **WhatsApp linking** | An investment that *loads the next trigger* — after linking, every future money moment has a frictionless outlet. This is the textbook Hooked flywheel. |
| ✅ | **Transaction history itself** (now with streaks computed from it) | Data compounds: analytics, insights and streaks all get better the longer they stay. |
| 🔜 P1 | **Ask for a budget right after the first logged expense** ("Want to cap Food at ₹6000?") | Eyal: ask for investment *after* a reward, not before. Today budget setup is buried in a tab; surface it at the moment of highest motivation. |
| 🔜 P2 | **Endowed progress on streaks** — day 1 shows "🔥 1 day" immediately (already the case) and milestone copy frames it as "6 days to your first badge" | People finish progress they feel they've started; the streak card should never show zero-state emptiness once a single day exists. |

## 5. Measuring the habit

Define the **habitual user**: logs ≥1 transaction per day, ≥5 days a week.
When instrumentation is added (Firebase Analytics is free), track:

- **Trigger→Action rate**: notification/WhatsApp message → logged transaction.
- **Streak survival**: median streak length; where streaks die.
- **Time-to-log**: app open (or WA message) → transaction written. Target < 15s.
- **D7/D30 retention** split by "linked WhatsApp" vs not — this validates
  whether the bot is the habit engine we believe it is.

## Ethics note

The Hook Model is manipulation-shaped; Flux passes Eyal's own "manipulation
matrix" test only as long as it stays a *facilitator* — the maker would use it,
and it materially improves users' lives (spending awareness). Keep every
trigger optional and every streak forgiving (a broken streak should restart
with encouragement, not shame), and never gamify *spending more*.

## Priority order

1. Daily insight card (Hunt reward, pure client-side, highest reward/effort).
2. Post-first-expense budget prompt (Investment at peak motivation).
3. Daily local notification (paired external trigger).
4. Milestone confetti at 7/30 days.
5. Smart defaults + "log again" (Ability).
6. App shortcuts, budget-threshold pings, month-end wrap, household view.
