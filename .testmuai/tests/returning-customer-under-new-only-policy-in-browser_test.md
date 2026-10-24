---
assurance:
  id: t-3
  base: sha256:99c26f126d2e904c6b6299ce9aaa175e993fb085890054e6aeb7c735d1566ed0
---
# Returning customer under new-only policy in browser

> Returning status receives no discount when the candidate is new-customer-only.

## Step 1

Open {{start_url}} in the browser and reach the LaunchGate merchant flow.

## Step 2

As merchant, confirm a candidate policy of 10% off, minimum eligible subtotal $18.00, maximum discount $100.00, new-customer-only true, exclude-sale-items false; open its storefront preview.

## Step 3 @verifies ac-15

In the candidate storefront explicitly set the demo customer status to returning, then assert the displayed status is returning customer.

## Step 4 @verifies ac-7

With returning status in that preview put one $24.00 Canvas Tote in the cart and inspect checkout, then assert no discount applies and payable is $24.00.
