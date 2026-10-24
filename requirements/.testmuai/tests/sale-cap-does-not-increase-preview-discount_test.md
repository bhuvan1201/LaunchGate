---
assurance:
  id: t-3
  base: sha256:fdb8ec6a1030e07844599cd429311d757bd6141cc1a1960e29f11cf766a403a0
---
# Sale Cap does not increase preview discount

> A new customer with one Tote, one Mug, and one Sale Cap receives $8.40 off only the $42.00 eligible subtotal and owes $48.60.

## Step 1

At {{start_url}}, open the LaunchGate browser preview of the merchant-confirmed Welcome 20 candidate without editing or reconfirming it.

## Step 2 @verifies ac-12, ac-13

In the candidate preview's cart and demo customer selector, choose a new customer with one Canvas Tote, one Ceramic Mug, and one Sale Cap, then inspect the checkout amounts and assert an $8.40 discount and $48.60 owed.
