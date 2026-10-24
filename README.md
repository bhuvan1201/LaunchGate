# LaunchGate

Describe a promotion, confirm what OpenAI interpreted, preview its deterministic checkout, and activate only after a real Kane CLI browser suite passes for the current candidate.

## Run locally

Requires Node 20.19+ or 22.12+, npm, Chrome, and an authenticated Kane CLI 0.10.0 or newer. Run `npm install`, copy `.env.example` to `.env`, set `OPENAI_API_KEY` locally, then `npm run dev`. Open http://127.0.0.1:4173. The key remains server-side. Without a key, the manual policy editor and storefront still work; AI interpretation shows a setup error.

Run `npm test` for pricing boundaries and `npm run build` for type and production checks. The demo store is local, with no real payments or identity checks.

## Verify a new promotion

1. Describe the promotion and click **Interpret with OpenAI**, or edit the supported policy fields directly. Review the fields and confirm a candidate.
2. Click **Generate tests with Kane**. This sends the confirmed structured policy and demo catalog to Kane, consumes credits, and creates a separate assurance store for that revision.
3. Review the proposed journeys, their details and citations. Select the relevant checkout use cases and click **Approve selected journeys and design tests**. Answer any questions Kane raises in the app.
4. Review the actual generated test files, criteria, scenarios and gaps, then click **Approve these checks for this revision**. Nothing is auto-approved. This version approves the complete generated design; leave an unsuitable design unapproved.
5. Click **Run Kane verification**. Only the approved files for that candidate run. Passing standalone CLI tests does not update the application's launch gate.
6. Activate only after the app reports complete passing evidence for the current candidate and suite.

Artifacts live under ignored `data/campaigns/<revision>/`: `campaign.md`, `assurance.json`, `.context/`, `.testmuai/tests/`, `suite.json`, and `.testmuai/evidence/`. The suite is bound to the revision, reviewed policy, requirements, test bytes, and variable files. Changing any reviewed file invalidates approval. A new revision needs a new suite even if its policy numbers are identical.

The original `verification-suite.json` and `requirements/` tests are retained as historical demo evidence; the app no longer selects them as its current suite. Earlier six-pass results do not prove this new generation workflow.

Kane extraction/design can pause for human answers and can take several minutes. Browser runs are visible by default and use your current Kane profile's Test Manager destination. An interrupted or failed generation preserves its workspace and stays unapproved; inspect the saved sessions before retrying paid work. Use Recover preparation to restore completed work or a saved question. If recovery cannot continue, Start fresh preparation preserves the old attempt and starts a new one. Any missing browser-test details can be entered in the app. Provider outages or an expired backend sign-in still need the operator to restore the service; the merchant is never asked to run commands. Do not run external Kane mutations in a workspace while the app is using it.

This is a local, single-user prototype. The fixed catalog may not reach every requested threshold or cap. Generated coverage gaps must be reviewed; selected passing examples are not exhaustive proof. OpenAI proposes policy fields, the merchant owns the final policy, Kane derives tests independently from its requirements, and deterministic code calculates checkout amounts. Unsupported natural-language clauses still need careful review; this change does not claim to solve every interpretation ambiguity.

For merchants, use the browser buttons only. Natural-language changes must be interpreted before confirmation; direct policy entry is a separate mode. Requests containing known unsupported shipping, schedule, rewards, tax or bundle clauses are rejected conservatively. The application discloses catalog limits and blocks a minimum that no demo cart can reach. This is not a general commerce-policy engine.

Development-only pause: starting the server with `KANE_EXECUTION_PAUSED=1` disables all app-triggered Kane preparation and execution, with a visible browser notice. Drafting, interpretation, confirmation and cart preview remain available. Only the operator changes this setting; no merchant commands are required.

Opening `/` starts at Define offer with a blank draft. Continue saved promotion explicitly restores the local candidate; Start a new promotion clears only the browser draft. Confirming an offer creates the next saved revision. Campaign links (`/?campaign=<revision>`) resume only the matching current candidate, including the entry URL given to future Kane-generated suites. Existing test definitions are not automatically rewritten. This remains one shared local workspace, without merchant accounts.

## Prepared demo and independent CLI testing

After confirmation, **Present this campaign** shows the confirmed policy and interactive cart. Evidence and activation controls stay in the editing workspace; present standalone CLI results separately in Kane’s evidence viewer. Reports explicitly distinguish a live run, a saved pass, a failed/incomplete run, and evidence that no longer authorizes launch. **Back to editing** restores the workspace; test generation/review is in an expandable preparation section. No view change starts Kane or changes approval.

For independent operator testing, `npm run --silent kane:prepare` exports the current confirmed requirements and preview URL to a separate `data/operator/` workspace without calling Kane. Follow [the operator guide](docs/KANE_OPERATOR_GUIDE.md) to extract, review, design, run individual checks, run the full suite, and open its evidence. Independent CLI results are shown in Kane's viewer; they do not populate the app report or unlock activation. Preserve a prepared, tested candidate for the presentation; edited policies require fresh evidence.
