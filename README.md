# LaunchGate

Describe a promotion, confirm what OpenAI interpreted, preview its deterministic checkout, and activate only after a real Kane CLI browser suite passes for the current candidate.

## Run locally

Requires Node 20+, npm, and Chrome. Run `npm install`, copy `.env.example` to `.env`, set `OPENAI_API_KEY` locally, then `npm run dev`. Open http://127.0.0.1:4173. The key remains server-side. Without a key, the manual policy editor and storefront still work; AI interpretation shows a setup error.

Run `npm test` for pricing boundaries and `npm run build` for type and production checks. The demo store is local, with no real payments or identity checks.

The launch suite in `verification-suite.json` contains six participant-reviewed, Kane assurance-generated tests from the separate `requirements/` store. It is bound to the exact **Welcome 20** policy, so a different candidate cannot start this fixed suite. The activation button stays locked until the real read-only browser suite passes for the current candidate. A passing run is bound to the candidate, source, catalog, and test files. The results panel shows individual outcomes and lets you download the sealed Kane evidence pack. Build steps and policy are in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) and [docs/PRD.md](docs/PRD.md).
