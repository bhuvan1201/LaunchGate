import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignLimits, unsupportedRequest } from './campaign-scope.js';
const policy = { title: 'Merchant offer', percentOff: 20, minimumEligibleCents: 8200, maximumDiscountCents: 2000, newCustomersOnly: true, excludeSaleItems: true };
test('supported values remain flexible while unsupported shipping is not silently discarded', () => {
  assert.equal(unsupportedRequest('Give everyone 35% off above $123 with a $29 cap, including sale items.'), null);
  assert.match(unsupportedRequest('Give 20% off above $82 with a $20 cap and free shipping.') || '', /cannot implement/);
  assert.match(unsupportedRequest('Start this promotion tomorrow.') || '', /scheduled/);
});
test('catalog feasibility distinguishes impossible minimums from disclosed cap and boundary limits', () => {
  assert.deepEqual(campaignLimits(policy), { blocking: [], notes: [] });
  assert.equal(campaignLimits({ ...policy, minimumEligibleCents: 1000000 }).blocking.length, 1);
  assert.equal(campaignLimits({ ...policy, minimumEligibleCents: 8201 }).notes.length, 1);
  assert.equal(campaignLimits({ ...policy, maximumDiscountCents: 1000000 }).notes.length, 1);
  assert.deepEqual(campaignLimits({ ...policy, minimumEligibleCents: 0, maximumDiscountCents: 1, newCustomersOnly: false, excludeSaleItems: false }), { blocking: [], notes: [] });
});
