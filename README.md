# Slip Flow

Digitizes handwritten raw-material intake slips: photograph a slip, an AI agent extracts structured data, a human approves it, and a second AI agent answers natural-language questions about the approved records — with citations, never hallucinated.

Built for **Deploy or Die: HowToAlgo × GDG on Campus KIIT Hackathon** — Track A (Business Process Automation).

## Docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — stack, data flow, component design.
- [`AGENTS.md`](AGENTS.md) — rules for AI coding agents working in this repo.
- [`AGENTS_AND_SKILLS.md`](AGENTS_AND_SKILLS.md) — the custom agents (`SlipExtractionAgent`, `QueryAgent`) and skills, once built.
- [`DECISIONS.md`](DECISIONS.md) — running log of every build decision and why, including the pivot from this hackathon's earlier Track B submission.

## Running locally

### Backend

```bash
cd server
npm install
cp .env.example .env   # fill in GEMINI_API_KEY and Firebase details
npm run build
npm start
```

### Frontend

```bash
flutter pub get
flutter build web --debug   # see DECISIONS.md for why --debug
```

Serve `build/web` with any static file server for local testing.

## Testing

```bash
flutter test
cd server && npm run test:e2e
```
