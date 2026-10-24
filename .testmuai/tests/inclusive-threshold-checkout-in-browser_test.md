---
assurance:
  id: t-5
  base: sha256:05c63a4f38c96fcd4634c90ebd1de2426e1403aaeb484d0bd7cf211f1d23e731
---
# Inclusive threshold checkout in browser

> Cart exactly at minimum eligible subtotal qualifies.

## Step 1

Open {{start_url}} in the browser and reach the LaunchGate merchant flow.

## Step 2

As merchant, confirm a candidate policy of 10% off, minimum eligible subtotal $24.00, maximum discount $100.00, new-customer-only false, exclude-sale-items false; open its storefront preview.

## Step 3 @verifies ac-5

In the candidate preview set demo status to new and put one $24.00 Canvas Tote in the cart, exactly meeting the minimum; inspect checkout, then assert a $2.40 discount applies and payable is $21.60.
