import { catalog, money, type Policy } from './promotion.js';

export function unsupportedRequest(text: string): string | null {
  const conditions: [RegExp, string][] = [
    [/\b(shipping|delivery|freight)\b/i, 'shipping or delivery changes'],
    [/\b(bogo|buy\s+\w+\s+get|free\s+(gift|item)|bundle)\b/i, 'buy-one-get-one offers, gifts or bundles'],
    [/\b(tax|vat|gst|cashback|loyalty|points|subscription)\b/i, 'tax, rewards or subscription rules'],
    [/\b(starting|expires?|expiry|weekends?|tomorrow|today|next week|until|valid from)\b/i, 'scheduled dates or times'],
  ];
  const found = conditions.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  return found.length ? `This demo cannot implement ${found.join('; ')}. Remove those conditions or choose a supported percentage promotion. No replacement policy has been confirmed.` : null;
}

export function campaignLimits(policy: Policy): { blocking: string[]; notes: string[] } {
  const eligible = catalog.filter(p => !policy.excludeSaleItems || !p.onSale);
  const max = eligible.reduce((total, p) => total + p.priceCents * 20, 0);
  const blocking: string[] = [], notes: string[] = [];
  if (policy.minimumEligibleCents > max) blocking.push(`No shopper can reach this minimum with the demo catalog. Its maximum eligible cart is ${money(max)}. Lower the minimum or use a larger catalog.`);
  if (Math.floor((max * policy.percentOff + 50) / 100) < policy.maximumDiscountCents) notes.push('The discount cap is above every reachable discount in this demo catalog. Tests can check normal savings, but cannot demonstrate the cap taking effect.');
  let reachable = new Set([0]);
  for (const product of eligible) {
    const next = new Set<number>();
    for (const subtotal of reachable) for (let count = 0; count <= 20; count++) next.add(subtotal + count * product.priceCents);
    reachable = next;
  }
  if (!reachable.has(policy.minimumEligibleCents)) notes.push('The catalog cannot form a cart at the exact minimum. Kane should check the nearest reachable carts on each side and disclose this boundary gap.');
  return { blocking, notes };
}
