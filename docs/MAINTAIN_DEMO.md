# Kane Maintain demonstration — proposed $48 threshold

This is an **isolated requirements-change exercise**, not a change to the verified LaunchGate demo. The live app, `requirements/demo-campaign.md`, and its six passing $42 checks remain untouched. The exercise ran in `/private/tmp/launchgate-maintain-demo/requirements` on October 24, 2026.

## Changed rule

The sample campaign minimum increased from **$42.00 to $48.00 inclusive**. Under the proposed rule, a new customer with one Canvas Tote and one Ceramic Mug would owe **$42.00** with no discount, instead of $33.60. Adding a Sale Cap would leave the eligible subtotal at $42.00 and produce **$57.00** due. Two Canvas Totes would qualify exactly at $48.00, receive $9.60 off, and leave $38.40 due. The cap, new-customer rule, and sale-item exclusion did not change.

## What Kane did

The revised sample was passed to:

```bash
KANE_CLI_USER_AGENT=codex kane-cli maintain reconcile --from demo-campaign.md --source-id demo-campaign --mode agent
```

Kane completed the reconciliation with **3 applied rows, 7 skipped, 0 failed, and 0 paused**. It updated the promotion-confirmation and checkout use cases and produced derived $48 criteria and browser scenarios in the isolated store, including “Two Totes qualify at exactly $48” and “Tote and Mug below threshold owe $42.” The old `confirmed-preview-qualifies-at-exactly-42_test.md` file also remains there; the command did not rewrite or rerun the approved live suite. That coexistence is why the updated material needs a human review before any revised campaign is verified.

`kane-cli cover gaps --json` on the isolated copy reports **0/41 criteria proven** after the change. The six-check $42 pass is evidence for the original campaign only. No claim is made that the $48 campaign passes, is activated, or is ready to activate. Completing that path would require approving the new derived criteria and tests, configuring a $48 candidate in an isolated app state, and running the reviewed suite there.

## Live-demo boundary

Show the local $42 app as the working product and passing report. Use this Maintain output only to show how Kane flags the impact of a changed requirement. Do not replace the live requirement or candidate before the mentor and judge demos.
