---
assurance:
  id: t-6
  base: sha256:5666252535dfe2a528c6181c43f6217985302bd39ca81eebd11db6611d23f99c
---
# Maximum-discount cap in browser

> Calculated percentage above configured maximum is capped.

## Step 1

Open {{start_url}} in the browser and reach the LaunchGate merchant flow.

## Step 2

As merchant, confirm a candidate policy of 50% off, minimum eligible subtotal $18.00, maximum discount $5.00, new-customer-only false, exclude-sale-items false; open its storefront preview.

## Step 3 @verifies ac-8, ac-10

In the candidate preview set demo status to new and put one $24.00 Canvas Tote in the cart; inspect the checkout amounts, then assert the discount is capped at $5.00 rather than $12.00, payable is $19.00, and payable is not negative.
