# LaunchGate — product requirements

LaunchGate lets a merchant describe a discount in plain language, review the interpreted policy, verify checkout behavior in a real browser, and activate only the exact candidate revision backed by current passing Kane evidence. This is a local, single-user hackathon prototype. OpenAI interprets the language; deterministic application code calculates all money.

## Merchant flow

1. Merchant enters a promotion sentence. OpenAI returns a proposed percent-off policy, supported fields, and any clarification questions. A missing API key or parse error is visible; nothing is silently confirmed.
2. Merchant reviews and may edit every policy field, then explicitly confirms. Confirmation creates an immutable numbered candidate revision. Editing or confirming again creates a new revision and invalidates previous verification for the new candidate. The old active revision remains active.
3. Merchant previews the candidate in a fixed four-product storefront. The store also has an active-campaign view. The demo customer switch explicitly sets new or returning status; it is not real identity verification.
4. Merchant runs the reviewed, requirement-derived Kane checkout suite. The server records actual terminal results, evidence location, tested revision, and source fingerprint. Missing, partial, failed, or stale runs cannot verify.
5. Merchant activates the candidate. The server rechecks the exact candidate revision, test manifest, and source fingerprint. Activation is refused until all required Kane checks passed. The active storefront then uses that revision.

## Discount semantics

- USD amounts are integer cents. Exactly four fixed items appear in the catalog: Canvas Tote $24.00, Ceramic Mug $18.00, Weekend Hoodie $58.00, and Sale Cap $15.00 (marked on sale).
- Policy fields: percentage from 1 through 100, minimum eligible subtotal in cents (inclusive), maximum discount in cents (positive), new-customer-only boolean, and exclude-sale-items boolean.
- Eligible subtotal is the pre-discount subtotal of eligible merchandise. Excluded sale items neither receive the discount nor count toward the threshold, but remain in the payable subtotal.
- At exactly the minimum eligible subtotal the discount applies. If new-customer-only is true, a returning customer receives no discount.
- Compute percent once on eligible cart subtotal and round half up to cents, then cap at maximum discount and eligible subtotal. Total payable cannot be negative.
- Unknown product IDs, noninteger quantities, and invalid policies are rejected. Quantity may be 0–20 per item.

## Verification contract

- Kane-generated tests derive from this PRD and are reviewed by the participant before they authorize activation. No manually invented pass is accepted.
- Required checkout checks cover qualifying new customer, below-threshold cart, returning customer, excluded sale item, threshold equality, and capped discount. Each must use the actual app UI, visible calculated amounts, and a genuine terminal Kane result.
- A candidate is verified only when all reviewed required checks return a terminal passed status with actual evidence. A process exit code or green UI badge alone is insufficient.
- Verification is bound to candidate revision, policy, catalog, test manifest, and current application source. Any change in these invalidates verification for activation.
- The verification runner is local and single-job. A timeout, crash, absent result, missing evidence, or source change during a run refuses authorization. Results report what the selected checks proved, not universal correctness.

## Non-goals

No payments, taxes, shipping, accounts, real customer identity, Shopify, remote deployment, stacking promotions, or arbitrary coupon types. The AI is never trusted to calculate checkout totals or assert test success.
