import { money, policySchema, type Policy } from './promotion.js';

export type NumberDraft = { percentOff: string; minimum: string; cap: string };
export function numberDraft(policy: Policy): NumberDraft {
  return { percentOff: String(policy.percentOff), minimum: (policy.minimumEligibleCents / 100).toFixed(2), cap: (policy.maximumDiscountCents / 100).toFixed(2) };
}
function cents(value: string) {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value.trim())) return NaN;
  const [whole, fraction = ''] = value.trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function reviewDraft(policy: Policy, values: NumberDraft): { policy: Policy | null; errors: Record<string, string> } {
  const proposed = { ...policy, percentOff: /^\d+$/.test(values.percentOff) ? Number(values.percentOff) : NaN, minimumEligibleCents: cents(values.minimum), maximumDiscountCents: cents(values.cap) };
  const result = policySchema.safeParse(proposed);
  if (result.success) return { policy: result.data, errors: {} };
  const labels: Record<string, string> = {
    title: 'Enter a campaign name between 1 and 80 characters.',
    percentOff: 'Enter a whole-number discount from 1% to 100%.',
    minimumEligibleCents: 'Enter a minimum from $0 to $10,000, with at most two decimal places.',
    maximumDiscountCents: 'Enter a savings cap from $0.01 to $10,000, with at most two decimal places.',
  };
  return { policy: null, errors: Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), labels[String(issue.path[0])] || issue.message])) };
}
export function policySummary(policy: Policy) {
  return `${policy.newCustomersOnly ? 'New customers' : 'All customers'} receive ${policy.percentOff}% off ${policy.excludeSaleItems ? 'non-sale merchandise' : 'all merchandise'} when eligible items total at least ${money(policy.minimumEligibleCents)}, with savings capped at ${money(policy.maximumDiscountCents)}.`;
}
export function merchantStep(input: { hasCandidate: boolean; draftChanged: boolean; preparation?: string; suiteReady: boolean; running: boolean; canActivate: boolean; active: boolean }) {
  if (!input.hasCandidate) return { step: 1, title: 'Define your promotion', detail: 'Describe your offer or enter its details, then review and confirm the policy.', target: 'campaign-studio' };
  if (input.draftChanged) return { step: 1, title: 'Review your promotion', detail: 'Check the offer details, then confirm the version you want to test.', target: 'campaign-studio' };
  if (input.running) return { step: 3, title: 'Your checkout is being tested', detail: 'Keep the app open. Results will appear as each check finishes.', target: 'launch-gate' };
  if (input.preparation === 'generating') return { step: 2, title: 'Preparing your checks', detail: 'This can take several minutes. Any questions will appear here.', target: 'campaign-tests' };
  if (input.preparation === 'paused' || input.preparation === 'needs-input') return { step: 2, title: 'One more detail is needed', detail: 'Answer the question below to continue preparing your checks.', target: 'campaign-tests' };
  if (input.preparation === 'failed') return { step: 2, title: 'Resume test preparation', detail: 'Use the recovery controls below; no terminal or file editing is needed.', target: 'campaign-tests' };
  if (input.active && input.canActivate) return { step: 4, title: 'Your promotion is active', detail: 'View the active store, or draft a new revision without replacing this offer.', target: 'storefront-lab' };
  if (input.canActivate) return { step: 4, title: 'Ready for your launch decision', detail: 'The required checks passed. Activate this verified revision when you are ready.', target: 'launch-gate' };
  if (input.suiteReady) return { step: 3, title: 'Run your reviewed checks', detail: 'Start verification to test the customer checkout in a real browser.', target: 'launch-gate' };
  return { step: 2, title: input.preparation ? 'Review your campaign checks' : 'Prepare checks for your campaign', detail: input.preparation ? 'Review the customer situations and expected outcomes before approving them.' : 'Generate checks from the confirmed offer. Nothing runs or launches automatically.', target: 'campaign-tests' };
}
