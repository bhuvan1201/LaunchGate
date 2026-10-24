import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import OpenAI from 'openai';
import { z } from 'zod';
import { catalog, policySchema, quote } from '../shared/promotion.js';
import { active, canActivate, candidate, confirm, readState, readSuite, suiteMatchesCandidate, writeState } from './state.js';
import { isRunning, launchVerification } from './kane.js';

const app = express();
app.use(express.json({ limit: '32kb' }));
const respondError = (res: express.Response, error: unknown, status = 400) => res.status(status).json({ error: error instanceof z.ZodError ? error.issues.map(issue => `${issue.path.join('.') || 'Input'}: ${issue.message}`).join('; ') : error instanceof Error ? error.message : 'Request failed' });

app.get('/api/state', (_req, res) => {
  try {
    const state = readState();
    let suiteReady = false;
    try { const suite = readSuite(); const current = candidate(state); suiteReady = Boolean(suite && current && suiteMatchesCandidate(current, suite.suite)); } catch { /* invalid suite is never ready */ }
    res.json({ candidate: candidate(state), active: active(state), verification: state.verification, activation: canActivate(state), suiteReady, running: isRunning(), catalog, openaiReady: Boolean(process.env.OPENAI_API_KEY) });
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
    if (!process.env.OPENAI_API_KEY) return respondError(res, new Error('OpenAI API key is not configured. Add OPENAI_API_KEY to local .env, or enter policy fields manually.'), 503);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      input: [{ role: 'system', content: 'Interpret merchant promotions for LaunchGate. Supported: percentage discount, minimum eligible merchandise subtotal, maximum discount cap, new customer restriction, sale item exclusion. Convert dollar amounts to integer cents. Never invent missing discount, minimum, or cap: if any required number is missing, set unsupported=true and explain in clarification. If the request contains unsupported conditions, set unsupported=true. When a boolean is unspecified use false. Return a short title. Never calculate checkout.' }, { role: 'user', content: text }],
      text: { format: { type: 'json_schema', name: 'promotion_interpretation', strict: true, schema: aiSchema } }
    });
    const parsed = JSON.parse(response.output_text);
    if (parsed.unsupported || parsed.clarification) return res.json({ proposal: null, clarification: parsed.clarification || 'This promotion includes unsupported conditions.', unsupported: true });
    const { title, percentOff, minimumEligibleCents, maximumDiscountCents, newCustomersOnly, excludeSaleItems } = parsed;
    const policy = policySchema.parse({ title, percentOff, minimumEligibleCents, maximumDiscountCents, newCustomersOnly, excludeSaleItems });
    res.json({ proposal: policy, clarification: '', unsupported: false });
  } catch (error) { respondError(res, error, 502); }
});

app.post('/api/confirm', (req, res) => {
  try { const input = z.object({ sourceText: z.string(), policy: policySchema }).strict().parse(req.body); res.json({ candidate: confirm(input.sourceText, input.policy) }); }
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
app.post('/api/verify', (_req, res) => {
  try { launchVerification(); res.status(202).json({ started: true }); }
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
  if (!pack || !pack.startsWith(path.resolve('requirements/.testmuai/evidence') + path.sep) || !existsSync(pack)) return respondError(res, new Error('No Kane evidence pack is available'), 404);
  res.download(pack);
});

const port = Number(process.env.PORT || 4173);
if (process.env.NODE_ENV === 'production') app.use(express.static(path.resolve('dist')));
else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.listen(port, '127.0.0.1', () => console.log(`LaunchGate running at http://127.0.0.1:${port}`));
