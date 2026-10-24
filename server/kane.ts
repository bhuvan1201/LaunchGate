import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { candidate, fingerprint, readState, readSuite, suiteMatchesCandidate, writeState } from './state.js';

let running = false;
export function isRunning() { return running; }
export function launchVerification() {
  if (running) throw new Error('A Kane verification is already running');
  const state = readState();
  const revision = candidate(state);
  if (!revision) throw new Error('Confirm a candidate first');
  const suite = readSuite();
  if (!suite) throw new Error('Review Kane-generated tests and configure verification-suite.json first');
  if (!suiteMatchesCandidate(revision, suite.suite)) throw new Error('The reviewed Kane suite targets a different candidate policy');
  const originalFingerprint = fingerprint(revision);
  state.verification = { revisionId: revision.id, fingerprint: originalFingerprint, manifestHash: suite.hash, status: 'running', startedAt: new Date().toISOString(), evidenceLogs: [] };
  writeState(state);
  running = true;
  const child = spawn('kane-cli', ['testrun', 'run', ...suite.suite.tests, '--agent'], { cwd: path.resolve(suite.suite.folder), env: { ...process.env, KANE_CLI_USER_AGENT: 'codex' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 25 * 60 * 1000);
  let buffer = '';
  let stderr = '';
  let plan: any = null;
  let summary: any = null;
  let done: any = null;
  const members: any[] = [];
  const consume = (line: string) => {
    try {
      const event = JSON.parse(line);
      if (event.type === 'testrun_plan') plan = event;
      if (event.type === 'testrun_summary') summary = event;
      if (event.type === 'testrun_done') done = event;
      if (event.type === 'testrun_member_end' || event.type === 'testrun_authored_member_end') members.push(event);
    } catch { /* retain full failure in stderr/summary rather than treating prose as evidence */ }
  };
  child.stdout.on('data', chunk => { buffer += chunk.toString(); const lines = buffer.split('\n'); buffer = lines.pop() ?? ''; lines.forEach(consume); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const finish = (exitCode: number | null, error?: Error) => {
    clearTimeout(timeout);
    if (buffer.trim()) consume(buffer);
    running = false;
    const latest = readState();
    const current = candidate(latest);
    if (!latest.verification || latest.verification.revisionId !== revision.id) return;
    const expected = new Set(suite.suite.tests.map(test => path.basename(test)));
    const actual = new Set(members.map(member => path.basename(member.path ?? '')));
    const logs = members.map(member => member.log_path).filter((log): log is string => typeof log === 'string' && existsSync(log));
    const evidencePack = summary?.execution?.id ? path.resolve(suite.suite.folder, '.testmuai/evidence', `${summary.execution.id}.evidence`) : undefined;
    let currentSuite: ReturnType<typeof readSuite> = null;
    try { currentSuite = readSuite(); } catch { /* changing or deleting tests makes the run stale */ }
    const allPassed = !timedOut && exitCode === 0 && plan?.valid === true && plan.members?.length === expected.size && done?.overall_status === 'passed' && summary?.totals?.tests === expected.size && summary?.totals?.passed === expected.size && members.length === expected.size && [...expected].every(name => actual.has(name)) && members.every(member => member.status === 'passed') && logs.length === expected.size && Boolean(evidencePack && existsSync(evidencePack)) && Boolean(current) && fingerprint(current!) === originalFingerprint && currentSuite?.hash === suite.hash;
    latest.verification = { ...latest.verification, status: allPassed ? 'passed' : 'failed', completedAt: new Date().toISOString(), executionId: summary?.execution?.id, evidencePack, evidenceLogs: logs, checks: members.map(member => ({ name: path.basename(member.path ?? ''), status: member.status ?? 'unknown', failure: member.failure?.message })), summary: allPassed ? `${expected.size} of ${expected.size} Kane checks passed` : (timedOut ? 'Kane verification timed out' : error?.message || members.find(member => member.failure)?.failure?.message || stderr.slice(-500) || 'Kane run did not produce complete passing evidence') };
    writeState(latest);
  };
  child.once('error', error => finish(null, error));
  child.once('close', code => { if (running) finish(code); });
}
