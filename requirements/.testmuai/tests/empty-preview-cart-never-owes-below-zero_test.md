---
assurance:
  id: t-7
  base: sha256:85743a842be73ef4ae5ac1f88019b0ca81eade4fadcaa8107a5d0ffdc800986b
---
# Empty preview cart never owes below zero

> With an empty cart, observe $0.00 owed and no negative total.

## Step 1

At {{start_url}}, open the LaunchGate browser preview of the merchant-confirmed Welcome 20 candidate without editing or reconfirming it.

## Step 2 @verifies ac-20

In the candidate preview, leave the cart empty and select a new demo customer, then inspect checkout and assert $0.00 owed.

## Step 3 @verifies ac-20

With the cart still empty in the same preview, change only the demo customer selector to returning, then inspect checkout and assert $0.00 owed.
