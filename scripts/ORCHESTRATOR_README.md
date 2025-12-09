Orchestrator test instructions
=============================

What this is
- A simple central handler `app/api/interview/orchestrate/route.ts` that supports `greet`, `question`, and `evaluate` actions. It calls `lib/gemini` for LLM logic when available.

Local quick tests
1. Mocked (no LLM required):
   - `node scripts/test-orchestrate-local.js` — runs a quick mocked greet/question/evaluate and prints JSON shapes.

2. TypeScript handler test (calls real `handleOrchestrate`):
   - Requires `ts-node` or a TypeScript runtime.
   - Run: `npx ts-node scripts/test-orchestrate.ts` (may require installing `ts-node` as dev dependency).

Dev server
- Start Next dev: `npm run dev` and then POST to `http://localhost:3000/api/interview/orchestrate` with JSON body `{ "action": "greet" }`. The endpoint expects POST.

Notes
- Many legacy `app/api/interview/*` routes were replaced with 410 responses to remove old interview-room endpoints safely. The orchestrator is intended to be the single point of orchestration for the room.
- For full E2E LLM behavior, set `GEMINI_API_KEY` / `GOOGLE_API_KEY` in `.env.local` and ensure `lib/gemini` dependencies are configured.
