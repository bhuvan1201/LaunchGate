---
assurance:
  id: t-6
  base: sha256:f8596726c1e177e359dc13c7d8cc3c9f2876b8cf3842c625d865f1a28c758f50
---
# Hoodie preview discount is capped

> A new customer with one Weekend Hoodie receives the $10.00 discount cap and owes $48.00.

## Step 1

At {{start_url}}, open the LaunchGate browser preview of the merchant-confirmed Welcome 20 candidate without editing or reconfirming it.

## Step 2 @verifies ac-18, ac-19

In the candidate preview's cart and demo customer selector, choose a new customer with one Weekend Hoodie, then inspect the checkout amounts and assert a $10.00 discount and $48.00 owed.
