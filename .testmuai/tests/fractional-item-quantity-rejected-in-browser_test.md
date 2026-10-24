---
assurance:
  id: t-8
  base: sha256:752d6e3ec368522d5c23ed2b60e562e8843a41342271e77b745a80e0da01c660
---
# Fractional item quantity rejected in browser

> Checkout rejects a noninteger per-item quantity.

## Step 1

Open {{start_url}} in the browser and reach the LaunchGate merchant flow.

## Step 2

As merchant, confirm a candidate policy of 10% off, minimum eligible subtotal $18.00, maximum discount $100.00, new-customer-only false, exclude-sale-items false; open its storefront preview.

## Step 3 @verifies ac-23

In the candidate storefront attempt checkout with 1.5 Canvas Totes as the item quantity, then assert no checkout accepting the noninteger quantity is produced.
