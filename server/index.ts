import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import OpenAI from 'openai';
import { z } from 'zod';
import { campaignLimits, unsupportedRequest } from '../shared/campaign-scope.js';
import { catalog, policySchema, quote } from '../shared/promotion.js';
import { active, canActivate, candidate, confirm, readState, readSuite, suiteMatchesCandidate, writeState } from './state.js';
import { isRunning, launchVerification, recoverInterruptedVerification } from './kane.js';
import { assuranceBusy, generateSuite, readAssurance, resumeSuite, reviewSuite, recoverSuite, restartSuite, supplyVariables } from './assurance.js';

recoverInterruptedVerification();
const app = express();
const testingPaused = process.env.KANE_EXECUTION_PAUSED === '1';
app.use(express.json({ limit: '32kb' }));
const respondError = (res: express.Response, error: unknown, status = 400) => res.status(status).json({ error: error instanceof z.ZodError ? error.issues.map(issue => `${issue.path.join('.') || 'Input'}: ${issue.message}`).join('; ') : error instanceof Error ? error.message : 'Request failed' });

app.get('/api/state', (_req, res) => {
  try {
    const state = readState();
    let suiteReady = false;
    try { const current = candidate(state); const suite = readSuite(current); suiteReady = Boolean(suite && current && suiteMatchesCandidate(current, suite.suite)); } catch { /* invalid suite is never ready */ }
    res.json({ testingPaused, candidate: candidate(state), active: active(state), verification: state.verification, activation: canActivate(state), suiteReady, running: isRunning(), assurance: readAssurance(candidate(state)), limits: candidate(state) ? campaignLimits(candidate(state)!.policy) : null, catalog, openaiReady: Boolean(process.env.OPENAI_API_KEY) });
  } catch (error) { respondError(res, error, 500); }
});

const parseInput = z.object({ text: z.string().trim().min(10).max(2000) }).strict();
const aiSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' }, percentOff: { type: 'integer' }, minimumEligibleCents: { type: 'integer' }, maximumDiscountCents: { type: 'integer' }, newCustomersOnly: { type: 'boolean' }, excludeSaleItems: { type: 'boolean' }, clarification: { type: 'string' }, unsupported: { type: 'boolean' }
  },
  required: ['title', 'percentOff', 'minimumEligibleCents', 'maximumDiscountCents', 'newCustomersOnly', 'excludeSaleItems', 'clarification', 'unsupported']
} as const;
app.post('/api/parse', async (req, res) => {
  try {
    const { text } = parseInput.parse(req.body);
    const unsupported = unsupportedRequest(text);
    if (unsupported) return res.json({ proposal: null, clarification: unsupported, unsupported: true });
    if (!process.env.OPENAI_API_KEY) return respondError(res, new Error('The interpretation service is unavailable. Try again later or choose Enter details directly.'), 503);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      input: [{ role: 'system', content: 'Interpret merchant promotions for LaunchGate. Supported: percentage discount, minimum eligible merchandise subtotal, maximum discount cap, new customer restriction, sale item exclusion. Convert dollar amounts to integer cents. Never invent missing discount, minimum, or cap: if any required number is missing, set unsupported=true and explain in clarification. If the request contains unsupported conditions, set unsupported=true. When a boolean is unspecified use false. Return a short title. Never calculate checkout.' }, { role: 'user', content: text }],
      text: { format: { type: 'json_schema', name: 'promotion_interpretation', strict: true, schema: aiSchema } }
    });
    const parsed = JSON.parse(response.output_text);
    if (parsed.unsupported || parsed.clarification) return res.json({ proposal: null, clarification: parsed.clarification || 'This promotion includes unsupported conditions.', unsupported: true });
    const { title, percentOff, minimumEligibleCents, maximumDiscountCents, newCustomersOnly, excludeSaleItems } = parsed;
    const checked = policySchema.safeParse({ title, percentOff, minimumEligibleCents, maximumDiscountCents, newCustomersOnly, excludeSaleItems });
    if (!checked.success) return res.json({ proposal: null, unsupported: true, clarification: 'Please specify a campaign name, a whole-number discount from 1% to 100%, a minimum from $0 to $10,000, and a savings cap from $0.01 to $10,000. You can also choose Enter details directly.' });
    res.json({ proposal: checked.data, clarification: '', unsupported: false });
  } catch { res.status(502).json({ error: 'We could not interpret that request right now. Try again, or choose Enter details directly to review the offer yourself.' }); }
});

app.post('/api/confirm', (req, res) => {
  try { if (isRunning() || assuranceBusy()) throw new Error('Wait for Kane to finish before confirming another revision'); const input = z.object({ sourceText: z.string(), policy: policySchema, previousRevisionId: z.number().int().positive().nullable().optional() }).strict().parse(req.body); const latest = candidate(readState()); if (input.previousRevisionId !== undefined && input.previousRevisionId !== (latest?.id ?? null)) throw new Error('The campaign changed in another tab. Review the current campaign before confirming.'); res.json({ candidate: confirm(input.sourceText, input.policy) }); }
  catch (error) { respondError(res, error); }
});
app.post('/api/quote', (req, res) => {
  try {
    const input = z.object({ cart: z.unknown(), mode: z.enum(['candidate', 'active']) }).strict().parse(req.body);
    const state = readState();
    const revision = input.mode === 'candidate' ? candidate(state) : active(state);
    res.json({ quote: quote(input.cart, revision?.policy), revision });
  } catch (error) { respondError(res, error); }
});
function currentCandidate() {
  if (testingPaused) throw new Error('Test preparation is paused while this build is being finished. You can still draft, confirm and preview promotions.');
  if (isRunning() || assuranceBusy()) throw new Error('Wait for the current Kane operation to finish');
  const revision = candidate(readState());
  if (!revision) throw new Error('Confirm a candidate first');
  return revision;
}
app.post('/api/suite/generate', (req, res) => {
  try { const { revisionId } = z.object({ revisionId: z.number().int().positive() }).strict().parse(req.body); const r = currentCandidate(); if (r.id !== revisionId) throw new Error('Candidate changed; refresh first'); generateSuite(r); res.status(202).json({ started: true }); }
  catch (error) { respondError(res, error); }
});
app.post('/api/suite/review', (req, res) => {
  try { const input = z.object({ revisionId: z.number().int().positive(), token: z.string().min(1), ids: z.array(z.string()).min(1).max(300) }).strict().parse(req.body); const r = currentCandidate(); if (r.id !== input.revisionId) throw new Error('Candidate changed; refresh first'); reviewSuite(r, input.token, input.ids); res.status(202).json({ started: true }); }
  catch (error) { respondError(res, error); }
});
app.post('/api/suite/resume', (req, res) => {
  try { const input = z.object({ revisionId: z.number().int().positive(), message: z.string().trim().min(1).max(6000) }).strict().parse(req.body); const r = currentCandidate(); if (r.id !== input.revisionId) throw new Error('Candidate changed; refresh first'); resumeSuite(r, input.message); res.status(202).json({ started: true }); }
  catch (error) { respondError(res, error); }
});
for (const [action, handler] of [['recover', recoverSuite], ['restart', restartSuite]] as const) {
  app.post(`/api/suite/${action}`, (req, res) => {
    try { const input = z.object({ revisionId: z.number().int().positive() }).strict().parse(req.body); const r = currentCandidate(); if (r.id !== input.revisionId) throw new Error('Your campaign changed. Refresh and try again.'); handler(r); res.status(202).json({ started: true }); }
    catch (error) { respondError(res, error); }
  });
}
app.post('/api/suite/inputs', (req, res) => {
  try { const input = z.object({ revisionId: z.number().int().positive(), values: z.record(z.string(), z.string().max(2000)) }).strict().parse(req.body); const r = currentCandidate(); if (r.id !== input.revisionId) throw new Error('Your campaign changed. Refresh and try again.'); supplyVariables(r, input.values); res.status(202).json({ started: true }); }
  catch (error) { respondError(res, error); }
});
app.post('/api/verify', (_req, res) => {
  try { if (testingPaused) throw new Error('Browser verification is paused while this build is being finished.'); if (assuranceBusy()) throw new Error('Wait for test generation and review to finish'); launchVerification(); res.status(202).json({ started: true }); }
  catch (error) { respondError(res, error); }
});
app.post('/api/activate', (_req, res) => {
  try {
    const state = readState();
    const eligibility = canActivate(state);
    if (!eligibility.ok) return respondError(res, new Error(eligibility.reason), 409);
    state.activeRevisionId = candidate(state)!.id;
    writeState(state);
    res.json({ active: active(state) });
  } catch (error) { respondError(res, error, 500); }
});
app.get('/api/evidence', (_req, res) => {
  const pack = readState().verification?.evidencePack;
  if (!pack || !pack.startsWith(path.resolve(process.env.LAUNCHGATE_DATA_DIR || 'data', 'campaigns') + path.sep) || !existsSync(pack)) return respondError(res, new Error('No Kane evidence pack is available'), 404);
  res.download(pack);
});

const port = Number(process.env.PORT || 4173);
if (process.env.NODE_ENV === 'production') app.use(express.static(path.resolve('dist')));
else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true, hmr: { port: port + 1 } }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.listen(port, '127.0.0.1', () => console.log(`LaunchGate running at http://127.0.0.1:${port}`));
