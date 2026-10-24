import React from 'react';
import { evidenceStatus, type RunReport } from '../shared/evidence-status';

function displayTime(value?: string) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
}

export function EvidencePanel({ revisionId, report, activation, suiteReady, testingPaused, busy, draftChanged, presentation, verify, activate }: {
  revisionId: number; report: RunReport | null; activation: { ok: boolean; reason: string };
  suiteReady: boolean; testingPaused: boolean; busy: boolean; draftChanged: boolean; presentation: boolean;
  verify: () => void; activate: () => void;
}) {
  const status = evidenceStatus(report, revisionId, activation.ok);
  const checks = report?.checks ?? [];
  const passed = checks.filter(check => check.status === 'passed').length;
  const running = report?.status === 'running';
  return <section className="panel evidence-panel" id="launch-gate" aria-label="Verification evidence">
    <div className="section-head"><div><div className="eyebrow">PROOF FOR THIS PROMOTION</div><h2>Checkout evidence</h2></div><span className={`evidence-badge evidence-${status.tone}`}>{status.label}</span></div>
    <p className="evidence-description">{status.detail}</p>
    <div className="evidence-facts"><div><span>Confirmed candidate</span><strong>Revision #{revisionId}</strong></div><div><span>Browser checks passed</span><strong>{checks.length ? `${passed} / ${checks.length}` : 'Not run'}</strong></div><div><span>{running ? 'Started' : 'Completed'}</span><strong>{displayTime(running ? report?.startedAt : report?.completedAt)}</strong></div></div>
    {report?.summary && <p role="status">{report.summary}</p>}
    {report?.executionId && <p className="help">Run {report.executionId} · report for revision #{report.revisionId}</p>}
    {draftChanged && <p className="evidence-warning">Your edited offer is not confirmed. This evidence belongs to the saved revision, not your draft.</p>}
    {checks.length > 0 && <details className="report-details" open={presentation || running}><summary>View {checks.length} browser checks</summary><div className="report-list">{checks.map((check, index) => <div className="report-check" key={`${index}-${check.name}`}><span className={check.status === 'passed' ? 'check-pass' : check.status === 'failed' ? 'check-fail' : 'check-pending'}>{check.status === 'passed' ? '✓' : check.status === 'failed' ? '!' : '○'}</span><span>{check.name.replace(/_test\.md$/, '').replace(/-/g, ' ')}{check.failure && <small>{check.failure}</small>}</span><b>{check.status}</b></div>)}</div></details>}
    {report?.evidencePack && <a href="/api/evidence" className="text-button">Download this run’s evidence pack ↗</a>}
    <p className="help">These checks cover selected checkout examples. They do not prove every policy or the entire application. Standalone CLI reports are viewed in Kane’s evidence viewer.</p>
    <div className="evidence-gate"><div><strong>{activation.ok && !draftChanged ? 'Ready for your launch decision' : 'Launch is locked'}</strong><p>{draftChanged ? 'Confirm or discard the draft before launching.' : activation.reason}</p></div><button className="button button-coral" onClick={activate} disabled={busy || !activation.ok || draftChanged}>Activate verified revision →</button></div>
    {!presentation && <div className="verification-controls"><button className="button button-outline" onClick={verify} disabled={busy || !suiteReady || testingPaused || draftChanged || running}>{running ? 'Live verification running…' : report ? 'Run full verification again' : 'Run full verification'}</button><span className="help">{testingPaused ? 'App-triggered Kane runs are paused. The operator can run tests separately in the CLI.' : !suiteReady ? 'Prepare and approve this revision’s checks below first.' : 'Starts a new browser run and uses Kane credits. Allow several minutes.'}</span></div>}
  </section>;
}
