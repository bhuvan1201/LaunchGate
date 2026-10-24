import { z } from 'zod';

export const policySchema = z.object({
  title: z.string().trim().min(1).max(80),
  percentOff: z.number().int().min(1).max(100),
  minimumEligibleCents: z.number().int().min(0).max(1000000),
  maximumDiscountCents: z.number().int().min(1).max(1000000),
  newCustomersOnly: z.boolean(),
  excludeSaleItems: z.boolean(),
}).strict();
export type Policy = z.infer<typeof policySchema>;

export const catalog = [
  { id: 'tote', name: 'Canvas Tote', priceCents: 2400, onSale: false, icon: '◒' },
  { id: 'mug', name: 'Ceramic Mug', priceCents: 1800, onSale: false, icon: '◡' },
  { id: 'hoodie', name: 'Weekend Hoodie', priceCents: 5800, onSale: false, icon: '⌁' },
  { id: 'cap', name: 'Sale Cap', priceCents: 1500, onSale: true, icon: '⌒' },
] as const;

export const cartSchema = z.object({
  quantities: z.record(z.string(), z.number().int().min(0).max(20)),
  customerType: z.enum(['new', 'returning']),
}).strict();
export type Cart = z.infer<typeof cartSchema>;

export function calculateDiscountCents(eligibleSubtotalCents: number, percentOff: number, maximumDiscountCents: number) {
  return Math.min(Math.floor((eligibleSubtotalCents * percentOff + 50) / 100), maximumDiscountCents, eligibleSubtotalCents);
}

export function quote(cartInput: unknown, policyInput?: unknown) {
  const cart = cartSchema.parse(cartInput);
  const ids = new Set(catalog.map(item => item.id));
  for (const id of Object.keys(cart.quantities)) if (!ids.has(id as typeof catalog[number]['id'])) throw new Error(`Unknown product: ${id}`);
  const policy = policyInput == null ? null : policySchema.parse(policyInput);
  const subtotalCents = catalog.reduce((sum, item) => sum + item.priceCents * (cart.quantities[item.id] ?? 0), 0);
  const eligibleSubtotalCents = policy ? catalog.reduce((sum, item) => sum + (!policy.excludeSaleItems || !item.onSale ? item.priceCents * (cart.quantities[item.id] ?? 0) : 0), 0) : 0;
  let reason = 'No active promotion';
  let discountCents = 0;
  if (policy) {
    if (policy.newCustomersOnly && cart.customerType !== 'new') reason = 'Returning customers are not eligible';
    else if (eligibleSubtotalCents < policy.minimumEligibleCents) reason = 'Eligible subtotal is below the minimum';
    else {
      discountCents = calculateDiscountCents(eligibleSubtotalCents, policy.percentOff, policy.maximumDiscountCents);
      reason = discountCents > 0 ? 'Promotion applied' : 'No eligible items';
    }
  }
  return { subtotalCents, eligibleSubtotalCents, discountCents, totalCents: subtotalCents - discountCents, reason };
}

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
