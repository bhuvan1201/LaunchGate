import assert from 'node:assert/strict';
import { test } from 'node:test';
import { suiteMatchesCandidate, type Revision, type Suite } from './state.js';

const policy = {
  title: 'Welcome 20',
  percentOff: 20,
  minimumEligibleCents: 4200,
  maximumDiscountCents: 1000,
  newCustomersOnly: true,
  excludeSaleItems: true,
};
const revision: Revision = { id: 1, sourceText: 'demo request', policy, confirmedAt: '2026-10-24T00:00:00.000Z' };
const suite: Suite = { folder: 'requirements', expectedPolicy: policy, tests: [] };

test('the reviewed checkout suite accepts its exact confirmed policy', () => {
  assert.equal(suiteMatchesCandidate(revision, suite), true);
});

test('the reviewed checkout suite refuses a different promotion or title', () => {
  assert.equal(suiteMatchesCandidate({ ...revision, policy: { ...policy, percentOff: 10 } }, suite), false);
  assert.equal(suiteMatchesCandidate({ ...revision, policy: { ...policy, title: 'Other campaign' } }, suite), false);
});
