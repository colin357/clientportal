# Portal API Setup Guide

Complete reference for the Client Portal's server-side API: what each endpoint does, how to configure the environment it depends on, and how to call it.

All endpoints are Next.js App Router route handlers under `src/app/api/`. They run server-side (Node runtime unless noted), so secret keys used here are never exposed to the browser.

## Contents

0. [Portal Management API](#0-portal-management-api) — update the portal via POST requests
1. [Environment Variables](#1-environment-variables)
2. [Third-Party Service Setup](#2-third-party-service-setup)
3. [Endpoint Reference](#3-endpoint-reference)
4. [Local Development](#4-local-development)
5. [Production (Vercel) Setup](#5-production-vercel-setup)
6. [Security Notes](#6-security-notes)
7. [Troubleshooting](#7-troubleshooting)

---

## 0. Portal Management API

The `/api/portal/*` endpoints let you update the portal directly with HTTP requests — no admin UI needed. Add tasks for users, schedule their content calendars, read data back, and update statuses. (To *create* content ideas, use the existing [`POST /api/bulk-add-content-ideas`](#37-post-apibulk-add-content-ideas).)

### Conventions (all portal endpoints)

- **Client matching:** anywhere a client is needed, pass **one** of `clientId`, `clientEmail` (case-insensitive), or `companyName` (case-insensitive) — checked in that order. Don't know the id? `GET /api/portal/clients` lists everyone.
- **Bulk-friendly:** create endpoints accept a single object, a bare array, or a wrapped array (`{"tasks": [...]}` / `{"events": [...]}`). Results come back per item, so one bad entry never blocks the rest.
- **Auth (optional but recommended):** set a `PORTAL_API_KEY` env var and every portal request must include it as an `x-api-key` header (or `?apiKey=` query param). If the var is unset, the endpoints are open.
- Dates are always `YYYY-MM-DD` strings.

### 0.1 Clients — `GET /api/portal/clients`

Lists all clients (id, email, company name, name, approval group, tags) so you can find the right reference for other calls. Add `?clientEmail=jane@x.com` (or `clientId`/`companyName`) to get one client's full profile (passwords/social logins are stripped).

```bash
curl -s https://your-portal.com/api/portal/clients -H "x-api-key: $PORTAL_API_KEY"
```

### 0.2 Tasks — `/api/portal/tasks`

Tasks appear on the client's task list in the portal (the `clientTasks` collection, same shape the UI uses).

**Create — `POST`** (single object, bare array, or `{"tasks": [...]}`):

```bash
curl -s -X POST https://your-portal.com/api/portal/tasks \
  -H "x-api-key: $PORTAL_API_KEY" -H 'Content-Type: application/json' \
  -d '{
    "tasks": [
      { "clientEmail": "jane@x.com",
        "title": "Upload a New Video 🎥",
        "instructions": "Record and upload a new video so we can edit it into content.",
        "tag": "Content",
        "linkPage": "settings",
        "dueInDays": 3 },
      { "companyName": "Acme Realty",
        "title": "Review Your New Content Ideas",
        "linkPage": "content",
        "dueDate": "2026-07-25" }
    ]
  }'
```

Per-task fields: `title` (required), `instructions`, `tag` (default `"General"`), `status` (`todo` | `in_progress` | `under_review` | `done`, default `todo`), `dueDate` or `dueInDays`, `notes`, `order`, and `linkPage` — a deep link into the portal: `onboarding-form`, `content`, `settings`, `social`, `calendar`, `crm`, or `ai-generator`.

**Read — `GET`** with optional `?clientEmail=...&status=todo` filters:

```bash
curl -s "https://your-portal.com/api/portal/tasks?clientEmail=jane@x.com&status=todo" \
  -H "x-api-key: $PORTAL_API_KEY"
```

**Update — `PATCH`** with the task `id` plus any fields to change:

```bash
curl -s -X PATCH https://your-portal.com/api/portal/tasks \
  -H "x-api-key: $PORTAL_API_KEY" -H 'Content-Type: application/json' \
  -d '{ "id": "TASK_ID", "status": "done", "notes": "Completed by phone" }'
```

**Delete — `DELETE`** with `?id=TASK_ID` or a `{"id": "..."}` body.

### 0.3 Content calendar — `/api/portal/calendar`

Reads and writes the `calendarEvents` collection — exactly what the admin Calendar tab and clients' "Today" view show.

**Read — `GET`** with optional client, date-range, and type filters:

```bash
# Jane's calendar for August
curl -s "https://your-portal.com/api/portal/calendar?clientEmail=jane@x.com&from=2026-08-01&to=2026-08-31" \
  -H "x-api-key: $PORTAL_API_KEY"
```

Events come back sorted by date with `clientName` attached.

**Schedule — `POST`** (single object, bare array, or `{"events": [...]}`). Two ways to create an event:

```bash
curl -s -X POST https://your-portal.com/api/portal/calendar \
  -H "x-api-key: $PORTAL_API_KEY" -H 'Content-Type: application/json' \
  -d '{
    "events": [
      { "clientEmail": "jane@x.com", "date": "2026-07-22",
        "title": "Rate buydown explainer video", "type": "social" },

      { "contentId": "EXISTING_CONTENT_ID", "date": "2026-07-24" }
    ]
  }'
```

- **Standalone event:** provide `title` (plus optional `description`, `type` — default `"social"`).
- **Schedule existing content:** provide `contentId` and a `date`; title, description, type, and client are copied from the content item (matching the UI's drag-to-calendar behavior).

**Move / edit — `PATCH`**: `{ "id": "EVENT_ID", "date": "2026-07-30" }` (also `title`, `description`, `type`).

**Unschedule — `DELETE`** with `?id=EVENT_ID` or a `{"id": "..."}` body.

### 0.4 Content items — `/api/portal/content`

**Read — `GET`** with optional `?clientEmail=...&status=pending&type=social` filters — newest first, with `clientName` attached. Useful for finding `contentId`s to schedule on the calendar.

**Update — `PATCH`**: `{ "id": "CONTENT_ID", "status": "approved" }` (also `title`, `content`, `description`, `type`, `fileLink`).

**Create** content ideas via the existing [`POST /api/bulk-add-content-ideas`](#37-post-apibulk-add-content-ideas).

### 0.5 Typical weekly workflow

```bash
BASE=https://your-portal.com/api
KEY="x-api-key: $PORTAL_API_KEY"

# 1. Find the client
curl -s "$BASE/portal/clients" -H "$KEY"

# 2. Add this week's content ideas
curl -s -X POST "$BASE/bulk-add-content-ideas" -H 'Content-Type: application/json' \
  -d '{"clients":[{"clientEmail":"jane@x.com","ideas":[{"title":"...","content":"..."}]}]}'

# 3. Give them a task to review the ideas
curl -s -X POST "$BASE/portal/tasks" -H "$KEY" -H 'Content-Type: application/json' \
  -d '{"clientEmail":"jane@x.com","title":"Review Your New Content Ideas","linkPage":"content","dueInDays":3}'

# 4. Once approved, schedule the content on their calendar
curl -s "$BASE/portal/content?clientEmail=jane@x.com&status=approved" -H "$KEY"
curl -s -X POST "$BASE/portal/calendar" -H "$KEY" -H 'Content-Type: application/json' \
  -d '{"contentId":"CONTENT_ID_FROM_STEP_4","date":"2026-07-28"}'

# 5. Read the calendar back to confirm
curl -s "$BASE/portal/calendar?clientEmail=jane@x.com&from=2026-07-20&to=2026-08-03" -H "$KEY"
```

---

## 1. Environment Variables

Create `.env.local` in the project root (never commit it — it's in `.gitignore`).

### Firebase (client + server)

Public config, safe to expose to the browser. Used by the web app and by `src/lib/firebaseServer.ts` for server-side Firestore access:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

See `FIREBASE_SETUP.md` for how to obtain these from the Firebase console.

### OpenAI (server-only)

Used by the four content-generation endpoints:

```bash
OPENAI_API_KEY=sk-...
```

### Twilio SMS (server-only)

Used by `/api/send-sms`, and checked by `/api/check-reminders` and `/api/admin-generate-content`:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+15551234567
```

### Portal management API (optional)

Protects all `/api/portal/*` endpoints when set (see [section 0](#0-portal-management-api)):

```bash
PORTAL_API_KEY=some-long-random-string
```

### Which endpoints need what

| Endpoint | Firebase | OpenAI | Twilio |
|---|---|---|---|
| `POST /api/generate-content` | – | ✅ | – |
| `POST /api/generate-ai-content-idea` | – | ✅ | – |
| `POST /api/generate-personalized-content` | – | ✅ | – |
| `POST /api/admin-generate-content` | – | ✅ | optional |
| `POST /api/send-sms` | – | – | ✅ |
| `POST /api/check-reminders` | – | – | ✅ |
| `POST /api/bulk-add-content-ideas` | ✅ | – | – |
| `/api/portal/*` (tasks, calendar, content, clients) | ✅ | – | – |
| `GET /api/placeholder/{w}/{h}` | – | – | – |

Endpoints return HTTP 500 with a descriptive error (e.g. `"OpenAI API key not configured"`) when their required credentials are missing — the rest of the app keeps working.

---

## 2. Third-Party Service Setup

### OpenAI

1. Create an API key at https://platform.openai.com/api-keys.
2. Add billing/credits to the account (generation endpoints use `gpt-4o-mini`).
3. Set `OPENAI_API_KEY` in `.env.local` and in Vercel.

### Twilio

1. Sign up at https://www.twilio.com and buy an SMS-capable phone number.
2. From the Console dashboard copy the **Account SID** and **Auth Token**.
3. Set the three `TWILIO_*` variables. `TWILIO_PHONE_NUMBER` must be in E.164 format (`+1...`).
4. Trial accounts can only text verified numbers — upgrade for real client notifications.

### Firebase / Firestore

Follow `FIREBASE_SETUP.md` (project creation, Auth, Firestore, Storage) and `FIREBASE_RULES.md` (security rules). The API layer uses the client SDK server-side via `src/lib/firebaseServer.ts`, which lazily initializes a shared Firestore instance from the `NEXT_PUBLIC_*` variables.

---

## 3. Endpoint Reference

All request/response bodies are JSON unless noted. Errors follow the shape `{ "error": "message" }` with an appropriate 4xx/5xx status.

### 3.1 `POST /api/generate-content`

Simple one-off marketing content generation.

**Request:**
```json
{
  "topic": "First-time home buying",
  "contentType": "social media post",
  "audience": "millennial home buyers",
  "tone": "friendly"
}
```
All four fields are required (400 if any is missing).

**Response:** `{ "content": "generated text..." }`

Model: `gpt-4o-mini`, max 1,000 tokens.

### 3.2 `POST /api/generate-ai-content-idea`

Generates a single structured content idea (social, blog, or email), optionally revising a previous idea based on feedback.

**Request:**
```json
{
  "contentType": "social",            // required: "social" | "blog" | "email"
  "topic": "Rate buydowns",           // required
  "purpose": "Educate borrowers",     // required
  "audience": "first-time buyers",    // optional (falls back to onboarding answers)
  "user": { "firstName": "Jane", "lastName": "Doe", "companyName": "Acme Realty" },
  "onboardingAnswers": {              // optional personalization context
    "industry": ["real estate"],
    "targetAudience": ["buyers"],
    "brandVoice": ["casual"],
    "specialties": ["luxury homes"],
    "primaryMarkets": "Austin, TX",
    "pricePoint": "$400k-$800k",
    "clientPainPoints": "...",
    "topicsToAvoid": "..."
  },
  "previousIdea": { "title": "...", "content": "..." },  // optional, for regeneration
  "feedback": "Make it shorter"                          // optional, pairs with previousIdea
}
```

**Response:**
```json
{ "idea": { "title": "...", "content": "...", "description": "..." } }
```
For `social` ideas, `content` is formatted as `VIDEO SCRIPT:\n...\n\nCAPTION:\n...`.

Model: `gpt-4o-mini`, max 2,000 tokens. If the model returns malformed JSON, a fallback idea object wrapping the raw text is returned.

### 3.3 `POST /api/generate-personalized-content`

Generates a full batch of 15 pieces (5 social + 5 blog + 5 email) for one client, using their onboarding profile, avoiding topics already covered in their content history.

**Request:**
```json
{
  "user": { "firstName": "Jane", "lastName": "Doe", "companyName": "Acme Realty" },  // required
  "onboardingAnswers": { ... },       // required, same shape as above
  "contentHistory": [                  // optional; last 20 items used for dedup
    { "title": "...", "description": "..." }
  ],
  "adminNotes": "Client prefers video content"  // optional
}
```

**Response:** JSON containing the generated content pieces (parsed from the model output).

### 3.4 `POST /api/admin-generate-content`

Batch version of the above for the admin dashboard: iterates over multiple users, skipping any without `onboardingAnswers`.

**Request:**
```json
{
  "users": [ { "id": "uid1", "companyName": "...", "onboardingAnswers": { ... } } ],  // required, non-empty
  "contentHistory": { "uid1": [ { "title": "...", "description": "..." } ] }          // optional, keyed by user id
}
```

**Response:** `{ results: [...], errors: [...] }` with per-user outcomes.

Requires `OPENAI_API_KEY`; Twilio variables are read but SMS is optional.

### 3.5 `POST /api/send-sms`

Sends a single SMS via Twilio's REST API.

**Request:**
```json
{ "to": "+15559876543", "message": "Your content is ready for review!" }
```

**Response:** `{ "success": true, "messageSid": "SM..." }`

Errors: 400 if `to`/`message` missing, 500 if Twilio isn't configured, Twilio's status code passthrough on API failure.

### 3.6 `POST /api/check-reminders`

Evaluates pending content items for 48-hour and 7-day review reminders.

> **Note:** Automatic client SMS is currently **disabled by design** — the route computes which reminders are due and logs them, but does not send. SMS to clients is sent manually from the admin portal via `/api/send-sms`.

**Request:**
```json
{
  "users": [ { "id": "uid1", "firstName": "Jane", "phoneNumber": "+1...", "companyName": "..." } ],
  "content": [ { "id": "c1", "clientId": "uid1", "title": "...", "status": "pending",
                 "createdAt": "2026-07-01T00:00:00.000Z", "reminders": [] } ]
}
```

**Response:** `{ "success": true, "remindersSent": 0, "details": [], "errors": [] }`

### 3.7 `POST /api/bulk-add-content-ideas`

Mass-adds content ideas to clients' portals in one request (documented in detail in the route file header). Ideas are matched to a client by `clientId`, `clientEmail` (case-insensitive), or `companyName` (case-insensitive), checked in that order.

**Request — flat list:**
```json
{
  "ideas": [
    { "clientEmail": "jane@x.com", "title": "Idea 1", "content": "...",
      "description": "...", "type": "social", "fileLink": "https://..." }
  ]
}
```

**Request — grouped by client** (weekly "8 ideas per client" workflow):
```json
{
  "clients": [
    { "clientEmail": "jane@x.com",
      "ideas": [ { "title": "Idea 1", "content": "..." }, { "title": "Idea 2", "content": "..." } ] }
  ]
}
```
A bare JSON array in the body is treated as the flat `ideas` list.

Per-idea fields: `title` (required), `content` (required), `description`, `type` (default `"content-idea"`), `fileLink`, `status` (defaults to `"approved"` for auto-approve clients, otherwise `"pending"`).

**Response:**
```json
{
  "success": true, "received": 2, "created": 1, "skipped": 1,
  "results": [
    { "index": 0, "status": "created", "contentId": "...", "clientId": "...", "clientName": "...", "title": "Idea 1" },
    { "index": 1, "status": "skipped", "error": "Client not found. ..." }
  ]
}
```
Partial failures are reported per item — a bad idea never blocks the rest of the batch.

Requires the Firebase env vars (writes to the `content` Firestore collection).

### 3.8 `GET /api/placeholder/{...path}/{width}/{height}`

Edge-runtime placeholder image generator (e.g. `/api/placeholder/img/400/300` returns a 400×300 gray PNG labeled `400x300`). Used for UI mockups; no configuration needed.

---

## 4. Local Development

```bash
npm install
cp env.local .env.local        # then fill in real values (env.local is a template)
npm run dev                     # http://localhost:3000
```

Quick smoke tests:

```bash
# Content generation (needs OPENAI_API_KEY)
curl -s -X POST http://localhost:3000/api/generate-content \
  -H 'Content-Type: application/json' \
  -d '{"topic":"open houses","contentType":"social post","audience":"buyers","tone":"friendly"}'

# SMS (needs TWILIO_*; sends a real text!)
curl -s -X POST http://localhost:3000/api/send-sms \
  -H 'Content-Type: application/json' \
  -d '{"to":"+15551234567","message":"Test from the portal"}'

# Bulk ideas (needs Firebase; writes to Firestore!)
curl -s -X POST http://localhost:3000/api/bulk-add-content-ideas \
  -H 'Content-Type: application/json' \
  -d '{"ideas":[{"clientEmail":"jane@x.com","title":"Test idea","content":"Body"}]}'

# Placeholder (no config)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/placeholder/img/400/300
```

---

## 5. Production (Vercel) Setup

See `VERCEL_DEPLOYMENT.md` for the full deployment guide. For the API specifically:

1. In Vercel → Project → **Settings → Environment Variables**, add every variable from section 1 for the **Production** (and optionally Preview) environments.
2. Secrets (`OPENAI_API_KEY`, `TWILIO_*`) must **not** be prefixed `NEXT_PUBLIC_` — they stay server-only.
3. Redeploy after changing env vars (they're baked in at build/boot time).
4. The `placeholder` route runs on the Edge runtime; all others run on the default Node.js serverless runtime — no extra configuration needed.

---

## 6. Security Notes

Current state and known gaps to be aware of:

- **No authentication on API routes.** All endpoints, including `bulk-add-content-ideas` (which writes to Firestore) and `send-sms` (which spends Twilio credit), are callable by anyone who knows the URL. Recommended hardening: require a shared secret header (e.g. `x-api-key` checked against an `PORTAL_API_SECRET` env var) or verify a Firebase Auth ID token on admin-only routes.
- **Firestore runs in open/test mode** (see `firestore.rules` and `QUICK_START_RULES.md`), which is why the client SDK works server-side without Admin credentials. Locking down rules will require migrating server routes to the Firebase Admin SDK with a service account.
- **Cost exposure:** the OpenAI endpoints are unauthenticated and can be invoked repeatedly; consider rate limiting (e.g. Vercel WAF rules or middleware) before sharing the deployment URL widely.
- Secrets belong only in `.env.local` / Vercel env vars — never in code or `NEXT_PUBLIC_*` variables.

---

## 7. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `{"error":"OpenAI API key not configured"}` (500) | `OPENAI_API_KEY` missing in the running environment. Restart `npm run dev` or redeploy after setting it. |
| `{"error":"SMS service not configured"}` (500) | One of the three `TWILIO_*` vars is missing. |
| `{"error":"Failed to send SMS"}` | Twilio rejected the request — check the server log for the Twilio error. Common: unverified `to` number on a trial account, or `TWILIO_PHONE_NUMBER` not E.164. |
| `{"error":"Firebase is not configured on the server"}` | `NEXT_PUBLIC_FIREBASE_API_KEY` / `PROJECT_ID` missing or still set to template placeholder values. |
| `bulk-add-content-ideas` skips with "Client not found" | The `clientEmail`/`companyName` doesn't match a `users` document (matching is case-insensitive but must be exact otherwise). Use `clientId` for certainty. |
| Generation returns fallback idea with raw text in `content` | The model emitted malformed JSON; retry, or reduce prompt complexity. |
| Works locally, 500 in production | Env vars not set for the Production environment in Vercel, or not redeployed after adding them. |
