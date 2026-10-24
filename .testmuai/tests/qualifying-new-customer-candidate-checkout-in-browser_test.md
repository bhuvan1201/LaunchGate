---
assurance:
  id: t-1
  base: sha256:11c5d1d2bf6aa2b10707ca1b6c48ab8a80c088f5ff29dedb3e195bc04da1f416
---
# Qualifying new-customer candidate checkout in browser

> New customer observes candidate eligible discount and payable amount on an above-threshold cart.

## Step 1 @verifies ac-16

Open {{start_url}} in the browser and reach the LaunchGate merchant storefront catalog, then assert the catalog contains exactly four products.

## Step 2 @verifies ac-17

In the catalog, inspect Canvas Tote's listed price, then assert it is $24.00.

## Step 3 @verifies ac-12

As merchant, establish and confirm a candidate policy of 10% off, minimum eligible subtotal $18.00, maximum discount $100.00, new-customer-only false, exclude-sale-items false; reach its storefront preview, then assert the candidate-policy storefront view is present.

## Step 4 @verifies ac-14

In the candidate storefront set the demo customer status to new, then assert the status explicitly reads new customer.

## Step 5 @verifies ac-10

In that candidate preview, put one Canvas Tote in the cart and inspect the calculated checkout amounts, then assert the displayed discount is $2.40, payable is $21.60, and the payable total is at least zero.
