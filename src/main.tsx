import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { catalog, money, type Policy } from '../shared/promotion';
import './style.css';

type Revision = { id: number; sourceText: string; policy: Policy; confirmedAt: string };
type Snapshot = { candidate: Revision | null; active: Revision | null; verification: { status: string; summary?: string; revisionId: number; executionId?: string; evidencePack?: string; evidenceLogs: string[]; checks?: { name: string; status: string; failure?: string }[]; completedAt?: string } | null; activation: { ok: boolean; reason: string }; suiteReady: boolean; running: boolean; openaiReady: boolean };
type Quote = { subtotalCents: number; eligibleSubtotalCents: number; discountCents: number; totalCents: number; reason: string };
const startingPolicy: Policy = { title: 'Welcome offer', percentOff: 20, minimumEligibleCents: 4200, maximumDiscountCents: 1000, newCustomersOnly: true, excludeSaleItems: true };
const sample = 'Give new customers 20% off when eligible merchandise reaches $42, cap the discount at $10, and exclude sale items.';

async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result as T;
}

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [text, setText] = useState(sample);
  const [policy, setPolicy] = useState<Policy>(startingPolicy);
  const [parsed, setParsed] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'candidate' | 'active'>('candidate');
  const [quantities, setQuantities] = useState<Record<string, number>>({ tote: 0, mug: 0, hoodie: 0, cap: 0 });
  const [customerType, setCustomerType] = useState<'new' | 'returning'>('new');
  const [checkout, setCheckout] = useState<Quote | null>(null);

  const refresh = async () => setSnapshot(await api<Snapshot>('/api/state'));
  useEffect(() => { api<Snapshot>('/api/state').then(state => { setSnapshot(state); if (state.candidate) { setText(state.candidate.sourceText); setPolicy(state.candidate.policy); } }).catch(e => setError(e.message)); }, []);
  useEffect(() => { if (!snapshot?.running) return; const timer = setInterval(() => refresh().catch(e => setError(e.message)), 2000); return () => clearInterval(timer); }, [snapshot?.running]);
  useEffect(() => {
    api<{ quote: Quote }>('/api/quote', { cart: { quantities, customerType }, mode }).then(({ quote }) => setCheckout(quote)).catch(e => setError(e.message));
  }, [snapshot?.candidate?.id, snapshot?.active?.id, quantities, customerType, mode]);
  const act = async (name: string, action: () => Promise<void>) => { setBusy(name); setError(''); setNotice(''); try { await action(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(''); } };
  const setField = <K extends keyof Policy>(name: K, value: Policy[K]) => { setPolicy(current => ({ ...current, [name]: value })); setParsed(true); };
  const parse = () => act('parse', async () => {
    const result = await api<{ proposal: Policy | null; clarification: string; unsupported: boolean }>('/api/parse', { text });
    if (!result.proposal) throw new Error(result.clarification);
    setPolicy(result.proposal); setParsed(true); setNotice('OpenAI interpreted the request. Review each field before confirming.');
  });
  const confirm = () => act('confirm', async () => {
    await api('/api/confirm', { sourceText: text, policy });
    setNotice('Candidate revision saved. Verification is required before activation.');
  });
  const verify = () => act('verify', async () => { await api('/api/verify', {}); setNotice('Kane is testing the candidate in a real browser.'); });
  const activate = () => act('activate', async () => { await api('/api/activate', {}); setMode('active'); setNotice('Verified campaign activated. The live storefront now uses this revision.'); });
  const hasDraftChanges = Boolean(snapshot?.candidate && (text !== snapshot.candidate.sourceText || JSON.stringify(policy) !== JSON.stringify(snapshot.candidate.policy)));
  const status = snapshot?.verification?.status || (snapshot?.candidate ? 'Awaiting verification' : 'No candidate');

  return <div className="shell">
    <header className="topbar"><div className="brand"><span className="brandmark">✦</span><span>launchgate</span><small> / control room</small></div><div className="top-right"><span className="live-dot" /> LOCAL DEMO <span className="divider">|</span> BUILT WITH OPENAI + KANE CLI</div></header>
    <main>
      <section className="hero"><div><div className="eyebrow">CAMPAIGN ASSURANCE / 001</div><h1>Make the promise.<br /><em>Prove the checkout.</em></h1><p>Turn a promotion into a policy, test the actual customer journey, and launch only when the evidence matches.</p></div><div className="hero-meter"><div className="meter-label">LAUNCH READINESS</div><div className="meter-number">{snapshot?.activation.ok ? '03' : snapshot?.candidate ? '02' : '01'}<span>/03</span></div><div className="meter-track"><span style={{ width: snapshot?.activation.ok ? '100%' : snapshot?.candidate ? '66%' : '33%' }} /></div><small>{snapshot?.activation.reason || 'Loading campaign state'}</small></div></section>
      {(error || notice) && <div className={`banner ${error ? 'banner-error' : ''}`} role="status"><span>{error ? '!' : '✓'}</span>{error || notice}<button onClick={() => { setError(''); setNotice(''); }} aria-label="Dismiss message">×</button></div>}
      <div className="workspace">
        <section className="panel editor"><div className="section-head"><span className="step">01</span><div><div className="eyebrow">DEFINE THE RULE</div><h2>Campaign studio</h2></div><span className="head-tag">OPENAI IN THE LOOP</span></div>
          <label className="field-label" htmlFor="brief">Your promotion, in plain English</label><textarea id="brief" value={text} onChange={e => { setText(e.target.value); setParsed(false); }} rows={4} placeholder="Describe the discount, minimum, cap and eligibility..." />
          <div className="action-row"><button className="button button-dark" onClick={parse} disabled={Boolean(busy)}>{busy === 'parse' ? 'Interpreting…' : '✧ Interpret with OpenAI'}</button><span className="help">{snapshot?.openaiReady ? 'API connected' : 'Add OPENAI_API_KEY to .env for AI parsing'}</span></div>
          <div className="rule-head"><span>POLICY REVIEW</span><span>{parsed ? 'EDITABLE DRAFT' : 'MANUAL STARTER VALUES'}</span></div>
          <div className="fields"><label className="wide">Campaign name<input aria-label="Campaign name" value={policy.title} onChange={e => setField('title', e.target.value)} /></label><label>Discount percentage<input aria-label="Discount percentage" type="number" min="1" max="100" value={policy.percentOff} onChange={e => setField('percentOff', Number(e.target.value))} /><b>%</b></label><label>Minimum eligible subtotal<input aria-label="Minimum eligible subtotal" type="number" min="0" step="0.01" value={(policy.minimumEligibleCents / 100).toFixed(2)} onChange={e => setField('minimumEligibleCents', Math.round(Number(e.target.value) * 100))} /><b>$</b></label><label>Maximum discount<input aria-label="Maximum discount" type="number" min="0.01" step="0.01" value={(policy.maximumDiscountCents / 100).toFixed(2)} onChange={e => setField('maximumDiscountCents', Math.round(Number(e.target.value) * 100))} /><b>$</b></label></div>
          <label className="toggle"><input type="checkbox" checked={policy.newCustomersOnly} onChange={e => setField('newCustomersOnly', e.target.checked)} /><span>New customers only</span><small>Returning customers get no discount</small></label><label className="toggle"><input type="checkbox" checked={policy.excludeSaleItems} onChange={e => setField('excludeSaleItems', e.target.checked)} /><span>Exclude sale items</span><small>Sale items do not count toward the minimum</small></label>
          <div className="panel-foot"><button className="button button-coral" onClick={confirm} disabled={Boolean(busy)}>{busy === 'confirm' ? 'Saving…' : snapshot?.candidate ? 'Confirm new revision →' : 'Confirm candidate →'}</button><span>Explicit confirmation required</span></div>
        </section>
        <section className="panel shop"><div className="section-head"><span className="step">02</span><div><div className="eyebrow">SEE WHAT SHOPPERS SEE</div><h2>Storefront lab</h2></div><span className="head-tag">REAL PRICING</span></div>
          <div className="segmented"><button className={mode === 'candidate' ? 'selected' : ''} onClick={() => setMode('candidate')}>Candidate preview {snapshot?.candidate ? `#${snapshot.candidate.id}` : ''}</button><button className={mode === 'active' ? 'selected' : ''} onClick={() => setMode('active')}>Active store {snapshot?.active ? `#${snapshot.active.id}` : ''}</button></div>
          <div className="store-note">{mode === 'candidate' ? snapshot?.candidate ? `${snapshot.candidate.policy.title} · confirmed revision ${snapshot.candidate.id}${hasDraftChanges ? ' · unsaved edits are not previewed' : ''}` : 'Confirm a candidate to preview its policy.' : snapshot?.active ? `${snapshot.active.policy.title} is live in this demo store.` : 'No campaign has been activated yet.'}</div>
          <div className="products">{catalog.map(item => <div className="product" key={item.id}><div className={`product-art art-${item.id}`}>{item.icon}</div><div className="product-copy"><strong>{item.name}</strong><span>{money(item.priceCents)} {item.onSale && <i>SALE</i>}</span></div><div className="counter"><button aria-label={`Remove ${item.name}`} onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(0, (q[item.id] || 0) - 1) }))}>−</button><span>{quantities[item.id] || 0}</span><button aria-label={`Add ${item.name}`} onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.min(20, (q[item.id] || 0) + 1) }))}>+</button></div></div>)}</div>
          <div className="customer"><span>CUSTOMER PROFILE</span><div className="segmented compact"><button className={customerType === 'new' ? 'selected' : ''} onClick={() => setCustomerType('new')}>New customer</button><button className={customerType === 'returning' ? 'selected' : ''} onClick={() => setCustomerType('returning')}>Returning</button></div></div>
          <div className="receipt"><div><span>Merchandise</span><strong>{money(checkout?.subtotalCents || 0)}</strong></div><div><span>Eligible subtotal</span><strong>{money(checkout?.eligibleSubtotalCents || 0)}</strong></div><div className="discount"><span>Promotion <small>({checkout?.reason})</small></span><strong>−{money(checkout?.discountCents || 0)}</strong></div><div className="total"><span>Total due</span><strong>{money(checkout?.totalCents || 0)}</strong></div></div>
        </section>
      </div>
      <section className="panel assurance"><div className="section-head"><span className="step">03</span><div><div className="eyebrow">EVIDENCE BEFORE ACTIVATION</div><h2>The launch gate</h2></div><span className="head-tag">KANE CLI</span></div><div className="assurance-grid"><div><div className="assurance-status"><span className={`status-orb ${status === 'passed' ? 'green' : status === 'failed' ? 'red' : ''}`} />{status}</div><p>{snapshot?.verification?.summary || 'A real browser suite must test the confirmed candidate before it can go live.'}</p><div className="verification-meta"><span>Candidate <b>{snapshot?.candidate ? `#${snapshot.candidate.id}` : '—'}</b></span><span>Required suite <b>{snapshot?.suiteReady ? 'Ready' : 'Awaiting reviewed tests'}</b></span><span>Evidence <b>{snapshot?.verification?.evidenceLogs?.length || 0} logs</b></span></div></div><div className="gate-actions"><button className="button button-outline" onClick={verify} disabled={Boolean(busy) || !snapshot?.suiteReady || !snapshot?.candidate || snapshot?.running}>{snapshot?.running ? 'Kane is running…' : '▶ Run Kane verification'}</button><button className="button button-coral" onClick={activate} disabled={Boolean(busy) || !snapshot?.activation.ok || hasDraftChanges}>Activate verified revision →</button><small>{hasDraftChanges ? 'Confirm or discard unsaved edits before activating' : snapshot?.activation.reason}</small></div></div></section>
      {snapshot?.verification && <section className="report"><div className="report-title"><span>KANE RUN REPORT</span><span>{snapshot.verification.executionId || 'Run in progress'}</span></div><div className="report-list">{snapshot.verification.checks?.length ? snapshot.verification.checks.map(check => <div className="report-check" key={check.name}><span className={check.status === 'passed' ? 'check-pass' : 'check-fail'}>{check.status === 'passed' ? '✓' : '!'}</span><span>{check.name}{check.failure && <small>{check.failure}</small>}</span><b>{check.status}</b></div>) : <p>Individual check results will appear when the run finishes.</p>}</div>{snapshot.verification.evidencePack && <a href="/api/evidence" className="evidence-link">Download the sealed Kane evidence pack ↗</a>}</section>}
      <footer><span>LAUNCHGATE / LOCAL HACK DAY BUILD</span><span>POLICY → CHECKOUT → PROOF → LAUNCH</span></footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
