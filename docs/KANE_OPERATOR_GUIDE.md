# Generate and run LaunchGate tests yourself

The demo approach is: prepare and review a complete suite before judging, show its saved evidence, demonstrate the merchant flow live, then optionally replay one rehearsed test. Numbers remain editable. A changed candidate requires fresh tests and evidence. Do not generate a new suite during a three-minute presentation.

Two workflows remain separate:

- **Independent CLI testing (below):** tests the confirmed checkout and produces real Kane evidence. View that report in Kane's evidence viewer. It does not populate LaunchGate's report or unlock activation.
- **App-managed verification:** expand Prepare or review this campaign's checks, generate, review journeys, review tests, and run verification. Only this reviewed suite and its complete current evidence can unlock the app's activation button. It remains paused until the operator explicitly enables it.

This guide targets the local assurance store, not a shared-project link. Test Manager uploads use the current Kane profile destination. These are different settings. No tests are handwritten by the export command.

## 1. Keep the app running

The app is already running on http://127.0.0.1:4173. Do not start a second copy. If it is stopped, start it in Terminal 1:

```bash
cd /Users/bhuvan/Downloads/Hackathon-Kane
KANE_EXECUTION_PAUSED=1 npm run dev
```

That pause blocks app-triggered Kane jobs, not the CLI commands you run in another terminal. Keep the server running. After a source-code change restart it before testing. Do not change the campaign or source code during a suite run.

In the browser, describe your promotion, interpret it, review it, and confirm it. The latest confirmed policy is the one the next step exports. You can use **Present this campaign** after confirming; **Back to editing** returns to the workspace. This toggle only changes the view and never starts tests.

## 2. Export the actual confirmed policy

In Terminal 2:

```bash
cd /Users/bhuvan/Downloads/Hackathon-Kane
LAUNCHGATE_SUITE="$(npm run --silent kane:prepare)" && cd "$LAUNCHGATE_SUITE"
pwd
cat campaign.md
```

`kane:prepare` writes requirements and a start-URL variable under `data/operator/revision-<id>-<fingerprint>/`. It does not call Kane, send data, generate test cases, modify the campaign, or approve anything. Repeating it for the same policy/build preserves the workspace. A new confirmed revision or app build produces a different folder. Do not use the historical Welcome 20 files under `requirements/` for a changed offer.

Review `campaign.md` before sending it. It includes the confirmed structured policy, catalog, supported checkout behavior and exact `/?campaign=<id>` link. It excludes `.env` and raw merchant instructions. Keep this terminal in the exported directory for all following commands.

## 3. Check readiness

```bash
sh /Users/bhuvan/.agents/skills/kane-cli/scripts/preflight.sh
```

Check sign-in, available credits, Chrome and the Test Manager project/folder. If sign-in has expired:

```bash
kane-cli login --oauth
```

Extraction, design, authoring and browser runs consume credits. The first execution authors the browser steps and can take minutes per test; later unchanged runs normally replay faster. The `--max 8` below limits test count, not spend. No headless flag is used, so the browser stays visible.

## 4. Extract and review use cases

```bash
kane-cli context ingest campaign.md --mode agent
kane-cli context list --json --inferred
```

If extraction exits with code 3 and a `session_paused` event, answer the questions using its printed resume command before continuing. Do not start another ingestion. Find resumable sessions with:

```bash
kane-cli context sessions --json
```

Copy a real use-case ID from the output. `ACTUAL_USE_CASE_ID` below is a placeholder, not an ID to run unchanged:

```bash
LAUNCHGATE_UC='ACTUAL_USE_CASE_ID'
kane-cli context explain "$LAUNCHGATE_UC" --json
```

Read the full use case and citations. Only if you agree:

```bash
kane-cli context review --approve "$LAUNCHGATE_UC" --json
kane-cli design tests --use-case "$LAUNCHGATE_UC" --mode agent --max 8
```

If there are several relevant use cases, inspect, approve and design each one separately. Never run two context-writing commands concurrently. Resume a paused design using the command Kane prints; do not silently accept its questions or repeatedly restart a paid command.

## 5. Review the generated tests

```bash
kane-cli context list --json --inferred
rg --files --hidden .testmuai/tests -g '*_test.md'
```

Open the generated `_test.md` files in VS Code. Inspect the acceptance criteria, scenarios and tests using their actual returned IDs:

```bash
kane-cli context explain ACTUAL_ITEM_ID --json
```

Check the campaign URL/revision, independent expected amounts, customer eligibility, minimum boundary, cap, sale treatment, empty cart, and any reported gaps. These tests must only change cart quantities and customer type; they must not edit or confirm the policy or activate anything. If a threshold cannot be reached by this catalog, it should be reported as a gap rather than invented coverage.

Approve only the criteria, scenarios and tests you have actually reviewed. Replace the example IDs with all the applicable real IDs:

```bash
kane-cli context review --approve ACTUAL_AC_ID ACTUAL_SCENARIO_ID ACTUAL_TEST_ID --json
```

Repeat for additional reviewed items as needed. Do not run an unapproved test. Do not hand-edit generated tests to make failures pass; classify the problem first and redesign through Kane when the test itself needs changing.

## 6. Run one test and read its result

Choose one of the actual filenames you reviewed:

```bash
LAUNCHGATE_TEST='.testmuai/tests/ACTUAL_FILENAME_test.md'
kane-cli testmd run "$LAUNCHGATE_TEST" --agent
echo $?
```

Wait for the file-level `test_md_done` event and process exit. A passing individual browser step is not a passing test. Exit 0 means success; read failures or refusals before retrying. Run the same command later to replay this check during the demo, provided neither the policy nor its test has changed.

## 7. Run the complete reviewed suite

Only use this glob when **every** test in this fresh workspace has been reviewed and approved. Otherwise name just the approved files explicitly. Preview the plan first:

```bash
kane-cli testrun run .testmuai/tests/*_test.md --dry-run --agent < /dev/null
```

Resolve missing variables before execution. The export provides `start_url`; if Kane uses a different variable name, supply the actual preview URL in its variable pool after reviewing the test. A valid plan can still report unresolved variables. Never provide a made-up value merely to silence a warning.

Then run:

```bash
kane-cli testrun run .testmuai/tests/*_test.md --name 'LaunchGate prepared demo suite' --agent < /dev/null
echo $?
kane-cli cover gaps
```

Read `testrun_summary`, `testrun_done`, and the exit code. Exit 0 means all selected members passed; 1 indicates failure, 2 a refused/invalid plan, and 3 cancellation. Coverage may still show unproven requirements even when the selected tests all pass.

## 8. Open the saved evidence

```bash
rg --files --hidden .testmuai/evidence -g '*.evidence'
```

Use the pack path printed by the completed suite, not an arbitrary older pack:

```bash
LAUNCHGATE_PACK='.testmuai/evidence/ACTUAL_EXECUTION_ID.evidence'
kane-cli evidence validate "$LAUNCHGATE_PACK" --json
kane-cli evidence serve "$LAUNCHGATE_PACK"
```

Open the printed **viewer** URL. Leave the evidence server running while presenting. A valid pack means its integrity checks passed; read its actual test results to establish whether the suite passed. View the screenshots, assertions and failures there. The app does not import this standalone report.

## 9. Three-minute presentation

- **0:00–0:30:** Open the completed Kane report and state the real pass count, revision and when it ran. Label it saved evidence.
- **0:30–1:40:** Show the confirmed policy in LaunchGate's presentation view. Change cart quantities or customer type to demonstrate actual checkout behavior.
- **1:40–2:20:** Optionally replay the one test you rehearsed. Show its live result only if it completes; otherwise say it is still running and keep the earlier report clearly labeled.
- **2:20–3:00:** Explain one documented bug Kane caught and the fix, using its original failure and rerun evidence. Do not manufacture a failure or claim an unverified story.

If you want to demonstrate a new natural-language request and interpretation, use a separate rehearsal/session before freezing the evidence-backed candidate. Confirming a new revision invalidates the old one for launch, even if the numbers happen to be identical. You can show unconfirmed editing without claiming it has been tested.

This checkout suite does not by itself prove the full merchant journey, OpenAI interpretation, test preparation, review flow, or activation/stale-evidence protections. Those need separate app-level validation, ideally against an isolated instance so they cannot replace the presentation candidate.
