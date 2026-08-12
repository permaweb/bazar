import { liquidBalanceOf, readAssetState, waitForAssetState } from './asset-marketplace';
import { AssetTransactionClient, SIGNED_TRANSACTION_PREFIX } from './asset-transactions';
import { parseTokenAmount } from './order-matching';

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const QUANTITY = /^[1-9]\d*$/;

export const DISPATCH_PLAN_PREFIX = 'bazar-fungible-dispatch:';
export const DEFAULT_DISPATCH_BATCH_SIZE = 100;
/**
 * Above this total (0.1 AR) the UI must collect an explicit confirmation
 * before anything is signed. A fungible L1 transfer really spends its token
 * amount in winston (the protocol quantity shadows the quantity tag at fold
 * time — see AssetTransactionClient.transferFungible), so large dispatches
 * have real AR cost: 1 AR per 1e12 atomic units per transfer, plus rewards.
 */
export const DISPATCH_COST_CONFIRMATION_WINSTON = 100_000_000_000n;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type HolderRow = { address: string; quantity: string };

export type ParsedHolderList = { rows: HolderRow[]; errors: string[] };

export type DispatchRowStatus = 'unsent' | 'posted' | 'settled';

export type DispatchRow = HolderRow & { status: DispatchRowStatus; transactionId?: string };

export type DispatchPlan = {
	processId: string;
	sender: string;
	createdAt: number;
	/**
	 * Recipient balances read once, before the first transfer was signed.
	 * Settlement for a row means: live balance >= baseline + quantity.
	 * NEVER recapture on resume — a baseline taken after partial sends would
	 * count settled transfers into itself and the progress UI would lie.
	 */
	baseline: Record<string, string>;
	rows: DispatchRow[];
};

/**
 * Parse a pasted holder list. Accepted shapes:
 * - JSON: [{ "address": "...", "quantity": "10" }, ...]
 * - JSON: [["address", "10"], ...]
 * - JSON: { "address": "10", ... }
 * - CSV: one `address,quantity` per line; lines starting with # are comments.
 * Quantities are human token amounts. Decimal JSON quantities must be strings
 * so they never pass through floating point. Returned rows contain atomic
 * integer quantities ready for protocol balance checks and transactions.
 */
export function parseHolderList(text: string, denomination: number): ParsedHolderList {
	// Validate the process precision once even when the pasted list is empty.
	parseTokenAmount('1', denomination);
	const trimmed = text.trim();
	if (!trimmed) return { rows: [], errors: ['The holder list is empty.'] };
	const result = /^[[{]/.test(trimmed)
		? parseJsonHolders(trimmed, denomination)
		: parseCsvHolders(trimmed, denomination);
	if (result.errors.length) return { rows: [], errors: result.errors };
	const duplicates = [...new Set(result.rows.map((row) => row.address).filter(duplicated(result.rows)))];
	if (duplicates.length) {
		return {
			rows: [],
			errors: [
				`Duplicate address${duplicates.length === 1 ? '' : 'es'} — merge into one row each: ${duplicates.join(
					', '
				)}`,
			],
		};
	}
	if (!result.rows.length) return { rows: [], errors: ['The holder list contains no entries.'] };
	return result;
}

function duplicated(rows: HolderRow[]): (address: string) => boolean {
	const counts = new Map<string, number>();
	for (const row of rows) counts.set(row.address, (counts.get(row.address) ?? 0) + 1);
	return (address) => (counts.get(address) ?? 0) > 1;
}

function parseJsonHolders(text: string, denomination: number): ParsedHolderList {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return {
			rows: [],
			errors: ['Invalid JSON. Paste [{"address","quantity"}], [[address, quantity]], or {address: quantity}.'],
		};
	}
	const rows: HolderRow[] = [];
	const errors: string[] = [];
	if (Array.isArray(parsed)) {
		parsed.forEach((entry, index) => {
			const label = `Entry ${index + 1}`;
			if (Array.isArray(entry) && entry.length === 2) {
				collectRow(rows, errors, label, entry[0], entry[1], denomination);
			} else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
				const record = entry as Record<string, unknown>;
				collectRow(rows, errors, label, record.address, record.quantity, denomination);
			} else {
				errors.push(`${label}: expected {"address","quantity"} or [address, quantity].`);
			}
		});
	} else if (parsed && typeof parsed === 'object') {
		Object.entries(parsed as Record<string, unknown>).forEach(([address, quantity], index) => {
			collectRow(rows, errors, `Entry ${index + 1}`, address, quantity, denomination);
		});
	} else {
		errors.push('Expected a JSON array or object of address/quantity pairs.');
	}
	return { rows, errors };
}

function parseCsvHolders(text: string, denomination: number): ParsedHolderList {
	const rows: HolderRow[] = [];
	const errors: string[] = [];
	text.split(/\r?\n/).forEach((line, index) => {
		const content = line.trim();
		if (!content || content.startsWith('#')) return;
		const fields = content.split(',').map((field) => field.trim());
		if (fields.length !== 2) {
			errors.push(`Line ${index + 1}: expected "address,quantity".`);
			return;
		}
		collectRow(rows, errors, `Line ${index + 1}`, fields[0], fields[1], denomination);
	});
	return { rows, errors };
}

function collectRow(
	rows: HolderRow[],
	errors: string[],
	label: string,
	address: unknown,
	quantity: unknown,
	denomination: number
): void {
	if (typeof address !== 'string' || !ADDRESS.test(address)) {
		errors.push(`${label}: "${String(address).slice(0, 60)}" is not a 43-character Arweave address.`);
		return;
	}
	const humanAmount =
		typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity > 0
			? String(quantity)
			: typeof quantity === 'string'
			? quantity.trim()
			: '';
	let atomicAmount: string;
	try {
		atomicAmount = parseTokenAmount(humanAmount, denomination);
		if (BigInt(atomicAmount) < 1n) throw new TypeError('invalid-token-amount');
	} catch {
		errors.push(
			`${label}: quantity must be a positive token amount${
				denomination ? ` with no more than ${denomination} decimal places` : ' in whole tokens'
			}. Use a JSON string for fractional quantities.`
		);
		return;
	}
	rows.push({ address, quantity: atomicAmount });
}

export function planTotals(rows: ReadonlyArray<HolderRow>): { count: number; totalQuantity: bigint } {
	return {
		count: rows.length,
		totalQuantity: rows.reduce((total, row) => total + BigInt(row.quantity), 0n),
	};
}

export type DispatchCostEstimate = {
	totalQuantity: bigint;
	totalReward: bigint;
	/** What the sender's AR balance really pays: atomic token units (in winston) + rewards. */
	totalWinston: bigint;
};

export function estimateDispatchCost(rows: ReadonlyArray<HolderRow>, perTransferReward: bigint): DispatchCostEstimate {
	const { totalQuantity } = planTotals(rows);
	const totalReward = perTransferReward * BigInt(rows.length);
	return { totalQuantity, totalReward, totalWinston: totalQuantity + totalReward };
}

export function requiresCostConfirmation(totalWinston: bigint): boolean {
	return totalWinston > DISPATCH_COST_CONFIRMATION_WINSTON;
}

/** Network reward for one 0-byte transfer to the token process. */
export async function fetchTransferReward(
	gateway: string,
	processId: string,
	fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
	signal?: AbortSignal
): Promise<bigint> {
	if (!ADDRESS.test(processId)) throw new TypeError('invalid-asset-process-id');
	const response = await fetchFn(`${gateway}/price/0/${processId}`, { signal });
	if (!response.ok) throw new Error(`transfer-price-${response.status}`);
	const value = (await response.text()).trim();
	if (!/^\d+$/.test(value)) throw new Error('transfer-price-invalid');
	return BigInt(value);
}

export function loadDispatchPlan(
	processId: string,
	storage: StorageLike | undefined = globalThis.window?.localStorage
): DispatchPlan | null {
	if (!ADDRESS.test(processId) || !storage) return null;
	try {
		const plan = JSON.parse(storage.getItem(`${DISPATCH_PLAN_PREFIX}${processId}`) ?? 'null');
		return isDispatchPlan(plan) && plan.processId === processId ? plan : null;
	} catch {
		return null;
	}
}

export function saveDispatchPlan(
	plan: DispatchPlan,
	storage: StorageLike | undefined = globalThis.window?.localStorage
): void {
	if (!isDispatchPlan(plan)) throw new TypeError('invalid-dispatch-plan');
	storage?.setItem(`${DISPATCH_PLAN_PREFIX}${plan.processId}`, JSON.stringify(plan));
}

export function discardDispatchPlan(
	processId: string,
	storage: StorageLike | undefined = globalThis.window?.localStorage
): void {
	if (!ADDRESS.test(processId) || !storage) return;
	const plan = loadDispatchPlan(processId, storage);
	for (const row of plan?.rows ?? []) {
		if (row.transactionId) storage.removeItem(`${SIGNED_TRANSACTION_PREFIX}${row.transactionId}`);
	}
	storage.removeItem(`${DISPATCH_PLAN_PREFIX}${processId}`);
}

export function isDispatchPlan(value: unknown): value is DispatchPlan {
	if (!value || typeof value !== 'object') return false;
	const plan = value as DispatchPlan;
	return (
		ADDRESS.test(plan.processId) &&
		ADDRESS.test(plan.sender) &&
		Number.isSafeInteger(plan.createdAt) &&
		Boolean(plan.baseline) &&
		typeof plan.baseline === 'object' &&
		!Array.isArray(plan.baseline) &&
		Object.values(plan.baseline).every((balance) => typeof balance === 'string' && /^\d+$/.test(balance)) &&
		Array.isArray(plan.rows) &&
		plan.rows.length > 0 &&
		plan.rows.every(
			(row) =>
				ADDRESS.test(row.address) &&
				QUANTITY.test(row.quantity) &&
				['unsent', 'posted', 'settled'].includes(row.status) &&
				(row.transactionId === undefined || ADDRESS.test(row.transactionId)) &&
				row.address in plan.baseline
		)
	);
}

/**
 * Capture recipient baselines and pre-flight the sender's token balance.
 * Requires readable process state: a freshly published token has none until
 * the arweave-scheduler sequences its creation (~20 minutes on mainnet).
 */
export async function createDispatchPlan(
	processId: string,
	sender: string,
	rows: HolderRow[],
	options: { signal?: AbortSignal; fetch?: typeof fetch } = {}
): Promise<DispatchPlan> {
	if (!ADDRESS.test(processId)) throw new TypeError('invalid-asset-process-id');
	if (!ADDRESS.test(sender)) throw new TypeError('invalid-dispatch-sender');
	if (!rows.length) throw new TypeError('dispatch-rows-empty');
	if (rows.some((row) => row.address === sender)) {
		// Balance-rise settlement is blind to self-sends; they are also no-ops.
		throw new Error('dispatch-self-recipient');
	}
	const { state } = await readAssetState(processId, { signal: options.signal, fetch: options.fetch, maxAge: 0 });
	const { totalQuantity } = planTotals(rows);
	if (BigInt(liquidBalanceOf(state, sender)) < totalQuantity) {
		throw new Error('dispatch-insufficient-token-balance');
	}
	const baseline: Record<string, string> = {};
	for (const row of rows) baseline[row.address] = state.balances[row.address] ?? '0';
	return {
		processId,
		sender,
		createdAt: Date.now(),
		baseline,
		rows: rows.map((row) => ({ ...row, status: 'unsent' as const })),
	};
}

export type DispatchRunOptions = {
	client?: AssetTransactionClient;
	storage?: StorageLike;
	batchSize?: number;
	signal?: AbortSignal;
	/** Called with a fresh plan copy after every persisted status change. */
	onProgress?: (plan: DispatchPlan) => void;
	settlementInterval?: number;
	settlementTimeout?: number;
};

/**
 * Sign, post, and settle every pending row of a dispatch plan, in batches.
 *
 * Crash-safety contract (mirrors the SIGNED_TRANSACTION_PREFIX recovery in
 * asset-transactions.ts): each transfer is signed first (the client persists
 * the signed transaction to localStorage before returning), then the row
 * records its transaction id and the plan is saved, and only then is the
 * transaction posted. A reload at any point resumes without double-sending:
 * an unsent row with a transaction id is restored from storage and
 * re-dispatched (arweave.net answers 208 for duplicates), a posted row only
 * waits for settlement.
 *
 * Settlement is balance-based: a row is settled once its recipient's live
 * balance has risen by at least its quantity over the plan baseline.
 */
export async function runDispatch(initial: DispatchPlan, options: DispatchRunOptions = {}): Promise<DispatchPlan> {
	if (!isDispatchPlan(initial)) throw new TypeError('invalid-dispatch-plan');
	const storage = options.storage ?? globalThis.window?.localStorage;
	const client = options.client ?? new AssetTransactionClient({ storage });
	const batchSize = options.batchSize ?? DEFAULT_DISPATCH_BATCH_SIZE;
	if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new TypeError('invalid-dispatch-batch-size');
	const plan: DispatchPlan = { ...initial, rows: initial.rows.map((row) => ({ ...row })) };
	const persist = () => {
		saveDispatchPlan(plan, storage);
		options.onProgress?.({ ...plan, rows: plan.rows.map((row) => ({ ...row })) });
	};
	persist();

	const pending = () => plan.rows.filter((row) => row.status !== 'settled');
	while (pending().length) {
		options.signal?.throwIfAborted();
		const batch = pending().slice(0, batchSize);

		for (const row of batch) {
			options.signal?.throwIfAborted();
			if (row.status === 'posted') continue;
			let prepared;
			if (row.transactionId) {
				try {
					prepared = client.restore(row.transactionId, plan.sender);
				} catch {
					// The signed transaction did not survive (cleared storage on
					// another profile, or a crash before it was written). The row
					// is still unsent, so signing a fresh transaction is safe.
					prepared = undefined;
					row.transactionId = undefined;
				}
			}
			if (!prepared) {
				prepared = await client.transferFungible(
					plan.processId,
					row.address,
					row.quantity,
					plan.sender,
					options.signal
				);
				// The signed transaction is already persisted under
				// SIGNED_TRANSACTION_PREFIX; record it on the row BEFORE posting
				// so a crash between post and save cannot double-send.
				row.transactionId = prepared.id;
				persist();
			}
			// dispatch() throws on rejection; 'accepted' and 'duplicate' (208,
			// e.g. a resumed re-post of an already-seen transfer) both succeed.
			await prepared.dispatch(options.signal ?? new AbortController().signal);
			row.status = 'posted';
			persist();
		}

		// One settlement poller for the whole batch: read state once per tick
		// and settle every row whose recipient balance has risen enough.
		await waitForAssetState(
			plan.processId,
			(state) => {
				let changed = false;
				for (const row of batch) {
					if (row.status !== 'posted') continue;
					const target = BigInt(plan.baseline[row.address] ?? '0') + BigInt(row.quantity);
					if (BigInt(state.balances[row.address] ?? '0') >= target) {
						row.status = 'settled';
						if (row.transactionId) storage?.removeItem(`${SIGNED_TRANSACTION_PREFIX}${row.transactionId}`);
						changed = true;
					}
				}
				if (changed) persist();
				return batch.every((row) => row.status === 'settled');
			},
			{
				signal: options.signal,
				interval: options.settlementInterval ?? 8000,
				// The arweave-scheduler only sequences a transaction once it sits
				// ~10 blocks below the tip, so settlement takes ~20 minutes at
				// minimum. Mirror STATE_INCLUSION_TIMEOUT in asset-transactions.ts.
				timeout: options.settlementTimeout ?? 60 * 60_000,
			}
		);
	}
	return plan;
}
