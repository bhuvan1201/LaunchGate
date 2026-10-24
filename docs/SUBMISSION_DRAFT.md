# LaunchGate submission draft

This is copy for the event's Submit tab. It is a local draft, not a submitted or published entry. Verify the final commit and evidence links before saving it there.

**Project name:** LaunchGate

**Project type:** Web app

**One-line pitch:** Describe a promotion in plain English, confirm the OpenAI interpretation, and let Kane's browser evidence unlock activation only for the exact campaign it verified.

## Problem

Promotion rules are easy to misunderstand at the boundary: whether a threshold is inclusive, whether sale items count toward it, whether returning customers qualify, and where the discount cap applies. A passing test report is often separate from the action that turns a campaign on. LaunchGate connects a merchant's intent, observed checkout behavior, and the activation decision.

## What we built

The merchant types a request such as “Welcome 20: 20% off for new customers once eligible items reach $42, up to $10, excluding sale items.” OpenAI converts it to six reviewable policy fields. The merchant confirms them, and LaunchGate's deterministic pricing engine previews four catalog items. A server-triggered Kane CLI browser suite checks six approved carts. The backend unlocks activation only when every required check passed and the sealed report still matches the confirmed candidate, app source, requirements, catalog, and exact test suite.

## Four-step harness flow

1. **Specify:** Ingest the PRD and the exact demo-campaign contract; extract use cases, review them, and have Kane design cited scenarios and tests.
2. **Build:** Use Codex to implement the OpenAI interpreter, checkout, and backend activation gate.
3. **Verify:** Run Kane's approved read-only browser checks through the app; inspect the run report, member logs, sealed pack, and coverage gaps.
4. **Maintain:** Change a requirement in an isolated copy and run Kane Maintain to identify affected use cases and outstanding coverage. This is a requirements-change demonstration; it is not a passing verification of the changed campaign.

The isolated run changed the minimum to $48, applied 3 reconciliation rows, generated new threshold cases, and reported 0/41 criteria proven until the revised suite is reviewed and run. See [MAINTAIN_DEMO.md](MAINTAIN_DEMO.md).

## Kane CLI evidence

- Candidate suite: **6/6 passed**, execution `a62515b9-21d7-4bb2-9cda-383af2b89725` (6m 34s). The sealed pack at `requirements/.testmuai/evidence/a62515b9-21d7-4bb2-9cda-383af2b89725.evidence` passed `kane-cli evidence validate` (L1, finalized). SHA-256: `671910a3c824e839c98d9c332d378536bfe22da1e24451106f6dadebe133e3a7`. The pack is local and is not yet a public link.
- OpenAI setup: a saved, passing Kane browser run confirms the real API returned the reviewed fields and the merchant confirmed candidate #1. [Test Manager report](https://test-manager.lambdatest.com/projects/01M5QMFX6A3MX0GAMMTVB8H1GJ/test-cases/01M5QP0ETBMRJ9NDGVSEGK35Q5/dashboard/share/US_FXICM1JHLBJHXI60D76MWOZ3RG2289UKTJIPRCLRU6EWAQ9RFHI0SPLXQVLYA62P?type=summary&agentView=true&fqdn=summary-page).
- Initial broad checkout run: **4/6 passed**. One browser run navigated to the wrong tab; another reached a verification control against an unrelated candidate. The latter exposed a real guardrail gap: the backend now rejects the fixed Welcome 20 suite for any different policy. These two results are failures, not part of the 6/6 claim.
- Coverage: Kane records **11/20 criteria proven** for the candidate-verification use case (55%); the overall requirements store is 18.33% because the other two use cases have no designed criteria. Authorization and active-store-isolation checks remain open.

**Kane components used:** `context ingest`, `context review`, `design tests`, `testmd run`, `testrun run`, `cover gaps`, `evidence validate`, and `maintain reconcile` (isolated copy).

## Demo and source

Repository: https://github.com/bhuvan1201/LaunchGate (remote exists; current commit has not yet been pushed). Run locally with Node 20+, Chrome, `npm install`, a local `.env` containing `OPENAI_API_KEY`, and `npm run dev`; open http://127.0.0.1:4173. A Kane login is needed to rerun the browser suite. See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for the three-minute flow.

## Known limitations

This is a local demo store with four fixed products, one supported percentage promotion, a manually selected customer type, and no payments, tax, shipping, accounts, or commerce integration. The approved six-check suite establishes those exact checkout examples, not exhaustive correctness. An old run is invalidated when the candidate, source, app, catalog, or required suite changes; the related authorization guardrails were checked locally but do not yet have full Kane browser coverage. The changed $48 campaign in the Maintain demo is not activated or verified in the main app.

## Before submitting

- Push the reviewed commit to the public remote only after the owner approves publication.
- Replace the commit placeholder in the event form with `git rev-parse HEAD` after the final documentation commit.
- Attach or record the final Kane run in the event hub so judges can open its report. Do not imply the local pack path is a public link.
- Save the Submit draft, run preflight, and have the team captain finalize it in the browser.
