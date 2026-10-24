---
assurance:
  id: t-2
  base: sha256:ad73fab385af943ea2615ba53df181d61f99709ed545fe2ca54319c562e455c7
---
# Below-threshold candidate cart in browser

> Eligible cart below the minimum receives no discount.

## Step 1

Open {{start_url}} in the browser and reach the LaunchGate merchant flow.

## Step 2 @verifies ac-12

As merchant, confirm a candidate policy of 10% off, minimum eligible subtotal $24.00, maximum discount $100.00, new-customer-only false, exclude-sale-items false; open its storefront preview, then assert the candidate-policy view is present.

## Step 3 @verifies ac-6

In that candidate preview set demo status to new and put one $18.00 Ceramic Mug in the cart; inspect checkout, then assert no discount applies below the $24.00 eligible minimum and payable is $18.00.
