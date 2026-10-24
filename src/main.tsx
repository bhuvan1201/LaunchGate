import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { catalog, money, type Policy } from '../shared/promotion';
import './style.css';
import { EvidencePanel } from './EvidencePanel';
import type { RunReport } from '../shared/evidence-status';
import { merchantStep, numberDraft, policySummary, reviewDraft, type NumberDraft } from '../shared/merchant-flow';
import type { Assurance } from '../server/assurance';

type Revision = { id: number; sourceText: string; policy: Policy; confirmedAt: string };
type Snapshot = { testingPaused: boolean; limits: { blocking: string[]; notes: string[] } | null; assurance: Assurance | null; candidate: Revision | null; active: Revision | null; verification: RunReport | null; activation: { ok: boolean; reason: string }; suiteReady: boolean; running: boolean; openaiReady: boolean };
type Quote = { subtotalCents: number; eligibleSubtotalCents: number; discountCents: number; totalCents: number; reason: string };
const startingPolicy: Policy = { title: 'Welcome 20', percentOff: 20, minimumEligibleCents: 4200, maximumDiscountCents: 1000, newCustomersOnly: true, excludeSaleItems: true };
const sample = 'Name this promotion Welcome 20. Give new customers 20% off when eligible merchandise reaches $42, cap the discount at $10, and exclude sale items.';

async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result as T;
}

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [isNewPromotion, setIsNewPromotion] = useState(true);
  const [text, setText] = useState('');
  const [policy, setPolicy] = useState<Policy>({ ...startingPolicy, title: '' });
  const [numbers, setNumbers] = useState<NumberDraft>({ percentOff: '', minimum: '', cap: '' });
  const [presentation, setPresentation] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [inputMode, setInputMode] = useState<'language' | 'manual'>('language');
  const [interpretedText, setInterpretedText] = useState('');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'candidate' | 'active'>('candidate');
  const [quantities, setQuantities] = useState<Record<string, number>>({ tote: 0, mug: 0, hoodie: 0, cap: 0 });
  const [customerType, setCustomerType] = useState<'new' | 'returning'>('new');
  const [checkout, setCheckout] = useState<Quote | null>(null);

  const refresh = async () => setSnapshot(await api<Snapshot>('/api/state'));
  const loadRevision = (revision: Revision) => {
    setText(revision.sourceText); setInterpretedText(revision.sourceText);
    setPolicy(revision.policy); setNumbers(numberDraft(revision.policy));
    setIsNewPromotion(false); setParsed(true); setMode('candidate');
    const url = new URL(window.location.href); url.searchParams.set('campaign', String(revision.id));
    window.history.replaceState(null, '', url);
  };
  useEffect(() => { api<Snapshot>('/api/state').then(state => {
    setSnapshot(state);
    const requested = new URLSearchParams(window.location.search).get('campaign');
    if (requested && state.candidate && requested === String(state.candidate.id)) loadRevision(state.candidate);
    else if (requested) setError('That revision is no longer the current candidate. Start a promotion or explicitly continue the saved one below.');
  }).catch(e => setError(e.message)); }, []);
  useEffect(() => { const timer = setInterval(() => refresh().catch(() => setError('The app could not refresh its status. Your draft is still here; reconnect and try again.')), snapshot?.running || snapshot?.assurance?.status === 'generating' ? 2000 : 5000); return () => clearInterval(timer); }, [snapshot?.running, snapshot?.assurance?.status]);
  useEffect(() => {
    let current = true;
    if (isNewPromotion) { setCheckout(null); return; }
    api<{ quote: Quote }>('/api/quote', { cart: { quantities, customerType }, mode }).then(({ quote }) => { if (current) setCheckout(quote); }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [isNewPromotion, snapshot?.candidate?.id, snapshot?.active?.id, quantities, customerType, mode]);
  const act = async (name: string, action: () => Promise<void>) => { setBusy(name); setError(''); setNotice(''); try { await action(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(''); } };
  const setField = <K extends keyof Policy>(name: K, value: Policy[K]) => { setPolicy(current => ({ ...current, [name]: value })); setParsed(true); };
  const parse = () => act('parse', async () => {
    setInterpretedText('');
    const result = await api<{ proposal: Policy | null; clarification: string; unsupported: boolean }>('/api/parse', { text });
    if (!result.proposal) throw new Error(result.clarification);
    setPolicy(result.proposal); setNumbers(numberDraft(result.proposal)); setInterpretedText(text); setParsed(true); setNotice('OpenAI interpreted the request. Review each field before confirming.');
  });
  const draft = reviewDraft(policy, numbers);
  const confirm = () => act('confirm', async () => {
    if (!draft.policy) throw new Error('Please correct the highlighted offer details.');
    const confirmedPolicy = draft.policy;
    const sourceText = inputMode === 'manual' ? `${confirmedPolicy.title}. ${policySummary(confirmedPolicy)}` : text;
    const result = await api<{ candidate: Revision }>('/api/confirm', { sourceText, policy: confirmedPolicy, previousRevisionId: snapshot?.candidate?.id ?? null });
    loadRevision(result.candidate);
    if (inputMode === 'manual') { setText(sourceText); setInterpretedText(sourceText); }
    setNotice('Candidate revision saved. Verification is required before activation.');
  });
  const generate = () => act('generate', async () => { await api('/api/suite/generate', { revisionId: snapshot?.candidate?.id }); setNotice('Kane is deriving use cases from this confirmed policy.'); });
  const review = (ids: string[]) => act('review', async () => { await api('/api/suite/review', { revisionId: snapshot?.candidate?.id, token: snapshot?.assurance?.reviewToken, ids }); setSelectedUseCases([]); });
  const resume = () => act('resume', async () => { await api('/api/suite/resume', { revisionId: snapshot?.candidate?.id, message: answer }); setAnswer(''); });
  const recover = () => act('recover', async () => { await api('/api/suite/recover', { revisionId: snapshot?.candidate?.id }); });
  const restart = () => act('restart', async () => { await api('/api/suite/restart', { revisionId: snapshot?.candidate?.id }); });
  const supplyInputs = () => act('inputs', async () => { await api('/api/suite/inputs', { revisionId: snapshot?.candidate?.id, values: inputValues }); setInputValues({}); });
  const needsInterpretation = inputMode === 'language' && (!text.trim() || text !== interpretedText);
  const kaneBusy = Boolean(snapshot?.running || snapshot?.assurance?.status === 'generating');
  const kaneUnavailable = Boolean(snapshot?.testingPaused || kaneBusy);
  const assurance = isNewPromotion ? null : snapshot?.assurance;
  const verify = () => act('verify', async () => { await api('/api/verify', {}); setNotice('Kane is testing the candidate in a real browser.'); });
  const activate = () => act('activate', async () => { await api('/api/activate', {}); setMode('active'); setNotice('Verified campaign activated. The live storefront now uses this revision.'); });
  const hasDraftChanges = isNewPromotion || Boolean(snapshot?.candidate && (!draft.policy || (inputMode === 'language' && text !== snapshot.candidate.sourceText) || JSON.stringify(draft.policy) !== JSON.stringify(snapshot.candidate.policy)));
  const discardDraft = () => { const revision = snapshot?.candidate; if (!revision) return; loadRevision(revision); setError(''); setNotice('Continuing your saved campaign.'); };
  const startNewPromotion = () => {
    setPresentation(false); setIsNewPromotion(true); setText(''); setInterpretedText(''); setPolicy({ ...startingPolicy, title: '' });
    setNumbers({ percentOff: '', minimum: '', cap: '' }); setParsed(false); setInputMode('language');
    setMode('candidate'); setQuantities({ tote: 0, mug: 0, hoodie: 0, cap: 0 }); setCustomerType('new');
    setSelectedUseCases([]); setInputValues({}); setAnswer(''); setError(''); setNotice('');
    const url = new URL(window.location.href); url.searchParams.delete('campaign'); window.history.replaceState(null, '', url);
  };
  const showPolicyReview = inputMode === 'manual' || parsed || !isNewPromotion;
  const journey = merchantStep({ hasCandidate: !isNewPromotion && Boolean(snapshot?.candidate), draftChanged: hasDraftChanges, preparation: assurance?.status, suiteReady: Boolean(snapshot?.suiteReady), running: Boolean(snapshot?.running), canActivate: Boolean(snapshot?.activation.ok), active: Boolean(snapshot?.candidate && snapshot?.active?.id === snapshot.candidate.id) });
  const evidence = !isNewPromotion && snapshot?.candidate ? <EvidencePanel revisionId={snapshot.candidate.id} report={snapshot.verification} activation={snapshot.activation} suiteReady={snapshot.suiteReady} testingPaused={snapshot.testingPaused} busy={Boolean(busy) || kaneBusy} draftChanged={hasDraftChanges} presentation={presentation} verify={verify} activate={activate} /> : null;
  const goToStep = () => {
    const element = document.getElementById(journey.target);
    if (element instanceof HTMLDetailsElement) element.open = true;
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return <div className="shell">
    <header className="topbar"><div className="brand"><span className="brandmark">✦</span><span>launchgate</span><small> / control room</small></div><div className="top-right"><span className="live-dot" /> LOCAL DEMO <span className="divider">|</span> BUILT WITH OPENAI + KANE CLI</div></header>
    <main>
      <section className="hero"><div><div className="eyebrow">CAMPAIGN ASSURANCE / 001</div><h1>Make the promise.<br /><em>Prove the checkout.</em></h1><p>Turn a promotion into a policy, test the actual customer journey, and launch only when the evidence matches.</p></div><div className="hero-meter"><div className="meter-label">CURRENT STEP</div><div className="meter-number">{String(journey.step).padStart(2, '0')}<span>/04</span></div><div className="meter-track"><span style={{ width: `${journey.step * 25}%` }} /></div><small>{journey.title}</small></div></section>
      {!isNewPromotion && snapshot?.candidate && <div className="view-switch"><span>{presentation ? 'Presentation · confirmed offer and live checkout' : 'Campaign workspace'}</span><button className="button button-outline" disabled={Boolean(busy)} onClick={() => setPresentation(value => !value)}>{presentation ? 'Back to editing' : 'Present this campaign'}</button></div>}
      {!presentation && <nav className="journey" aria-label="Campaign progress">{['Define offer', 'Review checks', 'Verify checkout', 'Activate'].map((label, index) => <span key={label} className={journey.step === index + 1 ? 'current' : journey.step > index + 1 ? 'complete' : ''}><b>{index + 1}</b>{label}</span>)}</nav>}
      {!presentation && snapshot?.candidate && <section className="saved-campaign"><div><strong>{isNewPromotion ? 'A saved promotion is available' : 'Working on your saved promotion'}</strong><p>{snapshot.candidate.policy.title} · revision #{snapshot.candidate.id}. {isNewPromotion ? 'Start below, or continue your previous work.' : 'You can also begin a new offer.'}</p></div><button className="button button-outline" disabled={Boolean(busy)} onClick={isNewPromotion ? discardDraft : startNewPromotion}>{isNewPromotion ? 'Continue saved promotion' : 'Start a new promotion'}</button></section>}
      {!presentation && <section className="next-action"><div><strong>{journey.title}</strong><p>{journey.detail}</p></div><button className="button button-outline" onClick={goToStep}>Go to this step ↓</button></section>}
      {!presentation && snapshot?.testingPaused && <p className="pause-note">App-triggered testing is paused. Promotion editing and checkout preview are available.</p>}
      {(error || notice) && <div className={`banner ${error ? 'banner-error' : ''}`} role="status"><span>{error ? '!' : '✓'}</span>{error || notice}<button onClick={() => { setError(''); setNotice(''); }} aria-label="Dismiss message">×</button></div>}
      <div className="workspace">
        <section className="panel editor" id="campaign-studio"><div className="section-head"><span className="step">01</span><div><div className="eyebrow">DEFINE THE RULE</div><h2>Campaign studio</h2></div><span className="head-tag">YOUR OFFER</span></div>
          {presentation && snapshot?.candidate ? <div className="confirmed-offer"><span className="evidence-badge evidence-neutral">Confirmed revision #{snapshot.candidate.id}</span><h3>{snapshot.candidate.policy.title}</h3><blockquote>{snapshot.candidate.sourceText}</blockquote><div className="policy-summary"><strong>Reviewed policy</strong><p>{policySummary(snapshot.candidate.policy)}</p></div><p className="help">The cart uses this confirmed policy. Returning to editing allows a new revision; that revision needs fresh verification.</p></div> : <>
          <div className="segmented input-mode"><button className={inputMode === 'language' ? 'selected' : ''} disabled={Boolean(busy)} onClick={() => setInputMode('language')}>Describe a promotion</button><button className={inputMode === 'manual' ? 'selected' : ''} disabled={Boolean(busy)} onClick={() => setInputMode('manual')}>Enter details directly</button></div>
          {inputMode === 'language' && <><label className="field-label" htmlFor="brief">Your promotion, in plain English</label><textarea id="brief" disabled={Boolean(busy)} value={text} onChange={e => { setText(e.target.value); setParsed(false); }} rows={4} placeholder="Describe the discount, minimum, cap and eligibility..." />
          <div className="action-row"><button className="button button-dark" onClick={parse} disabled={!snapshot || Boolean(busy) || text.trim().length < 10}>{busy === 'parse' ? 'Interpreting…' : '✧ Interpret with OpenAI'}</button><span className="help">{snapshot?.openaiReady ? 'API connected' : 'Interpretation is temporarily unavailable'}</span></div></>}
          <p className="help">Supported here: a 1–100% discount, minimum spend, savings cap, customer eligibility and sale-item rules. Shipping, scheduling and other offer types are not supported.</p>
          <>{!showPolicyReview && <div className="policy-summary"><strong>Start with your business needs</strong><p>Describe your offer above. Your policy will appear here for review after interpretation.</p><button className="text-button" disabled={Boolean(busy)} onClick={() => setText(sample)}>Use an example offer</button></div>}</>
          {showPolicyReview && <><div className="rule-head"><span>POLICY REVIEW</span><span>EDITABLE DRAFT</span></div>
          <div className="fields"><label className="wide">Campaign name<input disabled={Boolean(busy)} aria-label="Campaign name" value={policy.title} onChange={e => setField('title', e.target.value)} /></label><label>Discount percentage<input disabled={Boolean(busy)} aria-label="Discount percentage" type="number" min="1" max="100" value={numbers.percentOff} aria-invalid={Boolean(draft.errors.percentOff)} onChange={e => setNumbers(current => ({ ...current, percentOff: e.target.value }))} /><b>%</b></label><label>Minimum eligible subtotal<input disabled={Boolean(busy)} aria-label="Minimum eligible subtotal" type="number" min="0" step="0.01" value={numbers.minimum} aria-invalid={Boolean(draft.errors.minimumEligibleCents)} onChange={e => setNumbers(current => ({ ...current, minimum: e.target.value }))} /><b>$</b></label><label>Maximum discount<input disabled={Boolean(busy)} aria-label="Maximum discount" type="number" min="0.01" step="0.01" value={numbers.cap} aria-invalid={Boolean(draft.errors.maximumDiscountCents)} onChange={e => setNumbers(current => ({ ...current, cap: e.target.value }))} /><b>$</b></label></div>
          <label className="toggle"><input disabled={Boolean(busy)} type="checkbox" checked={policy.newCustomersOnly} onChange={e => setField('newCustomersOnly', e.target.checked)} /><span>New customers only</span><small>Returning customers get no discount</small></label><label className="toggle"><input disabled={Boolean(busy)} type="checkbox" checked={policy.excludeSaleItems} onChange={e => setField('excludeSaleItems', e.target.checked)} /><span>Exclude sale items</span><small>Sale items do not count toward the minimum</small></label>
          {Object.entries(draft.errors).map(([field, message]) => <p role="alert" className="field-error" key={field}>{message}</p>)}
          {draft.policy && <div className="policy-summary"><strong>The offer you are approving</strong><p>{policySummary(draft.policy)}</p>{needsInterpretation && <small>This preview still uses the previous fields. Interpret your changed request to update it.</small>}</div>}
          <div className="panel-foot"><button className="button button-coral" onClick={confirm} disabled={!snapshot || Boolean(busy) || kaneBusy || needsInterpretation || !draft.policy || Boolean(snapshot?.candidate && !hasDraftChanges)}>{busy === 'confirm' ? 'Saving…' : !isNewPromotion && snapshot?.candidate ? hasDraftChanges ? 'Confirm new revision →' : 'Campaign confirmed ✓' : 'Confirm candidate →'}</button><span>{needsInterpretation ? 'Interpret the updated request before confirming' : 'Review the fields before confirming'}</span></div>
          {!isNewPromotion && hasDraftChanges && <button className="text-button" onClick={discardDraft} disabled={Boolean(busy)}>Discard unsaved changes</button>}</>}</>}
        </section>
        <section className="panel shop" id="storefront-lab"><div className="section-head"><span className="step">02</span><div><div className="eyebrow">SEE WHAT SHOPPERS SEE</div><h2>Storefront lab</h2></div><span className="head-tag">REAL PRICING</span></div>
          {isNewPromotion ? <div className="empty-preview"><span className="eyebrow">AFTER YOU CONFIRM</span><h3>Your checkout preview will appear here</h3><p>Define and confirm your promotion first. Then try customer carts against that exact offer.</p></div> : <><div className="segmented"><button className={mode === 'candidate' ? 'selected' : ''} onClick={() => setMode('candidate')}>Candidate preview {snapshot?.candidate ? `#${snapshot.candidate.id}` : ''}</button><button className={mode === 'active' ? 'selected' : ''} onClick={() => setMode('active')}>Active store {snapshot?.active ? `#${snapshot.active.id}` : ''}</button></div>
          <div className="store-note">{mode === 'candidate' ? snapshot?.candidate ? `${snapshot.candidate.policy.title} · confirmed revision ${snapshot.candidate.id}${hasDraftChanges ? ' · unsaved edits are not previewed' : ''}` : 'Confirm a candidate to preview its policy.' : snapshot?.active ? `${snapshot.active.policy.title} is live in this demo store.` : 'No campaign has been activated yet.'}</div>
          <div className="products">{catalog.map(item => <div className="product" key={item.id}><div className={`product-art art-${item.id}`}>{item.icon}</div><div className="product-copy"><strong>{item.name}</strong><span>{money(item.priceCents)} {item.onSale && <i>SALE</i>}</span></div><div className="counter"><button aria-label={`Remove ${item.name}`} onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.max(0, (q[item.id] || 0) - 1) }))}>−</button><span>{quantities[item.id] || 0}</span><button aria-label={`Add ${item.name}`} onClick={() => setQuantities(q => ({ ...q, [item.id]: Math.min(20, (q[item.id] || 0) + 1) }))}>+</button></div></div>)}</div>
          <div className="customer"><span>CUSTOMER PROFILE</span><div className="segmented compact"><button className={customerType === 'new' ? 'selected' : ''} onClick={() => setCustomerType('new')}>New customer</button><button className={customerType === 'returning' ? 'selected' : ''} onClick={() => setCustomerType('returning')}>Returning</button></div></div>
          <div className="receipt"><div><span>Merchandise</span><strong>{money(checkout?.subtotalCents || 0)}</strong></div><div><span>Eligible subtotal</span><strong>{money(checkout?.eligibleSubtotalCents || 0)}</strong></div><div className="discount"><span>Promotion <small>({checkout?.reason})</small></span><strong>−{money(checkout?.discountCents || 0)}</strong></div><div className="total"><span>Total due</span><strong>{money(checkout?.totalCents || 0)}</strong></div></div></>}
        </section>
      </div>
      {!presentation && evidence}
      {!presentation && !isNewPromotion && snapshot?.candidate && <details className="panel suite-review preparation-panel" id="campaign-tests"><summary><span>Prepare or review this campaign’s checks</span><small>{assurance?.status === 'approved' ? 'Reviewed suite saved' : assurance?.status === 'generating' ? 'Preparation in progress' : 'Do this before the presentation'}</small></summary><div className="preparation-content">
        <div className="section-head"><span className="step">✓</span><div><div className="eyebrow">REVIEW WHAT WILL BE PROVEN</div><h2>Test preparation</h2></div></div>
        <p>Each confirmed revision gets its own Kane-generated suite. Review the journeys first, then the checks and their expected results. Passing checkout examples do not prove every possible behavior.</p>
        {snapshot?.testingPaused && <p className="evidence-warning">App-triggered generation is paused. You can prepare and run a separate suite using the operator command guide.</p>}
        {hasDraftChanges && <p className="evidence-warning">Confirm or discard your edits before preparing tests for this campaign.</p>}
        {snapshot?.limits?.blocking.map(message => <p className="banner banner-error" key={message}>{message}</p>)}
        {!assurance && <><p>Generate tests for candidate #{snapshot?.candidate?.id || '—'}. This sends its confirmed policy and demo catalog to Kane and uses Kane credits.</p><button className="button button-dark" onClick={generate} disabled={!snapshot?.candidate || Boolean(busy) || kaneUnavailable || hasDraftChanges || Boolean(snapshot?.limits?.blocking.length)}>Generate tests with Kane</button></>}
        {assurance && <>
          {assurance.status === 'generating' && <div className="preparing"><span className="live-dot" /> Preparing this campaign’s checks. This can take several minutes; you can leave this page open.</div>}
          <p role="status"><strong>{assurance.message}</strong></p>
          <small>Revision #{assurance.revisionId} · Generation credits reported: {assurance.credits.toFixed(2)}</small>
          {assurance.warnings.map((warning, index) => <p className="banner banner-error" key={index}>{warning}</p>)}
          <details className="review-item" open={assurance.status === 'review-usecases'}><summary>{assurance.status === 'review-usecases' ? 'Choose what to check' : 'Requirements and coverage details'}</summary>
          {assurance.items.filter(item => assurance.status !== 'review-usecases' || ['usecase', 'gap'].includes(item.label)).map(item => <details key={item.id} className="review-item">
            <summary>{assurance.status === 'review-usecases' && item.label === 'usecase' && <input type="checkbox" aria-label={`Select ${item.title}`} checked={selectedUseCases.includes(item.id)} onChange={e => setSelectedUseCases(ids => e.target.checked ? [...ids, item.id] : ids.filter(id => id !== item.id))} />} {item.label === 'gap' ? 'Unproven / gap: ' : ''}{item.title}</summary>
            <p className="requirement-detail">{item.detail}</p>
          </details>)}
          </details>
          {assurance.status === 'review-usecases' && <button className="button button-coral" disabled={Boolean(busy) || kaneUnavailable || hasDraftChanges || !selectedUseCases.length} onClick={() => review(selectedUseCases)}>Approve selected journeys and design tests</button>}
          {assurance.tests.map(test => <details key={test.path} className="review-item"><summary>{test.content.match(/^# (.+)$/m)?.[1] || 'Checkout check'}</summary><p>{test.content.match(/^> (.+)$/m)?.[1]}</p><details><summary>View test steps</summary><pre>{test.content.replace(/^---[\s\S]*?---\s*/, '')}</pre></details></details>)}
          {assurance.status === 'review-tests' && <><p>Approval covers every displayed criterion, scenario and test. Review the gaps above; they remain unproven. If the material is wrong, leave it unapproved and revise the campaign.</p><button className="button button-coral" disabled={Boolean(busy) || kaneUnavailable || hasDraftChanges} onClick={() => review(assurance.items.filter(i => ['ac', 'scenario', 'test'].includes(i.label)).map(i => i.id))}>Approve these checks for this revision</button></>}
          {assurance.status === 'paused' && <>
            {assurance.pause?.questions.map((question, index) => <div className="question-card" key={question.id || index}><strong>{question.text || 'Kane needs more information'}</strong>{question.rationale && <p>{question.rationale}</p>}<div className="question-options">{question.options?.map(option => <button key={option.label} className="button button-outline" onClick={() => setAnswer(previous => `${previous}${previous ? '\n' : ''}${question.id || index + 1}: ${option.label}`)}>{option.label}</button>)}</div></div>)}
            <label>Your answer<textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={3} /></label><button className="button button-dark" disabled={Boolean(busy) || kaneUnavailable || hasDraftChanges || !answer.trim()} onClick={resume}>Send answer and continue</button>
          </>}
          {assurance.status === 'needs-input' && <><p>Please supply the details below. You do not need to edit any files.</p>{assurance.variables?.map(variable => <label className="field-label" key={variable.name}>{variable.description}<input type={variable.secret ? 'password' : 'text'} value={inputValues[variable.name] || ''} onChange={e => setInputValues(values => ({ ...values, [variable.name]: e.target.value }))} /></label>)}<button className="button button-dark" disabled={Boolean(busy) || kaneUnavailable || hasDraftChanges} onClick={supplyInputs}>Save details and continue</button></>}
          {assurance.status === 'failed' && <div className="recovery-actions"><p>Preparation has stopped. Recover the saved work first. If it cannot continue, a fresh attempt preserves the old work and uses additional Kane credits.</p><button className="button button-outline" disabled={Boolean(busy) || kaneUnavailable || hasDraftChanges} onClick={recover}>Recover preparation</button><button className="button button-dark" disabled={Boolean(busy) || kaneUnavailable || hasDraftChanges} onClick={restart}>Start fresh preparation</button></div>}
          {assurance.status === 'approved' && !snapshot?.suiteReady && <button className="button button-outline" disabled={Boolean(busy) || kaneUnavailable || hasDraftChanges} onClick={recover}>Review updated checks</button>}

        </>}
      </div></details>}
      <footer><span>LAUNCHGATE / LOCAL HACK DAY BUILD</span><span>POLICY → CHECKOUT → PROOF → LAUNCH</span></footer>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
