import { compareOrderUnitPrice, type SwapOrder } from './asset-marketplace';

const UNSIGNED_INTEGER = /^(?:0|[1-9]\d*)$/;
const HUMAN_AMOUNT = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/;
const MAX_MATCH_ORDERS = 10_000;

export type OrderFill = {
  sourceOrder: SwapOrder;
  order: SwapOrder;
  partial: boolean;
};

export type OrderFillMatch = {
  fills: OrderFill[];
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

/** Fill a requested amount from the cheapest open orders, slicing only the
 * final order when necessary. Integer economic terms use the device's exact
 * seller-favouring ceiling, so the quote is also the amount paid on-chain. */
export function matchOrderFills(orders: Iterable<SwapOrder>, requestedQuantity: string): OrderFillMatch | null {
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
  const availableQuantity = available.reduce((total, order) => total + BigInt(order.quantity), 0n);
  if (availableQuantity < target) return null;

  const fills: OrderFill[] = [];
  let remaining = target;
  for (const sourceOrder of available) {
    if (remaining === 0n) break;
    const sourceQuantity = BigInt(sourceOrder.quantity);
    const fillQuantity = remaining < sourceQuantity ? remaining : sourceQuantity;
    fills.push({
      sourceOrder,
      order: filledOrder(sourceOrder, fillQuantity.toString()),
      partial: fillQuantity < sourceQuantity,
    });
    remaining -= fillQuantity;
  }
  return {
    fills,
    quantity: requestedQuantity,
    totalAsking: fills.reduce((total, fill) => total + BigInt(fill.order.asking), 0n).toString(),
  };
}

export function filledOrder(order: SwapOrder, fillQuantity: string): SwapOrder {
  if (!UNSIGNED_INTEGER.test(fillQuantity)) throw new TypeError('invalid-requested-quantity');
  const part = BigInt(fillQuantity);
  const whole = BigInt(order.quantity);
  if (part < 1n || part > whole) throw new RangeError('fill-quantity-out-of-range');
  const share = (value: string) => ((BigInt(value) * part + whole - 1n) / whole).toString();
  return {
    ...order,
    quantity: fillQuantity,
    asking: share(order.asking),
    minimumFee: share(order.minimumFee),
    deposit: share(order.deposit),
  };
}

function assertDenomination(denomination: number): void {
  if (!Number.isSafeInteger(denomination) || denomination < 0 || denomination > 255) {
    throw new TypeError('invalid-token-denomination');
  }
}
