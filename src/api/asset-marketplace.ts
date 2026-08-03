export type SwapOrderStatus = 'open' | 'reserved' | 'settled' | 'cancelled' | 'expired';

export type SwapOrder = {
  orderId: string;
  creator: string;
  recipient: string;
  asking: string;
  deposit: string;
  minimumFee: string;
  deadline: number;
  createdAt: number;
  quantity: number;
  status: SwapOrderStatus;
  buyer?: string;
  reservedUntil?: number;
  paymentTx?: string;
};

export type AssetState = {
  device: string;
  name: string;
  totalSupply: number;
  balances: Record<string, string>;
  orders: Record<string, SwapOrder>;
  swapHeight: number;
  value: unknown;
  raw: Record<string, unknown>;
};

export type ComputeResult = {
  state: AssetState;
  provider: string;
};

export type ComputeRetryProgress = {
  attempt: number;
  total: number;
  delayMs: number;
};

export type LicenseProperty = {
  key: string;
  label: string;
  value: string;
};

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const UNSIGNED_INTEGER = /^(?:0|[1-9]\d*)$/;
const LIVE_ORDER = new Set<SwapOrderStatus>(['open', 'reserved']);
const ASSET_PROCESS_DEVICES = new Set(['carrier@1.0', 'name-token@1.0', 'token@1.0']);
const COMPUTE_TIMEOUT = 12_000;
const COMPUTE_RETRY_BASE_DELAY = 1_000;
const COMPUTE_RETRY_MAX_DELAY = 8_000;
const LICENSE_FIELDS = [
  ['license', 'License'],
  ['access', 'Access'],
  ['access-fee', 'Access fee'],
  ['derivation', 'Derivatives'],
  ['derivation-fee', 'Derivative fee'],
  ['commercial-use', 'Commercial use'],
  ['commercial-use-fee', 'Commercial fee'],
  ['data-model-training', 'Model training'],
  ['payment-mode', 'Payment mode'],
  ['payment-address', 'Payment address'],
  ['currency', 'Currency'],
] as const;

function isLocalhostHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '::1' ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized)
  );
}

function isValidServingNodeHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.includes(':')) return true;

  const labels = normalized.replace(/\.$/, '').split('.');
  return labels.length >= 2 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

export function servingNodeFromHostname(hostname: string): string {
  if (isLocalhostHostname(hostname)) return 'arweave.net';
  if (!hostname || hostname.includes(':') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return hostname;
  }

  const labels = hostname.split('.');
  return labels[0]?.length === 52 && /^[A-Za-z0-9_-]+$/.test(labels[0]) && labels.length > 2
    ? labels.slice(1).join('.')
    : hostname;
}

export function normalizeServingNodeOrigin(value: string, defaultProtocol = 'https:'): string | null {
  const requestedNode = value.trim();
  if (!requestedNode || /\s/.test(requestedNode)) return null;

  try {
    const url = new URL(requestedNode.includes('://') ? requestedNode : `${defaultProtocol}//${requestedNode}`);
    return (url.protocol === 'http:' || url.protocol === 'https:') && isValidServingNodeHostname(url.hostname)
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function servingNodeOrigin(location: {
  protocol: string;
  hostname: string;
  port?: string;
  search?: string;
  hash?: string;
}): string {
  const hashQueryIndex = location.hash?.indexOf('?') ?? -1;
  const hashSearch = hashQueryIndex === -1 ? '' : location.hash?.slice(hashQueryIndex);
  const requestedNode = (
    new URLSearchParams(location.search ?? '').get('node') ?? new URLSearchParams(hashSearch).get('node')
  )?.trim();
  if (requestedNode) {
    const origin = normalizeServingNodeOrigin(requestedNode, location.protocol);
    if (origin) return origin;
  }

  if (isLocalhostHostname(location.hostname)) return 'https://arweave.net';
  const port = location.port ? `:${location.port}` : '';
  return `${location.protocol}//${servingNodeFromHostname(location.hostname)}${port}`;
}

function currentServingNode(): string {
  return typeof window !== 'undefined' && ['http:', 'https:'].includes(window.location.protocol)
    ? servingNodeOrigin(window.location)
    : '';
}

export async function readAssetState(
  processId: string,
  options: {
    fetch?: typeof fetch;
    signal?: AbortSignal;
    maxAttempts?: number;
    retryBaseDelay?: number;
    onRetry?: (progress: ComputeRetryProgress) => void;
  } = {},
): Promise<ComputeResult> {
  if (!ADDRESS.test(processId)) throw new TypeError('invalid-asset-process-id');
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const provider = currentServingNode();
  const state = await readState(processId, provider, fetcher, options);
  return { state, provider };
}

export async function waitForAssetState(
  processId: string,
  accept: (state: AssetState) => boolean | Promise<boolean>,
  options: {
    fetch?: typeof fetch;
    signal?: AbortSignal;
    interval?: number;
    timeout?: number;
    onAttempt?: (provider: string, attempt: number, total: number) => void;
  } = {},
): Promise<ComputeResult> {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const startedAt = Date.now();
  const timeout = options.timeout ?? 180_000;
  let attempt = 0;

  while (timeout <= 0 || Date.now() - startedAt < timeout) {
    if (options.signal?.aborted) throw options.signal.reason;
    attempt += 1;
    options.onAttempt?.(currentServingNode(), attempt, 1);
    try {
      const result = await readAssetState(processId, { fetch: fetcher, signal: options.signal });
      if (await accept(result.state)) return result;
    } catch (error) {
      if (options.signal?.aborted) throw error;
    }
    await delay(options.interval ?? 4000, options.signal);
  }

  throw new Error('asset-state-timeout');
}

export function parseAssetState(value: unknown): AssetState {
  const raw = unwrapState(value);
  const device = text(raw['execution-device'] ?? raw.device);
  const totalSupply = integer(raw['total-supply']);
  const balances = stringRecord(raw.balances);
  if (!ASSET_PROCESS_DEVICES.has(device) || totalSupply !== 1 || !balances) {
    throw new TypeError('invalid-asset-state');
  }

  const orders: Record<string, SwapOrder> = {};
  if (isRecord(raw.orders)) {
    for (const [id, held] of Object.entries(raw.orders)) {
      const order = parseSwapOrder(id, held);
      if (order) orders[id] = order;
    }
  }

  return {
    device,
    name: text(raw.name),
    totalSupply,
    balances,
    orders,
    swapHeight: integer(raw['swap-height']) ?? 0,
    value: raw.value ?? raw['initial-value'],
    raw,
  };
}

export function parseSwapOrder(id: string, value: unknown): SwapOrder | null {
  if (!ADDRESS.test(id) || !isRecord(value)) return null;
  const orderId = text(value['order-id']);
  const creator = text(value.creator);
  const recipient = text(value.recipient);
  const asking = amount(value.asking);
  const deposit = amount(value.deposit) ?? '0';
  const minimumFee = amount(value['minimum-fee']) ?? '0';
  const deadline = integer(value.deadline);
  const createdAt = integer(value['created-at']) ?? 0;
  const quantity = integer(value.quantity);
  const status = text(value.status) as SwapOrderStatus;

  if (
    orderId !== id ||
    !ADDRESS.test(creator) ||
    !ADDRESS.test(recipient) ||
    asking === null ||
    BigInt(asking) < 1n ||
    deadline === null ||
    quantity === null ||
    !['open', 'reserved', 'settled', 'cancelled', 'expired'].includes(status)
  ) {
    return null;
  }

  const buyer = text(value.buyer);
  const reservedUntil = integer(value['reserved-until']);
  const paymentTx = text(value['payment-tx']);

  return {
    orderId,
    creator,
    recipient,
    asking,
    deposit,
    minimumFee,
    deadline,
    createdAt,
    quantity,
    status,
    ...(ADDRESS.test(buyer) ? { buyer } : {}),
    ...(reservedUntil === null ? {} : { reservedUntil }),
    ...(ADDRESS.test(paymentTx) ? { paymentTx } : {}),
  };
}

export function ownerOfAsset(state: AssetState): string | null {
  const holder = Object.entries(state.balances).find(([, balance]) => balance === '1');
  if (holder && ADDRESS.test(holder[0])) return holder[0];
  const escrowed = Object.values(state.orders).find((order) => LIVE_ORDER.has(order.status) && order.quantity === 1);
  return escrowed?.creator ?? null;
}

export function liveOrderOfAsset(state: AssetState): SwapOrder | null {
  return Object.values(state.orders).find((order) => LIVE_ORDER.has(order.status) && order.quantity === 1) ?? null;
}

export function licenseProperties(state: AssetState): LicenseProperty[] {
  const normalized = new Map(
    Object.entries(state.raw).map(([key, value]) => [key.toLowerCase().replaceAll('_', '-'), value]),
  );
  return LICENSE_FIELDS.flatMap(([key, label]) => {
    const held = normalized.get(key);
    if (!['string', 'number', 'boolean'].includes(typeof held)) return [];
    const raw = String(held);
    const value =
      key === 'license' && raw === 'dE0rmDfl9_OWjkDznNEXHaSO_JohJkRolvMzaCroUdw' ? 'Universal Data License' : raw;
    return [{ key, label, value }];
  });
}

async function readState(
  processId: string,
  servingNode: string,
  fetcher: typeof fetch,
  options: {
    signal?: AbortSignal;
    maxAttempts?: number;
    retryBaseDelay?: number;
    onRetry?: (progress: ComputeRetryProgress) => void;
  },
): Promise<AssetState> {
  const base = servingNode ? `${servingNode}/` : '/';
  const paths = [
    `${base}${processId}~process@1.0/now&max-age=60?require-codec=json%401.0&accept-bundle=true`,
    `${base}${processId}~process@1.0/now?require-codec=application%2Fjson&accept-bundle=true`,
  ];
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 1));
  const retryBaseDelay = Math.max(0, options.retryBaseDelay ?? COMPUTE_RETRY_BASE_DELAY);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (const path of paths) {
      const request = timeoutSignal(options.signal, COMPUTE_TIMEOUT);
      try {
        const response = await fetcher(path, {
          headers: {
            accept: 'application/json',
            'require-codec': 'application/json',
            'accept-bundle': 'true',
          },
          signal: request.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return parseAssetState(await response.json());
      } catch (error) {
        lastError = error;
      } finally {
        request.cleanup();
      }
    }

    if (options.signal?.aborted || attempt === maxAttempts) break;
    const delayMs = Math.min(retryBaseDelay * 2 ** (attempt - 1), COMPUTE_RETRY_MAX_DELAY);
    options.onRetry?.({ attempt: attempt + 1, total: maxAttempts, delayMs });
    await delay(delayMs, options.signal);
  }

  throw lastError instanceof Error ? lastError : new Error('compute-provider-failed');
}

function unwrapState(value: unknown): Record<string, unknown> {
  let held = value;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof held === 'string') {
      held = JSON.parse(held);
      continue;
    }
    if (isRecord(held) && Object.keys(held).length <= 4 && 'body' in held) {
      held = held.body;
      continue;
    }
    break;
  }
  if (!isRecord(held)) throw new TypeError('invalid-asset-state');
  return held;
}

function stringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, string> = {};
  for (const [key, held] of Object.entries(value)) {
    const parsed = amount(held);
    if (parsed !== null) result[key] = parsed;
  }
  return result;
}

function amount(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  if (typeof value !== 'string' || !UNSIGNED_INTEGER.test(value)) return null;
  return value;
}

function integer(value: unknown): number | null {
  const held = amount(value);
  if (held === null) return null;
  const parsed = Number(held);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function timeoutSignal(parent: AbortSignal | undefined, timeout: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  if (parent?.aborted) abort();
  else parent?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('compute-provider-timeout')), timeout);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', abort);
    },
  };
}

function delay(duration: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => {
      if (timer) clearTimeout(timer);
      cleanup();
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, duration);
  });
}
