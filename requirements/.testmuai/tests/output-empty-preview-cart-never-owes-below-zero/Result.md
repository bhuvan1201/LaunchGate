---
test: ../empty-preview-cart-never-owes-below-zero_test.md
status: passed
started: 2026-10-24T19:28:01.395Z
duration_s: 79
session_id: 73b64c72-8db8-430b-87a5-81d60ab982c0
---

# Empty preview cart never owes below zero — Result

## Step 1 ✓ passed (17.6s)
md5: b97245eb4e044d0f508fd273a0107e89
At {{start_url}}, open the LaunchGate browser preview of the merchant-confirmed Welcome 20 candidate without editing or reconfirming it.

## Step 2 ✓ passed (28.3s)
md5: c3c96dd2d6fad2bca0d9399c6b851436
In the candidate preview, leave the cart empty and select a new demo customer, then inspect checkout and assert $0.00 owed.

## Step 3 ✓ passed (26.1s)
md5: a6f19f0160f81021fad25e15c703c2f7
With the cart still empty in the same preview, change only the demo customer selector to returning, then inspect checkout and assert $0.00 owed.
