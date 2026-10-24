import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { catalog, policySchema, type Policy } from '../shared/promotion.js';

export type Revision = { id: number; sourceText: string; policy: Policy; confirmedAt: string };
export type Verification = { revisionId: number; fingerprint: string; manifestHash: string; status: 'running' | 'passed' | 'failed'; startedAt: string; completedAt?: string; executionId?: string; evidencePack?: string; evidenceHash?: string; evidenceLogs: string[]; checks?: { name: string; status: string; failure?: string }[]; summary?: string };
export type AppState = { revisions: Revision[]; activeRevisionId: number | null; verification: Verification | null };
const stateFile = path.resolve(process.env.LAUNCHGATE_DATA_DIR || 'data', 'state.json');
export function revisionFolder(revision: Revision) { return path.resolve(process.env.LAUNCHGATE_DATA_DIR || 'data', 'campaigns', String(revision.id)); }
const empty = (): AppState => ({ revisions: [], activeRevisionId: null, verification: null });

export function readState(): AppState {
  if (!existsSync(stateFile)) return empty();
  try { return JSON.parse(readFileSync(stateFile, 'utf8')) as AppState; } catch { throw new Error('Local state file could not be read'); }
}
export function writeState(state: AppState) {
  mkdirSync(path.dirname(stateFile), { recursive: true });
  const temporary = `${stateFile}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(state, null, 2));
  renameSync(temporary, stateFile);
}
export function candidate(state: AppState) { return state.revisions.at(-1) ?? null; }
export function active(state: AppState) { return state.revisions.find(item => item.id === state.activeRevisionId) ?? null; }
export function confirm(sourceText: string, policyInput: unknown) {
  const policy = policySchema.parse(policyInput);
  const state = readState();
  const next: Revision = { id: (candidate(state)?.id ?? 0) + 1, sourceText: sourceText.trim(), policy, confirmedAt: new Date().toISOString() };
  if (!next.sourceText) throw new Error('Original promotion request is required');
  state.revisions.push(next);
  state.verification = null;
  writeState(state);
  return next;
}
function sourceFiles(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.')) return [];
    const full = path.join(folder, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : [full];
  });
}
export function appBuildHash() {
  const hash = createHash('sha256');
  const files = ['package.json', 'package-lock.json', 'docs/PRD.md', 'index.html', 'vite.config.ts', ...['src', 'server', 'shared'].flatMap(sourceFiles)].sort();
  for (const file of files) { hash.update(file); hash.update(readFileSync(file)); }
  return hash.digest('hex');
}
const loadedBuildHash = appBuildHash();
export function runtimeCurrent() { return appBuildHash() === loadedBuildHash; }
export function fileDigest(file: string) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
export function fingerprint(revision: Revision) {
  return createHash('sha256').update(JSON.stringify({ id: revision.id, sourceText: revision.sourceText, policy: revision.policy, catalog, appBuildHash: appBuildHash() })).digest('hex');
}
export type Suite = { folder: string; revisionId?: number; expectedPolicy: Policy; tests: string[]; approvedAt?: string; sourceHash?: string; approvedDigest?: string };
export function suiteMatchesCandidate(revision: Revision, suite: Suite) {
  return (suite.revisionId === undefined || suite.revisionId === revision.id) && Object.entries(suite.expectedPolicy).every(([field, value]) => revision.policy[field as keyof Policy] === value);
}
export function suiteDigest(suite: Suite) {
  const hash = createHash('sha256');
  const { approvedDigest: _ignored, ...contents } = suite;
  hash.update(JSON.stringify(contents));
  const folder = path.resolve(suite.folder);
  if (!Array.isArray(suite.tests) || suite.tests.length < 6 || new Set(suite.tests).size !== suite.tests.length) throw new Error('A suite requires at least six distinct reviewed tests');
  for (const test of suite.tests) {
    if (!/^\.testmuai\/tests\/[\w.-]+_test\.md$/.test(test)) throw new Error('Invalid test path');
    const content = readFileSync(path.join(folder, test), 'utf8');
    if (!/^---[\s\S]*?assurance:\s*\n[\s\S]*?id:\s*t-[\w-]+/m.test(content)) throw new Error('Tests must come from Kane assurance');
    hash.update(test); hash.update(content);
  }
  const source = readFileSync(path.join(folder, 'campaign.md'));
  if (createHash('sha256').update(source).digest('hex') !== suite.sourceHash) throw new Error('Campaign requirements changed after review');
  // Variable changes can redirect browser tests; bind them to the review as well.
  for (const file of sourceFiles(path.join(folder, '.testmuai/variables')).sort()) { hash.update(path.relative(folder, file)); hash.update(readFileSync(file)); }
  return hash.digest('hex');
}
export function readSuite(revision = candidate(readState())): { suite: Suite; hash: string } | null {
  if (!revision) return null;
  const folder = revisionFolder(revision);
  const file = path.join(folder, 'suite.json');
  if (!existsSync(file)) return null;
  const suite = JSON.parse(readFileSync(file, 'utf8')) as Suite;
  policySchema.parse(suite.expectedPolicy);
  if (suite.revisionId !== revision.id || path.resolve(suite.folder) !== folder || !suite.approvedAt || !suite.approvedDigest || !suiteMatchesCandidate(revision, suite)) throw new Error('Suite is not reviewed for this revision');
  const hash = suiteDigest(suite);
  if (hash !== suite.approvedDigest) throw new Error('Tests or variables changed after review');
  return { suite, hash };
}
export function canActivate(state: AppState) {
  const revision = candidate(state);
  const verification = state.verification;
  if (!revision) return { ok: false, reason: 'Confirm a campaign first' };
  let suite: ReturnType<typeof readSuite>;
  try { suite = readSuite(revision); } catch { return { ok: false, reason: 'Kane test suite is invalid or missing files' }; }
  if (!suite) return { ok: false, reason: 'No reviewed Kane test suite is configured' };
  if (!suiteMatchesCandidate(revision, suite.suite)) return { ok: false, reason: 'No reviewed Kane suite matches this candidate policy' };
  if (!runtimeCurrent()) return { ok: false, reason: 'An application update is being applied. Verification will be available when the service is ready.' };
  if (!verification || verification.status !== 'passed') return { ok: false, reason: 'This candidate needs a passing Kane run' };
  if (verification.revisionId !== revision.id || verification.fingerprint !== fingerprint(revision) || verification.manifestHash !== suite.hash) return { ok: false, reason: 'Campaign, app, or test suite changed since verification' };
  if (!verification.executionId || !verification.evidencePack || !existsSync(verification.evidencePack) || verification.evidenceLogs.length !== suite.suite.tests.length || verification.evidenceLogs.some(log => !existsSync(log))) return { ok: false, reason: 'Kane evidence is incomplete' };
  if (!verification.evidenceHash || fileDigest(verification.evidencePack!) !== verification.evidenceHash) return { ok: false, reason: 'The verification report changed. Run verification again.' };
  return { ok: true, reason: 'Current Kane evidence permits activation' };
}
