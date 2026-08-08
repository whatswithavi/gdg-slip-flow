# Slip Flow

A configurable platform for digitizing a business's paper registers — raw material intake, production logs, dispatch notes, worker attendance, expense vouchers — not a single-purpose tool for one document type. Photograph a paper record, an AI agent extracts structured data, a human approves it, and three more AI agents let you query that data, get a proactive activity digest, and check workers in by face recognition. Every AI decision and human action is logged to an audit trail. Demoed end-to-end on a real plastic recycling factory's workflow.

Built for **Deploy or Die: HowToAlgo × GDG on Campus KIIT Hackathon** — Track A (Business Process Automation).

## What it does

- **Configurable paperwork digitization** — 5 register types built in (intake/production/dispatch/attendance/expense); a new paper form is a config entry, not new code.
- **Human approval gate** — nothing is final until a person reviews and approves/rejects; every action is audit-logged.
- **Payroll from attendance** — deterministic (non-AI) wage calculation from approved attendance records.
- **Citation-only Q&A** — ask questions in natural language, get answers that cite the exact record(s) or compliance document(s) they came from, or an honest "I don't know."
- **Compliance document library** — upload license/policy text, query it with the same citation guarantee.
- **Owner's daily digest** — on-demand AI summary of recent activity and items needing review.
- **Face-recognition check-in** — enroll a worker's photo, then check them in with a live photo instead of a paper sheet (still goes through the same human-approval gate).
- **Digital receipt emails** — every approval emails a formatted receipt via SendGrid.
- **Automatic AI fallback** — Gemini first, Groq automatically on a quota error, for both image and text calls.

## Docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — stack, data flow, component design.
- [`AGENTS.md`](AGENTS.md) — rules for AI coding agents working in this repo.
- [`AGENTS_AND_SKILLS.md`](AGENTS_AND_SKILLS.md) — the 4 custom agents, 4 custom skills, and 2 deterministic (non-AI) services.
- [`DECISIONS.md`](DECISIONS.md) — running log of every build decision and why, including the pivot from this hackathon's earlier Track B submission.

## Running locally

### Backend

```bash
cd server
npm install
cp .env.example .env   # fill in GEMINI_API_KEY and Firebase details; GROQ_API_KEY, SendGrid vars are optional
npm run build
npm start
```

### Frontend

```bash
flutter pub get
flutter build web --debug   # see DECISIONS.md for why --debug, not release
```

Serve `build/web` with any static file server for local testing.

## Testing

```bash
flutter test
cd server && npm run test:e2e
```

## Getting API keys (free)

- **Gemini**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — sign in, create a key.
- **Groq** (optional, quota fallback): [console.groq.com](https://console.groq.com) — sign up, create a key.
- **SendGrid** (optional, digital receipts): [sendgrid.io](https://sendgrid.io) — sign up, create an API key, and verify a sender identity under Settings → Sender Authentication before emails will send.

Never commit `.env` or any real key — only `.env.example` (with empty values) is committed.
