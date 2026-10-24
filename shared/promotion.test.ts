import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDiscountCents, quote, type Policy } from './promotion.js';

const policy: Policy = { title: 'Welcome 20', percentOff: 20, minimumEligibleCents: 4200, maximumDiscountCents: 1000, newCustomersOnly: true, excludeSaleItems: true };
test('boundary, eligibility, exclusions, and cap use integer cents', () => {
  assert.deepEqual(quote({ quantities: { tote: 1, mug: 1 }, customerType: 'new' }, policy), { subtotalCents: 4200, eligibleSubtotalCents: 4200, discountCents: 840, totalCents: 3360, reason: 'Promotion applied' });
  assert.equal(quote({ quantities: { tote: 1, cap: 2 }, customerType: 'new' }, policy).discountCents, 0);
  assert.equal(quote({ quantities: { hoodie: 1 }, customerType: 'returning' }, policy).discountCents, 0);
  assert.equal(quote({ quantities: { hoodie: 1 }, customerType: 'new' }, policy).discountCents, 1000);
  assert.equal(quote({ quantities: { tote: 1, mug: 1, cap: 1 }, customerType: 'new' }, policy).totalCents, 4860);
});
test('rejects unknown merchandise and invalid quantity', () => {
  assert.throws(() => quote({ quantities: { fake: 1 }, customerType: 'new' }, policy));
  assert.throws(() => quote({ quantities: { tote: 1.5 }, customerType: 'new' }, policy));
});
test('rounds a half-cent upward before applying the cap', () => {
  assert.equal(calculateDiscountCents(5, 10, 100), 1);
  assert.equal(calculateDiscountCents(5, 10, 0), 0);
  assert.equal(calculateDiscountCents(1, 100, 100), 1);
});
