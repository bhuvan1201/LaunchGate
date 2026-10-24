# LaunchGate demo script

Start from the local app at http://127.0.0.1:4173. The prepared local state is candidate #1, **Welcome 20**, verified but not activated. Keep the Kane evidence viewer and [OpenAI setup run](https://test-manager.lambdatest.com/projects/01M5QMFX6A3MX0GAMMTVB8H1GJ/test-cases/01M5QP0ETBMRJ9NDGVSEGK35Q5/dashboard/share/US_FXICM1JHLBJHXI60D76MWOZ3RG2289UKTJIPRCLRU6EWAQ9RFHI0SPLXQVLYA62P?type=summary&agentView=true&fqdn=summary-page) ready in separate tabs.

## Three-minute stage flow

1. **Lead with Kane (0:00–0:30).** Scroll to the launch gate: six of six candidate checkout checks passed, with the sealed pack downloadable. Say that the server binds the result to the candidate, source, app, catalog, and exact suite. Do not claim full coverage: Kane proves 11 of 20 criteria in the candidate-verification use case; authorization and active-store isolation remain open.
2. **Show one real flow (0:30–2:10).** Show the plain-English merchant request and click **Interpret with OpenAI**. Point to the six editable fields, then the already-confirmed candidate preview. Add one Canvas Tote and one Ceramic Mug for a new customer: $42.00 eligible, $8.40 discount, $33.60 due. Toggle to **Active store**: no campaign is active. Return to the launch gate and click **Activate verified revision**. The active store now shows the verified price. Avoid reconfirming the policy during this demo, because that creates a new revision and correctly invalidates the old run.
3. **End on what Kane exposed (2:10–3:00).** A broad Kane browser run reached the verification control while an unrelated 10% campaign was present. That revealed the app would launch the fixed Welcome 20 suite against the wrong policy. The server now rejects that attempt with HTTP 400 and only enables the six-check suite for the exact reviewed policy. The final candidate run passed all six checks. Show the general run's failure record and the final passing run report; explain that the sale-label navigation failure in the general suite was a test navigation issue, not a pricing defect.

## Evidence and limits

- OpenAI browser setup: saved as `.testmuai/tests/launchgate_openai_candidate_setup_test.md`; the real API interpretation returned the exact policy and Kane confirmed it in the UI.
- Initial general Kane suite: 4/6 passed. Evidence pack: `.testmuai/evidence/09bac6af-6931-4583-9bd9-c50ed3e63b88.evidence`. One test missed the sale label while on the active-store tab; another pressed verification against a temporary candidate and got stuck. Neither is counted as a passing result.
- Final read-only candidate suite: 6/6 passed in 6m 34s, two replayed and four first recordings. Evidence pack: `requirements/.testmuai/evidence/a62515b9-21d7-4bb2-9cda-383af2b89725.evidence`. The app serves it at `/api/evidence`.
- Activation was exercised after the pass: the active store returned $33.60 for Tote + Mug. Local state was then restored to verified, unactivated candidate #1 for the live demo.
- The gate rejected a wrong candidate before running Kane. Temporarily changing the suite manifest or requirement source locked activation; restoring the exact files restored eligibility. No real payments, identity checks, or external commerce integration are included.

If the browser or network stalls, use the saved Kane reports and evidence pack, then show the deterministic checkout and activation state already prepared locally. Do not claim a live action that was not shown.
