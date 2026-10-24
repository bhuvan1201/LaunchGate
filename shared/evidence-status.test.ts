import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evidenceStatus, type RunReport } from './evidence-status.js';

test('a saved pass is not presented as current launch evidence after a change', () => {
  const report: RunReport = { revisionId: 3, status: 'passed', evidenceLogs: ['a'] };
  assert.equal(evidenceStatus(report, 3, true).label, 'Saved passing report');
  assert.equal(evidenceStatus(report, 3, false).label, 'Fresh verification required');
  assert.equal(evidenceStatus(report, 4, true).label, 'Different revision');
});
test('empty, running and failed evidence are never described as a completed pass', () => {
  assert.equal(evidenceStatus(null, 3, false).label, 'Not verified yet');
  assert.equal(evidenceStatus({ revisionId: 3, status: 'running', evidenceLogs: [] }, 3, false).label, 'Live run in progress');
  assert.equal(evidenceStatus({ revisionId: 3, status: 'failed', evidenceLogs: [] }, 3, false).tone, 'failed');
});
