---
assurance:
  id: t-4
  base: sha256:b377156fd92b9e0b8f2c3403e35cf5f1210d22d78f47dfa94bbe9b46706110c6
---
# Returning customer pays full Hoodie amount

> A returning customer with one Weekend Hoodie receives no promotion and owes $58.00 despite eligible non-sale merchandise.

## Step 1

At {{start_url}}, open the LaunchGate browser preview of the merchant-confirmed Welcome 20 candidate without editing or reconfirming it.

## Step 2 @verifies ac-14, ac-15

In the candidate preview's cart and demo customer selector, choose a returning customer with one Weekend Hoodie, then inspect checkout amounts and assert a $0.00 discount and $58.00 owed.
