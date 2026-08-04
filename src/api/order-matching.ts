import { compareOrderUnitPrice, type SwapOrder } from './asset-marketplace';

const UNSIGNED_INTEGER = /^(?:0|[1-9]\d*)$/;
const HUMAN_AMOUNT = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/;
const MAX_MATCH_ORDERS = 512;
const MAX_MATCH_STATES = 8192;

export type WholeOrderMatch = {
  orders: SwapOrder[];
  quantity: string;
  totalAsking: string;
};

/** Parse a human token amount into atomic units without using floating point. */
export function parseTokenAmount(value: string, denomination: number): string {
  assertDenomination(denomination);
  const normalized = value.trim();
  const match = HUMAN_AMOUNT.exec(normalized);
  if (!match) throw new TypeError('invalid-token-amount');
  const fraction = match[1] ?? '';
  if (fraction.length > denomination) throw new TypeError('token-amount-exceeds-denomination');

  const [whole] = normalized.split('.');
  const scale = 10n ** BigInt(denomination);
  return (
    BigInt(whole) * scale +
    BigInt((fraction + '0'.repeat(denomination)).slice(0, denomination) || '0')
  ).toString();
}

/** Format atomic units exactly, omitting insignificant trailing fractional zeroes. */
export function formatTokenAmount(value: string, denomination: number): string {
  assertDenomination(denomination);
  if (!UNSIGNED_INTEGER.test(value)) throw new TypeError('invalid-atomic-token-amount');
  if (denomination === 0) return value;

  const padded = value.padStart(denomination + 1, '0');
  const whole = padded.slice(0, -denomination);
  const fraction = padded.slice(-denomination).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

/**
 * Select complete open orders whose quantities exactly fill the requested
 * atomic amount. The chosen set has the lowest total asking amount; ties
 * prefer the earlier entries in exact unit-price order.
 */
export function matchWholeOrders(orders: Iterable<SwapOrder>, requestedQuantity: string): WholeOrderMatch | null {
  if (!UNSIGNED_INTEGER.test(requestedQuantity) || BigInt(requestedQuantity) < 1n) {
    throw new TypeError('invalid-requested-quantity');
  }

  const target = BigInt(requestedQuantity);
  const available: SwapOrder[] = [];
  for (const order of orders) {
    if (order.status !== 'open') continue;
    if (available.length === MAX_MATCH_ORDERS) throw new RangeError('order-match-search-limit');
    available.push(order);
  }
  available.sort(compareOrderUnitPrice);
  type Candidate = { indexes: number[]; asking: bigint };
  const candidates = new Map<bigint, Candidate>([[0n, { indexes: [], asking: 0n }]]);

  for (const [index, order] of available.entries()) {
    const quantity = BigInt(order.quantity);
    const asking = BigInt(order.asking);
    for (const [heldQuantity, held] of [...candidates.entries()]) {
      const nextQuantity = heldQuantity + quantity;
      if (nextQuantity > target) continue;
      const candidate = { indexes: [...held.indexes, index], asking: held.asking + asking };
      const current = candidates.get(nextQuantity);
      if (!current || compareCandidate(candidate, current) < 0) {
        if (!current && candidates.size >= MAX_MATCH_STATES) {
          throw new RangeError('order-match-search-limit');
        }
        candidates.set(nextQuantity, candidate);
      }
    }
  }

  const match = candidates.get(target);
  if (!match) return null;
  return {
    orders: match.indexes.map((index) => available[index]),
    quantity: requestedQuantity,
    totalAsking: match.asking.toString(),
  };
}

function compareCandidate(
  left: { indexes: number[]; asking: bigint },
  right: { indexes: number[]; asking: bigint },
): number {
  if (left.asking !== right.asking) return left.asking < right.asking ? -1 : 1;
  const length = Math.min(left.indexes.length, right.indexes.length);
  for (let index = 0; index < length; index += 1) {
    if (left.indexes[index] !== right.indexes[index]) {
      return left.indexes[index] - right.indexes[index];
    }
  }
  return left.indexes.length - right.indexes.length;
}

function assertDenomination(denomination: number): void {
  if (!Number.isSafeInteger(denomination) || denomination < 0 || denomination > 255) {
    throw new TypeError('invalid-token-denomination');
  }
}
