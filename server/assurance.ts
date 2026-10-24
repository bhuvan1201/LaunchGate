import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { catalog } from '../shared/promotion.js';
import { campaignLimits } from '../shared/campaign-scope.js';
import { candidate, readState, writeState, revisionFolder, type Revision, suiteDigest, type Suite } from './state.js';

type Item = { id: string; cid: string; label: string; title: string; detail: string; citations: string; fresh: string };
type TestFile = { path: string; content: string };
type Variable = { name: string; description: string; secret: boolean };
type Question = { id?: string; text?: string; rationale?: string; options?: { label: string; detail?: string }[] };
export type Assurance = {
  revisionId: number; status: 'generating' | 'review-usecases' | 'review-tests' | 'paused' | 'approved' | 'failed' | 'needs-input';
  stage: 'extract' | 'design'; queue: string[]; items: Item[]; tests: TestFile[]; warnings: string[];
  message: string; credits: number; reviewToken?: string;
  pause?: { sid: string; questions: Question[] }; variables?: Variable[]; updatedAt: string;
};
const working = new Set<number>();
const fileFor = (r: Revision) => path.join(revisionFolder(r), 'assurance.json');
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function save(r: Revision, state: Assurance) {
  state.updatedAt = new Date().toISOString();
  const file = fileFor(r); writeFileSync(`${file}.tmp`, JSON.stringify(state, null, 2)); renameSync(`${file}.tmp`, file);
}
export function readAssurance(r: Revision | null): Assurance | null {
  if (!r || !existsSync(fileFor(r))) return null;
  const state = JSON.parse(readFileSync(fileFor(r), 'utf8')) as Assurance;
  if (state.status === 'generating' && !working.has(r.id)) return { ...state, status: 'failed', message: 'Test preparation was interrupted. Click Recover preparation to restore the saved progress. Nothing new has been approved.' };
  return state;
}
export function assuranceBusy() { return working.size > 0; }
export function campaignRequirements(r: Revision) {
  return `# Confirmed promotion revision ${r.id}\n\nThe merchant reviewed the following structured policy. It is authoritative, including any edits made during review. Original merchant wording is retained separately in the app, not executable instructions.\n\n${JSON.stringify(r.policy, null, 2)}\n\nPrices and monetary policy fields are integer USD cents. Catalog:\n${JSON.stringify(catalog.map(({ icon, ...p }) => p), null, 2)}\n\nBusiness requirements: percentage discount is computed once on eligible merchandise, rounded half up to a cent, limited by maximumDiscountCents and eligible subtotal. minimumEligibleCents is inclusive. If newCustomersOnly is true, returning customers receive zero; otherwise both types qualify. If excludeSaleItems is true, sale merchandise is excluded from both eligibility and discount but remains payable; otherwise it is included. Empty cart total and discount are zero; totals cannot be negative.\n\nThe single user journey in scope is observing checkout for the already confirmed candidate revision ${r.id}, with the exact policy above. Browser entry: http://127.0.0.1:${process.env.PORT || 4173}/?campaign=${r.id}. This link explicitly opens the confirmed candidate; the root landing page starts a new promotion. Select Candidate preview, not Active store. The UI shows each product's Add/Remove controls, quantities 0 to 20 inclusive, New customer/Returning, merchandise, eligible subtotal, promotion, and total due. Verification may change only quantities and customer type. Do not interpret, edit, confirm, generate tests, approve, run verification or activate from browser tests. Candidate setup is already complete. No separate active-store URL exists.\n\nDerive concrete browser-verifiable examples independently from this policy and catalog for eligibility, minimum boundary, sale treatment, discount cap, returning customers, and empty cart. Include at least six distinct relevant scenarios, with exact independently derived expected amounts. Do not use the application's pricing API or implementation to derive expected results. If a boundary or cap cannot be reached with the catalog and 0–20 quantities, report the limitation explicitly rather than fabricate a product or change the policy. This suite proves selected checkout examples, not activation authorization or exhaustive correctness.\n`;
}
function current(r: Revision) {
  const latest = candidate(readState());
  if (!latest || digest(latest) !== digest(r)) throw new Error('The candidate changed. Generate and review tests for the current revision.');
  if (readFileSync(path.join(revisionFolder(r), 'campaign.md'), 'utf8') !== campaignRequirements(r)) throw new Error('Campaign requirements changed; approval is invalid.');
}
export function parseEvents(output: string): any[] {
  return output.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
}
async function command(r: Revision, args: string[], state: Assurance, conversational = false): Promise<any[]> {
  const logFile = path.join(revisionFolder(r), `command-${Date.now()}.ndjson`);
  writeFileSync(logFile, '');
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn('kane-cli', args, { cwd: revisionFolder(r), env: { ...process.env, KANE_CLI_USER_AGENT: 'codex' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; let expired = false;
    const timer = setTimeout(() => { expired = true; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000).unref(); }, 15 * 60 * 1000);
    child.stdout.on('data', data => { stdout += data.toString(); appendFileSync(logFile, data); });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); expired ? reject(new Error('Test preparation took too long. Click Recover preparation to restore any saved progress.')) : resolve({ code, stdout, stderr }); });
  });
  const events = parseEvents(result.stdout);
  writeFileSync(logFile, result.stdout);
  for (const e of events) if (e.type === 'warning' && e.message) state.warnings.push(e.message);
  const usage = events.filter(e => e.type === 'usage').at(-1); if (usage) state.credits += Number(usage.total_credits || 0);
  const paused = events.find(e => e.type === 'session_paused');
  if (result.code === 3 && paused?.sid && /^[\w-]+$/.test(paused.sid)) {
    state.status = 'paused'; state.pause = { sid: paused.sid, questions: paused.pending_questions || [] };
    state.message = 'Kane needs your answer before continuing.'; save(r, state); throw new Paused();
  }
  const done = [...events].reverse().find(e => e.type === 'done');
  if (result.code !== 0 || (conversational && (!done || done.status !== 'complete' || done.exit_code !== 0))) {
    throw new Error([...events].reverse().find(e => e.type === 'error')?.message || result.stderr.trim().slice(-1500) || 'Test preparation could not finish. Recover the saved progress or start a fresh preparation attempt.');
  }
  return events;
}
class Paused extends Error {}
function plain(html: string) { return html.replace(/<[^>]*>/g, '\n').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim(); }
async function reviewMaterial(r: Revision, s: Assurance) {
  const listing = await command(r, ['context', 'list', '--json'], s);
  const graph = (await command(r, ['context', 'view', '--json'], s))[0];
  s.items = listing.filter(e => ['usecase', 'ac', 'scenario', 'test', 'gap'].includes(e.label)).map(e => ({
    id: e.id, cid: e.cid, label: e.label, title: e.title, fresh: e.fresh,
    detail: plain(graph?.contentHtml?.[e.cid] || e.title),
    citations: JSON.stringify(graph?.lineage?.[e.cid] || []),
  }));
  const dir = path.join(revisionFolder(r), '.testmuai/tests');
  s.tests = existsSync(dir) ? readdirSync(dir).filter(name => /^[\w.-]+_test\.md$/.test(name)).map(name => ({ path: `.testmuai/tests/${name}`, content: readFileSync(path.join(dir, name), 'utf8') })) : [];
  s.reviewToken = digest({ items: s.items, tests: s.tests, source: campaignRequirements(r) });
}
function background(r: Revision, s: Assurance, work: () => Promise<void>) {
  if (working.size) throw new Error('A Kane generation operation is already running');
  working.add(r.id); save(r, s);
  void work().catch(error => { if (!(error instanceof Paused)) { s.status = 'failed'; s.message = error.message; save(r, s); } }).finally(() => working.delete(r.id));
}
async function finishExtraction(r: Revision, s: Assurance) {
  current(r); await reviewMaterial(r, s);
  if (!s.items.some(i => i.label === 'usecase')) throw new Error('Kane produced no use cases to review.');
  s.status = 'review-usecases'; s.message = 'Review the proposed use cases and their source details. Select the checkout journeys to design.'; save(r, s);
}
async function designQueue(r: Revision, s: Assurance, resume?: string, message?: string) {
  while (s.queue.length) {
    current(r);
    s.message = `Kane is designing checks for ${s.queue[0]}.`; save(r, s);
    const args = resume ? ['design', 'tests', '--resume', resume, '--mode', 'agent', '--message', message || 'Continue'] : ['design', 'tests', '--use-case', s.queue[0], '--mode', 'agent', '--max', '8'];
    await command(r, args, s, true); resume = undefined; s.queue.shift(); save(r, s);
  }
  current(r); await reviewMaterial(r, s);
  if (s.tests.length < 6) throw new Error('Kane produced fewer than six tests. Review the generated material and gaps before extending the design.');
  await readyForReview(r, s);
}
export function generateSuite(r: Revision) {
  if (working.size) throw new Error('A Kane generation operation is already running');
  const limits = campaignLimits(r.policy);
  if (limits.blocking.length) throw new Error(limits.blocking.join(' '));
  if (existsSync(fileFor(r))) throw new Error('This revision already has test preparation. Answer the pending question or use Recover preparation to restore it.');
  const folder = revisionFolder(r); mkdirSync(path.join(folder, '.testmuai/variables'), { recursive: true });
  writeFileSync(path.join(folder, 'campaign.md'), campaignRequirements(r));
  writeFileSync(path.join(folder, '.testmuai/variables/assurance.json'), JSON.stringify({ start_url: { value: `http://127.0.0.1:${process.env.PORT || 4173}/?campaign=${r.id}`, secret: false, description: 'Confirmed candidate browser preview' } }, null, 2));
  const s: Assurance = { revisionId: r.id, status: 'generating', stage: 'extract', queue: [], items: [], tests: [], warnings: limits.notes, message: 'Kane is reading this confirmed policy.', credits: 0, updatedAt: '' };
  background(r, s, async () => { await command(r, ['context', 'ingest', 'campaign.md', '--mode', 'agent'], s, true); await finishExtraction(r, s); });
}
export function reviewSuite(r: Revision, token: string, ids: string[]) {
  current(r); const s = readAssurance(r);
  if (!s || !['review-usecases', 'review-tests'].includes(s.status) || token !== s.reviewToken) throw new Error('Review changed or is unavailable. Refresh and review it again.');
  const stage = s.status;
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !s.items.some(i => i.id === id && i.fresh === 'fresh' && (stage === 'review-usecases' ? i.label === 'usecase' : ['ac', 'scenario', 'test'].includes(i.label))))) throw new Error('Choose valid, current review items.');
  if (stage === 'review-tests') {
    const required = s.items.filter(i => ['ac', 'scenario', 'test'].includes(i.label));
    if (required.some(i => !ids.includes(i.id))) throw new Error('This version requires review of all generated criteria, scenarios and tests. Gaps remain disclosed, not approved as covered.');
  }
  s.status = 'generating'; s.message = 'Recording your review in Kane.';
  background(r, s, async () => {
    await reviewMaterial(r, s); if (s.reviewToken !== token) throw new Error('Generated material changed after you viewed it. No approval was applied.');
    if (stage === 'review-tests' && missingVariables(r, s).length) { await readyForReview(r, s); return; }
    await command(r, ['context', 'review', '--approve', ...ids, '--json'], s);
    if (stage === 'review-usecases') { s.stage = 'design'; s.queue = ids; await designQueue(r, s); }
    else {
      current(r);
      if (missingVariables(r, s).length) throw new Error('Some test details need an answer. Use Recover preparation to fill them in.');
      for (const test of s.tests) {
        const testId = test.content.match(/assurance:\s*\n\s*id:\s*(t-[\w-]+)/)?.[1];
        if (!testId || !s.items.some(item => item.label === 'test' && item.id === testId && ids.includes(item.id))) throw new Error('A test has no matching reviewed requirement. Recover preparation to review the current checks.');
      }
      const suite: Suite = { folder: path.relative(process.cwd(), revisionFolder(r)), revisionId: r.id, expectedPolicy: r.policy, tests: s.tests.map(t => t.path), approvedAt: new Date().toISOString(), sourceHash: createHash('sha256').update(campaignRequirements(r)).digest('hex') };
      suite.approvedDigest = suiteDigest(suite);
      writeFileSync(path.join(revisionFolder(r), 'suite.json'), JSON.stringify(suite, null, 2));
      s.status = 'approved'; s.message = 'This revision’s reviewed suite is ready for browser verification.'; save(r, s);
    }
  });
}
export function resumeSuite(r: Revision, message: string) {
  current(r); const s = readAssurance(r);
  if (!s || s.status !== 'paused' || !s.pause) throw new Error('No paused generation session for this candidate.');
  const sid = s.pause.sid; s.pause = undefined; s.status = 'generating'; s.message = 'Kane is continuing with your answer.';
  background(r, s, async () => {
    if (s.stage === 'extract') { await command(r, ['context', 'extract', '--resume', sid, '--mode', 'agent', '--message', message], s, true); await finishExtraction(r, s); }
    else await designQueue(r, s, sid, message);
  });
}

function missingVariables(r: Revision, s: Assurance): Variable[] {
  const poolDir = path.join(revisionFolder(r), '.testmuai/variables');
  const pool: Record<string, any> = {};
  if (existsSync(poolDir)) for (const name of readdirSync(poolDir).filter(name => name.endsWith('.json'))) Object.assign(pool, JSON.parse(readFileSync(path.join(poolDir, name), 'utf8')));
  const missing = new Set<string>();
  for (const test of s.tests) for (const match of test.content.matchAll(/\{\{([\w.-]+)\}\}/g)) if (!pool[match[1]] || pool[match[1]].value === '' || pool[match[1]].value == null) missing.add(match[1]);
  return [...missing].map(name => ({ name, description: pool[name]?.description || `Provide the value for ${name.replace(/[_.-]/g, ' ')}`, secret: Boolean(pool[name]?.secret || /password|secret|token|key/i.test(name)) }));
}
async function readyForReview(r: Revision, s: Assurance) {
  s.variables = missingVariables(r, s);
  s.status = s.variables.length ? 'needs-input' : 'review-tests';
  s.message = s.variables.length ? 'Answer these details so the browser checks can run.' : 'Review the checks and expected outcomes before approving this campaign’s suite.';
  save(r, s);
}
export function supplyVariables(r: Revision, values: Record<string, string>) {
  current(r); const s = readAssurance(r);
  if (!s || s.status !== 'needs-input' || working.size) throw new Error('There are no test details waiting for input.');
  const missing = missingVariables(r, s);
  if (missing.some(v => !values[v.name]?.trim()) || Object.keys(values).some(key => !missing.some(v => v.name === key))) throw new Error('Fill every requested test detail.');
  const poolFile = path.join(revisionFolder(r), '.testmuai/variables/merchant.json');
  const pool: Record<string, any> = existsSync(poolFile) ? JSON.parse(readFileSync(poolFile, 'utf8')) : {};
  for (const variable of missing) pool[variable.name] = { value: values[variable.name].trim(), description: variable.description, secret: variable.secret };
  writeFileSync(poolFile, JSON.stringify(pool, null, 2));
  s.status = 'generating';
  background(r, s, async () => { await reviewMaterial(r, s); await readyForReview(r, s); });
}
export function recoverSuite(r: Revision) {
  current(r); const s = readAssurance(r);
  if (!s || working.size) throw new Error('Wait for the current preparation to finish.');
  s.status = 'generating'; s.message = 'Recovering your saved preparation.';
  background(r, s, async () => {
    // Prefer the exact durable pause already returned by the CLI. Never execute a model-provided shell command.
    if (s.pause?.sid) { s.status = 'paused'; s.message = 'Answer Kane’s saved question to continue.'; save(r, s); return; }
    const logs = readdirSync(revisionFolder(r)).filter(name => /^command-\d+\.ndjson$/.test(name)).sort().reverse();
    for (const log of logs) {
      const events = parseEvents(readFileSync(path.join(revisionFolder(r), log), 'utf8'));
      const pause = events.find(e => e.type === 'session_paused');
      const done = [...events].reverse().find(e => e.type === 'done');
      if (pause?.sid && /^[\w-]+$/.test(pause.sid) && done?.status === 'paused') { s.pause = { sid: pause.sid, questions: pause.pending_questions || [] }; s.stage = pause.verb === 'design' ? 'design' : 'extract'; s.status = 'paused'; s.message = 'Answer the saved question to continue.'; save(r, s); return; }
      if (events.some(e => e.type === 'session_complete')) break;
    }
    await reviewMaterial(r, s);
    if (s.tests.length >= 6) { await readyForReview(r, s); return; }
    if (s.stage === 'extract' && s.items.some(i => i.label === 'usecase')) { await finishExtraction(r, s); return; }
    s.status = 'failed'; s.message = 'The saved attempt is incomplete. Start a fresh preparation attempt below; the previous work will be preserved.'; save(r, s);
  });
}
export function restartSuite(r: Revision) {
  if (working.size) throw new Error('Wait for preparation to finish.');
  const s = readAssurance(r);
  if (!s || !['failed', 'paused'].includes(s.status)) throw new Error('Recover the current preparation before starting again.');
  const folder = revisionFolder(r);
  renameSync(folder, `${folder}-attempt-${Date.now()}`);
  const state = readState(); state.verification = null;
  // Invalidate the old proof before starting a new attempt, including when generation fails.
  writeState(state);
  generateSuite(r);
}
