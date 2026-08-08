# AGENTS.md — Agent & Development Rules

This document defines how AI coding agents (Claude Code, Cline, etc.) must operate
within this project. All agents and human contributors must follow these rules.

## Project Summary

Slip Flow: a business-process-automation tool that digitizes handwritten raw-material slips
via an LLM's vision capability, routes extracted data through a human approval step, stores
approved records in a structured database, exposes a query agent for natural-language
lookups over that data, and logs every AI decision to an audit trail.

Track: **A — Business Process Automation**

## Core Principles

1. **Human-in-the-loop is non-negotiable.** No extracted slip data is written to
   the `slips` (approved) table until a human has explicitly approved it.
   Agents must never bypass the approval step, even for "high confidence" extraction results.
2. **Every AI decision must be logged.** Any classification, extraction, or
   confidence score produced by an agent must be written to the `audit_log`
   collection with a timestamp, the input reference, and the reasoning/confidence value.
3. **No silent failures.** If extraction confidence is below threshold, or an API call
   fails, the agent must flag the record for manual review — never guess or
   auto-approve.
4. **Structured queries, not free-text hallucination.** The query agent answers
   questions by fetching the actual Firestore records and feeding them as context, not by
   generating answers from memory. Every answer must cite the source record
   (slip ID).

## Coding Standards

- Backend: TypeScript, Node.js/Express — no untyped JS in new files. Same
  `routes/` → `agents/` → `skills/` shape as the Track B sibling project.
- Frontend: Flutter (Dart), Web-first (must stay Playwright-testable), Android-capable.
  Reuse the ported design-system widgets in `lib/widgets/` rather than hand-rolling
  new `Container`/`BoxDecoration` styling — see the `vault-ui-soften` skill in
  `.claude/skills/` for the exact styling rules (rounded corners, blurred soft
  shadows, theme-aware colors) if a screen needs custom styling anyway.
- Formatting: `tsc --noEmit` (backend) and `flutter analyze` (frontend) must pass
  before commit.
- Tests: every new endpoint or screen must have at least one Playwright test
  before it is considered "done."

## Git & Commit Rules

- Commit frequently with descriptive messages — no single giant commit at the end.
- Never commit `.env`, `server/firebase-service-account.json`, or any other secret —
  all are in `.gitignore`.
- Each part of the build maps to one commit, pushed immediately after verification.

## Agent-Specific Rules

### SlipExtractionAgent (custom agent)

- Input: a slip image
- Output: structured fields (item, quantity, unit, date, supplier, confidence score)
- Must never write directly to the `slips` (approved) collection — only to
  `slips_pending`, awaiting human approval
- Must log its extraction reasoning and confidence to `audit_log`

### QueryAgent (custom agent)

- Input: a natural-language question about slip/inventory history
- Must fetch the actual matching records from Firestore and answer only from them
- Must never fabricate data not present in the fetched records
- Must return the source record(s) alongside the answer

## CI/CD Requirements

- GitHub Actions must run lint + build + test on every push (Node job + Flutter job).
- The pipeline must be green before considering a part of the build "done."
- Do not accumulate multiple unverified parts before checking CI — same
  discipline as the Track B build (verify locally with a direct smoke test,
  push, confirm green, then move on).

## What Agents Must NOT Do

- Do not write to the `slips` collection or bypass the approval step without human approval.
- Do not fabricate extraction data when confidence is low — flag instead.
- Do not commit secrets, API keys, service account JSON, or `.env` files.
- Do not skip writing the `audit_log` entry for any decision.
