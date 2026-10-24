---
assurance:
  id: t-4
  base: sha256:8729c33ea43283e55e6063e7b59f0d3a3124b528fd6b0f17f6bb034e20a2307c
---
# Excluded sale cap remains payable in browser

> Sale Cap stays payable but is omitted from discount and eligible threshold under exclusion.

## Step 1

Open {{start_url}} in the browser and reach the LaunchGate storefront catalog.

## Step 2 @verifies ac-21

In the storefront catalog inspect the Sale Cap, then assert it is marked on sale.

## Step 3

As merchant, confirm a candidate policy of 10% off, minimum eligible subtotal $24.00, maximum discount $100.00, new-customer-only false, exclude-sale-items true; open its storefront preview.

## Step 4 @verifies ac-2, ac-3, ac-4

In the candidate preview set demo status to new and put one $24.00 Canvas Tote and one $15.00 Sale Cap in the cart; inspect checkout, then assert eligible subtotal is $24.00, discount is $2.40 only on eligible merchandise, and payable including the cap is $36.60.
