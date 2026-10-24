---
test: ../below-threshold-sale-cart-gets-no-preview-discount_test.md
status: passed
started: 2026-10-24T19:20:59.081Z
duration_s: 74
session_id: 71a87ff9-1b4b-4838-ab67-7ea4a7f5b328
---

# Below-threshold sale cart gets no preview discount — Result

## Step 1 ✓ passed (19.7s)
md5: b97245eb4e044d0f508fd273a0107e89
At {{start_url}}, open the LaunchGate browser preview of the merchant-confirmed Welcome 20 candidate without editing or reconfirming it.

## Step 2 ✓ passed (41.1s)
md5: c2b3f5633e17048c8e635529ffa29a74
In the candidate preview's cart and demo customer selector, choose a new customer with one Canvas Tote and one Sale Cap, then inspect the checkout amounts and assert a $0.00 discount and $39.00 owed.
