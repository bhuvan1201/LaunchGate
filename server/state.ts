import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { catalog, policySchema, type Policy } from '../shared/promotion.js';

export type Revision = { id: number; sourceText: string; policy: Policy; confirmedAt: string };
export type Verification = { revisionId: number; fingerprint: string; manifestHash: string; status: 'running' | 'passed' | 'failed'; startedAt: string; completedAt?: string; executionId?: string; evidencePack?: string; evidenceLogs: string[]; checks?: { name: string; status: string; failure?: string }[]; summary?: string };
export type AppState = { revisions: Revision[]; activeRevisionId: number | null; verification: Verification | null };
const stateFile = path.resolve('data/state.json');
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
export function fingerprint(revision: Revision) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ sourceText: revision.sourceText, policy: revision.policy, catalog }));
  const files = ['package.json', 'docs/PRD.md', 'index.html', 'vite.config.ts', ...['src', 'server', 'shared', 'requirements'].flatMap(sourceFiles)].sort();
  for (const file of files) { hash.update(file); hash.update(readFileSync(file)); }
  return hash.digest('hex');
}
export type Suite = { folder: 'requirements'; expectedPolicy: Policy; tests: string[] };
export function suiteMatchesCandidate(revision: Revision, suite: Suite) {
  return Object.entries(suite.expectedPolicy).every(([field, value]) => revision.policy[field as keyof Policy] === value);
}
export function readSuite(): { suite: Suite; hash: string } | null {
  const file = path.resolve('verification-suite.json');
  if (!existsSync(file)) return null;
  const content = readFileSync(file, 'utf8');
  const parsed = JSON.parse(content) as Suite;
  const expectedPolicy = policySchema.parse(parsed.expectedPolicy);
  if (parsed.folder !== 'requirements' || !Array.isArray(parsed.tests) || parsed.tests.length < 6 || new Set(parsed.tests).size !== parsed.tests.length || parsed.tests.some(test => typeof test !== 'string' || !/^\.testmuai\/tests\/[\w.-]+_test\.md$/.test(test) || !existsSync(path.resolve(parsed.folder, test)) || !/^---[\s\S]*?assurance:\s*\n[\s\S]*?id:\s*t-[\w-]+/m.test(readFileSync(path.resolve(parsed.folder, test), 'utf8')))) throw new Error('Verification suite needs six distinct Kane assurance-generated tests from requirements/');
  const hash = createHash('sha256');
  hash.update(content);
  for (const test of parsed.tests) { hash.update(test); hash.update(readFileSync(path.resolve(parsed.folder, test))); }
  return { suite: { ...parsed, expectedPolicy }, hash: hash.digest('hex') };
}
export function canActivate(state: AppState) {
  const revision = candidate(state);
  const verification = state.verification;
  if (!revision) return { ok: false, reason: 'Confirm a campaign first' };
  let suite: ReturnType<typeof readSuite>;
  try { suite = readSuite(); } catch { return { ok: false, reason: 'Kane test suite is invalid or missing files' }; }
  if (!suite) return { ok: false, reason: 'No reviewed Kane test suite is configured' };
  if (!suiteMatchesCandidate(revision, suite.suite)) return { ok: false, reason: 'No reviewed Kane suite matches this candidate policy' };
  if (!verification || verification.status !== 'passed') return { ok: false, reason: 'This candidate needs a passing Kane run' };
  if (verification.revisionId !== revision.id || verification.fingerprint !== fingerprint(revision) || verification.manifestHash !== suite.hash) return { ok: false, reason: 'Campaign, app, or test suite changed since verification' };
  if (!verification.executionId || !verification.evidencePack || !existsSync(verification.evidencePack) || verification.evidenceLogs.length !== suite.suite.tests.length || verification.evidenceLogs.some(log => !existsSync(log))) return { ok: false, reason: 'Kane evidence is incomplete' };
  return { ok: true, reason: 'Current Kane evidence permits activation' };
}
