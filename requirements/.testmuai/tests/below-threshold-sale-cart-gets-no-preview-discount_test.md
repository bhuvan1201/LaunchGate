---
assurance:
  id: t-5
  base: sha256:57ce6ceaa4f0d440856a8d302d6d784f32cc6211d306fefb3dfb9862bcc772e0
---
# Below-threshold sale cart gets no preview discount

> A new customer with one Tote and one Sale Cap has only $24.00 eligible and receives no discount; full total is $39.00.

## Step 1

At {{start_url}}, open the LaunchGate browser preview of the merchant-confirmed Welcome 20 candidate without editing or reconfirming it.

## Step 2 @verifies ac-16, ac-17

In the candidate preview's cart and demo customer selector, choose a new customer with one Canvas Tote and one Sale Cap, then inspect the checkout amounts and assert a $0.00 discount and $39.00 owed.
