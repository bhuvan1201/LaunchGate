import { execFile, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { candidate, fileDigest, fingerprint, readState, readSuite, runtimeCurrent, suiteMatchesCandidate, writeState } from './state.js';

let running = false;
export function isRunning() { return running; }
export function recoverInterruptedVerification() {
  const state = readState();
  if (state.verification?.status === 'running' && !running) {
    state.verification.status = 'failed';
    state.verification.summary = 'Verification was interrupted. Click Run Kane verification to try again.';
    writeState(state);
  }
}
export function launchVerification() {
  if (running) throw new Error('A Kane verification is already running');
  if (!runtimeCurrent()) throw new Error('The service is applying an update. Please try again shortly.');
  const state = readState();
  const revision = candidate(state);
  if (!revision) throw new Error('Confirm a candidate first');
  const suite = readSuite();
  if (!suite) throw new Error('Generate and approve Kane tests for this candidate first');
  if (!suiteMatchesCandidate(revision, suite.suite)) throw new Error('The reviewed Kane suite targets a different candidate policy');
  const originalFingerprint = fingerprint(revision);
  const names = new Map(suite.suite.tests.map(test => [path.basename(test), readFileSync(path.join(suite.suite.folder, test), 'utf8').match(/^# (.+)$/m)?.[1] || path.basename(test)]));
  state.verification = { revisionId: revision.id, fingerprint: originalFingerprint, manifestHash: suite.hash, status: 'running', startedAt: new Date().toISOString(), evidenceLogs: [], checks: [...names.values()].map(name => ({ name, status: 'queued' })), summary: `Starting ${names.size} browser checks.` };
  writeState(state);
  running = true;
  const child = spawn('kane-cli', ['testrun', 'run', ...suite.suite.tests, '--agent'], { cwd: path.resolve(suite.suite.folder), env: { ...process.env, KANE_CLI_USER_AGENT: 'codex' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let timedOut = false, finished = false;
  const timeout = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000).unref(); }, 25 * 60 * 1000);
  let buffer = '', stderr = '';
  let plan: any = null, summary: any = null, done: any = null;
  const members: any[] = [];
  const progress = () => {
    const latest = readState();
    if (!latest.verification || latest.verification.revisionId !== revision.id) return;
    latest.verification.checks = [...names].map(([file, name]) => {
      const member = members.find(member => path.basename(member.path ?? '') === file);
      return { name, status: member?.status || 'queued', failure: member?.failure?.message };
    });
    latest.verification.summary = `${members.length} of ${names.size} browser checks finished.`;
    writeState(latest);
  }
  const consume = (line: string) => {
    try {
      const event = JSON.parse(line);
      if (event.type === 'testrun_plan') plan = event;
      if (event.type === 'testrun_summary') summary = event;
      if (event.type === 'testrun_done') done = event;
      if (event.type === 'testrun_member_end' || event.type === 'testrun_authored_member_end') { members.push(event); progress(); }
    } catch { /* Non-JSON diagnostics never count as test evidence. */ }
  };
  child.stdout.on('data', chunk => { buffer += chunk.toString(); const lines = buffer.split('\n'); buffer = lines.pop() ?? ''; lines.forEach(consume); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const finish = async (exitCode: number | null, error?: Error) => {
    if (finished) return; finished = true; clearTimeout(timeout);
    try {
      if (buffer.trim()) consume(buffer);
      const expected = new Set(suite.suite.tests.map(test => path.basename(test)));
      const actual = new Set(members.map(member => path.basename(member.path ?? '')));
      const logs = members.map(member => member.log_path).filter((log): log is string => typeof log === 'string' && existsSync(log));
      const executionId = summary?.execution?.id;
      const evidencePack = typeof executionId === 'string' && /^[\w-]+$/.test(executionId) ? path.resolve(suite.suite.folder, '.testmuai/evidence', `${executionId}.evidence`) : undefined;
      let evidenceHash: string | undefined;
      if (evidencePack && existsSync(evidencePack)) {
        await promisify(execFile)('kane-cli', ['evidence', 'validate', evidencePack, '--json'], { cwd: suite.suite.folder, env: { ...process.env, KANE_CLI_USER_AGENT: 'codex' }, timeout: 30000 });
        evidenceHash = fileDigest(evidencePack);
      }
      const latest = readState(); const current = candidate(latest);
      if (!latest.verification || latest.verification.revisionId !== revision.id) return;
      let currentSuite: ReturnType<typeof readSuite> = null;
      try { currentSuite = readSuite(); } catch { /* A changed suite cannot authorize launch. */ }
      const allPassed = !timedOut && exitCode === 0 && plan?.valid === true && plan.members?.length === expected.size && done?.overall_status === 'passed' && summary?.totals?.tests === expected.size && summary?.totals?.passed === expected.size && members.length === expected.size && [...expected].every(name => actual.has(name)) && members.every(member => member.status === 'passed') && logs.length === expected.size && Boolean(evidenceHash) && Boolean(current) && fingerprint(current!) === originalFingerprint && currentSuite?.hash === suite.hash && runtimeCurrent();
      latest.verification = { ...latest.verification, status: allPassed ? 'passed' : 'failed', completedAt: new Date().toISOString(), executionId, evidencePack, evidenceHash, evidenceLogs: logs, checks: [...names].map(([file, name]) => { const member = members.find(m => path.basename(m.path ?? '') === file); return { name, status: member?.status || 'not-run', failure: member?.failure?.message }; }), summary: allPassed ? `${expected.size} of ${expected.size} Kane checks passed` : (timedOut ? 'Verification timed out. You can retry from this page.' : error?.message || members.find(member => member.failure)?.failure?.message || stderr.slice(-500) || 'The run did not produce complete, current passing evidence. Review the results and retry.') };
      writeState(latest);
    } catch (failure) {
      const latest = readState();
      if (latest.verification?.revisionId === revision.id) { latest.verification.status = 'failed'; latest.verification.summary = `The report could not be validated. Retry verification. ${failure instanceof Error ? failure.message : ''}`; writeState(latest); }
    } finally { running = false; }
  };
  child.once('error', error => { void finish(null, error); });
  child.once('close', code => { void finish(code); });
}
