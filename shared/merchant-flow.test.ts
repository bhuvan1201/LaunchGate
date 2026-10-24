import assert from 'node:assert/strict';
import { test } from 'node:test';
import { merchantStep, numberDraft, policySummary, reviewDraft } from './merchant-flow.js';
const policy = { title: 'Weekend offer', percentOff: 15, minimumEligibleCents: 3750, maximumDiscountCents: 700, newCustomersOnly: false, excludeSaleItems: true };
test('merchant money entry preserves cents and rejects incomplete or overprecise input', () => {
  assert.deepEqual(reviewDraft(policy, numberDraft(policy)), { policy, errors: {} });
  assert.equal(reviewDraft(policy, { percentOff: '25', minimum: '82.', cap: '20.01' }).policy?.maximumDiscountCents, 2001);
  assert.equal(reviewDraft(policy, { percentOff: '15', minimum: '', cap: '7' }).policy, null);
  assert.equal(reviewDraft(policy, { percentOff: '15', minimum: '37.501', cap: '7' }).policy, null);
  assert.equal(reviewDraft(policy, { percentOff: '15.5', minimum: '37.50', cap: '7' }).policy, null);
  assert.match(reviewDraft(policy, { percentOff: '15', minimum: '37.50', cap: '0' }).errors.maximumDiscountCents, /\$0.01/);
});
test('review summary expresses eligibility, minimum and cap without changing the promise', () => {
  assert.equal(policySummary(policy), 'All customers receive 15% off non-sale merchandise when eligible items total at least $37.50, with savings capped at $7.00.');
});
test('merchant guidance never presents an unverified or unsaved offer as ready to activate', () => {
  const base = { hasCandidate: true, draftChanged: false, suiteReady: false, running: false, canActivate: false, active: false };
  assert.equal(merchantStep(base).step, 2);
  assert.equal(merchantStep({ ...base, hasCandidate: false, suiteReady: true, canActivate: true }).step, 1);
  assert.equal(merchantStep({ ...base, hasCandidate: false }).title, 'Define your promotion');
  assert.equal(merchantStep({ ...base, preparation: 'failed' }).title, 'Resume test preparation');
  assert.equal(merchantStep({ ...base, preparation: 'needs-input' }).title, 'One more detail is needed');
  assert.equal(merchantStep({ ...base, suiteReady: true }).step, 3);
  assert.equal(merchantStep({ ...base, canActivate: true }).step, 4);
  assert.equal(merchantStep({ ...base, canActivate: true, draftChanged: true }).step, 1);
  assert.equal(merchantStep({ ...base, running: true }).title, 'Your checkout is being tested');
});
