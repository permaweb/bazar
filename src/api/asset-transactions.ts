import {
	type Consensus,
	type ObserverView,
	type PreparedTransaction,
	type PurchaseAdapter,
	TransactionDispatchNotSentError,
	TransactionDispatchRejectedError,
	type TxWatcher,
	type VerificationUpdate,
	type WeaveNetwork,
} from 'weave-wrangler';

import { createArweaveClient } from 'helpers/arweave';
import { setCriticalStorageItem } from 'helpers/browser-storage';
import {
	arweaveClientConfig,
	arweaveGatewayFromLocation,
	DEFAULT_COMPUTE_GATEWAYS,
	gatewaysFromLocation,
} from 'helpers/config';

import { aoFetch } from './ao';
import { currentArweaveHeight } from './arweave-height';
import {
	type AssetState,
	assetStateSlot,
	type ProcessAssignment,
	readAssetState,
	readAssetStateAtSlot,
	readProcessAssignments,
	type SwapOrder,
	waitForAssetState,
} from './asset-marketplace';
import { acquireAssetObserverNetwork } from './asset-observers';
import { filledOrder } from './order-matching';

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
export const SIGNED_TRANSACTION_PREFIX = 'bazar-signed-transaction:';
export const DEFAULT_REGISTRATION_FEE = 100_000_000n;
export const ASSET_TRANSACTION_CONFIRMATION_TARGET = 5;
/** No asset offer may exceed the maximum 66 million AR supply. */
export const MAXIMUM_ASSET_OFFER_PRICE = 66_000_000_000_000_000_000n;
const DEFAULT_OFFER_DEADLINE = 20;
const SIGNATURE_WINDOW_BLOCKS = 40;
const PRICE_REQUEST_CONCURRENCY = 8;
/**
 * The arweave-scheduler only sequences a transaction once it sits 10 blocks
 * below the network tip, so a dispatched transaction cannot affect process
 * state for ~20 minutes. State checks that gate on those effects must wait
 * comfortably past that window before declaring failure.
 */
const STATE_INCLUSION_TIMEOUT = 60 * 60_000;
/**
 * Mirrors the node's `arweave_scheduler_confirmation_depth`: a mined
 * transaction only enters a process's schedule once it sits this many blocks
 * below the network tip. Overridable for nodes configured differently.
 */
export const SCHEDULER_INCLUSION_DEPTH = Number(import.meta.env?.VITE_SCHEDULER_INCLUSION_DEPTH ?? 10);
/** Arweave's nominal block time, for turning blocks into human minutes. */
const MINUTES_PER_BLOCK = 2;

export type SequencingCountdown = { blocksRemaining: number; etaMinutes: number; fraction: number };

/**
 * How far a mined transaction is from being sequenced by the process — the
 * honest clock behind every "confirmed but nothing is happening" window.
 */
export function sequencingCountdown(
	minedHeight: number | null | undefined,
	tip: number | null | undefined,
	depth: number = SCHEDULER_INCLUSION_DEPTH
): SequencingCountdown | null {
	if (!minedHeight || !tip || !Number.isFinite(minedHeight) || !Number.isFinite(tip)) return null;
	const blocksRemaining = Math.max(0, minedHeight + depth - tip);
	return {
		blocksRemaining,
		etaMinutes: blocksRemaining * MINUTES_PER_BLOCK,
		fraction: Math.min(1, Math.max(0, (depth - blocksRemaining) / depth)),
	};
}

/** The freshest network height any observer of this transaction reported. */
export function consensusTip(
	transaction?: { views?: Array<{ observer?: { height?: number } }> } | null
): number | undefined {
	const heights = (transaction?.views ?? [])
		.map((view) => view.observer?.height)
		.filter((height): height is number => Number.isFinite(height));
	return heights.length ? Math.max(...heights) : undefined;
}
/** At most 0.01 AR may be burned as the non-refundable reservation reward. */
export const MAXIMUM_REGISTRATION_FEE = 10_000_000_000n;
export const DEFAULT_RESERVATION_INCLUSION_MARGIN = 2;

export type PurchaseCostEstimate = {
	asking: string;
	registrationFee: string;
	registrationNetworkReward: string;
	paymentNetworkReward: string;
	total: string;
};

export type FungibleTransferBaseline = {
	startingSlot: number;
};

async function mapBounded<T, Result>(
	values: T[],
	concurrency: number,
	map: (value: T) => Promise<Result>
): Promise<Result[]> {
	const results = new Array<Result>(values.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(concurrency, values.length) }, async () => {
			while (next < values.length) {
				const index = next++;
				results[index] = await map(values[index]);
			}
		})
	);
	return results;
}

type SafePreparedTransaction = PreparedTransaction & {
	cost: bigint;
	setRequiredBalance(required: bigint): void;
};

type TransactionFields = {
	processId: string;
	target: string;
	quantity?: string;
	rewardFloor?: string;
	data?: string;
	tags: Array<{ name: string; value: string }>;
};

type TransactionIntent = {
	target: string;
	quantity: string;
	reward: string;
	tags: TransactionFields['tags'];
};

export type AssetTransactionClientOptions = {
	wallet?: any;
	fetch?: typeof fetch;
	arweave?: any;
	gateway?: string;
	storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & Partial<Pick<Storage, 'key' | 'length'>>;
	reservationInclusionMargin?: number;
};

export type OfferInput = {
	processId: string;
	quantity: string;
	asking: string;
	minimumFee?: string;
	/** Relative number of L1 blocks for which a reservation remains valid. */
	deadline?: number;
	seller?: string;
};

export type PurchaseAdapterInput = {
	processId: string;
	order: SwapOrder;
	fillQuantity?: string;
	buyer: string;
	startingBalance: string;
	network: WeaveNetwork;
	onPrepared?: (event: PurchasePreparationEvent) => void;
};

export type PurchasePreparationEvent = {
	kind: 'registration' | 'payment';
	orderId: string;
	transactionId: string;
	cost: string;
};

export type PurchaseBatchPreparationEvent =
	| {
			type: 'quoted';
			entries: Array<{ order: SwapOrder; fillQuantity: string; paymentCost: string }>;
	  }
	| ({ type: 'signed' } & PurchasePreparationEvent);

export type PreparedPurchase = {
	order: SwapOrder;
	fillQuantity: string;
	registration: PreparedTransaction;
	payment: PreparedTransaction;
	paymentCost: string;
	snapshot: {
		registration: { id: string; dispatched: false };
		payment: { id: string; dispatched: false };
	};
};

export type TransactionProgress = {
	confirmations: number;
	propagated: boolean;
	seen: number;
	eligible: number;
};

export class AssetTransactionClient {
	#wallet: any;
	#fetch: typeof fetch;
	#peerFetch: typeof fetch;
	#arweave?: any;
	#gateway: string;
	#storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & Partial<Pick<Storage, 'key' | 'length'>>;
	#reservationInclusionMargin: number;

	constructor(options: AssetTransactionClientOptions = {}) {
		this.#wallet = options.wallet ?? globalThis.window?.arweaveWallet;
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
		const computeGateways = typeof window === 'undefined' ? DEFAULT_COMPUTE_GATEWAYS : gatewaysFromLocation();
		this.#peerFetch = aoFetch(computeGateways, options.fetch);
		this.#arweave = options.arweave;
		this.#gateway = options.gateway ?? arweaveGatewayFromLocation();
		this.#storage = options.storage ?? globalThis.window?.localStorage;
		this.#reservationInclusionMargin = options.reservationInclusionMargin ?? DEFAULT_RESERVATION_INCLUSION_MARGIN;
		if (!Number.isSafeInteger(this.#reservationInclusionMargin) || this.#reservationInclusionMargin < 1) {
			throw new TypeError('invalid-reservation-inclusion-margin');
		}
	}

	async makeOffer(input: OfferInput, signal?: AbortSignal): Promise<PreparedTransaction> {
		if (!ADDRESS.test(input.processId)) throw new TypeError('invalid-asset-process-id');
		assertTokenQuantity(input.quantity);
		assertSafeOfferAsking(input.asking);
		if (input.seller && !ADDRESS.test(input.seller)) throw new TypeError('invalid-asset-offer-seller');
		const deadline = input.deadline ?? DEFAULT_OFFER_DEADLINE;
		if (!Number.isSafeInteger(deadline) || deadline < 1) {
			throw new TypeError('invalid-offer-deadline');
		}
		return this.#prepare(
			{
				processId: input.processId,
				target: input.processId,
				quantity: '1',
				tags: [
					{ name: 'action', value: 'make-offer' },
					{ name: 'offer-quantity', value: input.quantity },
					{ name: 'asking', value: input.asking },
					{ name: 'deposit', value: '0' },
					{
						name: 'minimum-fee',
						value: input.minimumFee ?? DEFAULT_REGISTRATION_FEE.toString(),
					},
					{ name: 'deadline', value: String(deadline) },
				],
			},
			signal,
			undefined,
			input.seller
		);
	}

	async cancelOrder(
		processId: string,
		orderId: string,
		expectedSigner?: string,
		signal?: AbortSignal
	): Promise<PreparedTransaction> {
		return this.#prepare(
			{
				processId,
				target: processId,
				quantity: '1',
				tags: [
					{ name: 'action', value: 'cancel-order' },
					{ name: 'order-id', value: orderId },
				],
			},
			signal,
			undefined,
			expectedSigner
		);
	}

	async transfer(
		processId: string,
		recipient: string,
		quantity: string,
		expectedSigner?: string,
		signal?: AbortSignal
	): Promise<PreparedTransaction> {
		return this.transferFungible(processId, recipient, quantity, expectedSigner, signal);
	}

	/** Keep native AR at zero so tx@1.0 promotes the token `quantity` tag. */
	async transferFungible(
		processId: string,
		recipient: string,
		quantity: string,
		expectedSigner?: string,
		signal?: AbortSignal
	): Promise<PreparedTransaction> {
		if (!ADDRESS.test(processId) || !ADDRESS.test(recipient)) {
			throw new TypeError('invalid-asset-transfer');
		}
		assertTokenQuantity(quantity);
		return this.#prepare(
			{
				processId,
				target: processId,
				quantity: '0',
				tags: [
					{ name: 'action', value: 'transfer' },
					{ name: 'recipient', value: recipient },
					{ name: 'quantity', value: quantity },
				],
			},
			signal,
			undefined,
			expectedSigner
		);
	}

	async requireOpenOrder(processId: string, orderId: string, creator: string, signal?: AbortSignal): Promise<void> {
		await this.#requireProcessState(
			processId,
			(state) => {
				const order = state.orders[orderId];
				return Boolean(order && order.status === 'open' && order.creator === creator);
			},
			'asset-order-not-open',
			signal
		);
	}

	async requireAssetBalance(
		processId: string,
		address: string,
		minimum: string,
		signal?: AbortSignal
	): Promise<void> {
		assertTokenQuantity(minimum);
		await this.#requireProcessState(
			processId,
			(state) => BigInt(state.balances[address] ?? '0') >= BigInt(minimum),
			'asset-not-owned',
			signal
		);
	}

	async waitForOfferAcceptance(
		processId: string,
		expected: {
			orderId: string;
			seller: string;
			quantity: string;
			asking: string;
			minimumFee: string;
		},
		signal?: AbortSignal
	): Promise<AssetState> {
		return (
			await waitForAssetState(
				processId,
				(state) => {
					const order = state.orders[expected.orderId];
					return Boolean(
						order &&
							order.status === 'open' &&
							order.creator === expected.seller &&
							order.quantity === expected.quantity &&
							order.asking === expected.asking &&
							order.minimumFee === expected.minimumFee
					);
				},
				{ fetch: this.#peerFetch, signal, timeout: STATE_INCLUSION_TIMEOUT }
			)
		).state;
	}

	async waitForExactCancellation(
		processId: string,
		transactionId: string,
		seller: string,
		expected: SwapOrder,
		baseline: FungibleTransferBaseline,
		signal?: AbortSignal
	): Promise<AssetState> {
		if (![processId, transactionId, seller, expected.orderId].every((value) => ADDRESS.test(value))) {
			throw new TypeError('invalid-asset-cancellation-verification');
		}
		assertTokenQuantity(expected.quantity);
		if (expected.creator !== seller || expected.status !== 'open') {
			throw new TypeError('invalid-asset-cancellation-order');
		}
		return this.#waitForExactScheduledAction(
			processId,
			transactionId,
			baseline,
			(assignment) => assertExactCancelAssignment(assignment, processId, transactionId, seller, expected.orderId),
			(after, assignment, before) =>
				Boolean(before && hasExactCancelTransition(before, after, assignment, seller, expected)),
			'asset-cancel-proof-mismatch',
			'asset-cancel-rejected',
			signal,
			true
		);
	}

	async waitForFungibleTransfer(
		processId: string,
		transactionId: string,
		sender: string,
		recipient: string,
		quantity: string,
		baseline: FungibleTransferBaseline,
		signal?: AbortSignal
	): Promise<AssetState> {
		if (
			![processId, transactionId, sender, recipient].every((value) => ADDRESS.test(value)) ||
			sender === recipient
		) {
			throw new TypeError('invalid-fungible-transfer-verification');
		}
		assertTokenQuantity(quantity);
		if (!Number.isSafeInteger(baseline.startingSlot) || baseline.startingSlot < 0) {
			throw new TypeError('invalid-fungible-transfer-baseline');
		}
		return this.#waitForExactScheduledAction(
			processId,
			transactionId,
			baseline,
			(assignment) =>
				assertExactFungibleTransferAssignment(
					assignment,
					processId,
					transactionId,
					sender,
					recipient,
					quantity
				),
			(after, assignment) => hasExactFungibleTransferReceipt(after, assignment, sender, recipient, quantity),
			'fungible-transfer-proof-mismatch',
			'fungible-transfer-rejected',
			signal
		);
	}

	async #waitForExactScheduledAction(
		processId: string,
		transactionId: string,
		baseline: FungibleTransferBaseline,
		assertAssignment: (assignment: ProcessAssignment) => void,
		appliedAtSlot: (
			after: AssetState,
			assignment: ProcessAssignment,
			before?: AssetState
		) => boolean | Promise<boolean>,
		proofMismatchCode: string,
		rejectionCode: string,
		signal?: AbortSignal,
		readPreviousState = false
	): Promise<AssetState> {
		if (!Number.isSafeInteger(baseline.startingSlot) || baseline.startingSlot < 0) {
			throw new TypeError('invalid-scheduled-action-baseline');
		}
		let transactionHeight: number | null = null;
		const assignmentCache = new Map<number, ProcessAssignment>();
		let exactState: AssetState | null = null;
		let rejected = false;
		let proofMismatch = false;
		await waitForAssetState(
			processId,
			async (current) => {
				// Schedule slots may move within the same L1 block during a reorg.
				// Cache only within one immutable-window attempt; a later poll must
				// rediscover its boundaries even when the transaction height agrees.
				assignmentCache.clear();
				const currentSlot = assetStateSlot(current);
				if (currentSlot === null || currentSlot < baseline.startingSlot) {
					throw new Error('invalid-current-process-slot');
				}
				if (currentSlot === baseline.startingSlot) return false;
				transactionHeight ??= await this.#transactionBlockHeight(transactionId, signal);
				const attemptedHeights = new Set<number>();
				while (!attemptedHeights.has(transactionHeight)) {
					attemptedHeights.add(transactionHeight);
					const firstSlot = await firstSlotAtOrAboveBlockHeight(
						processId,
						baseline.startingSlot + 1,
						currentSlot,
						transactionHeight,
						assignmentCache,
						this.#peerFetch,
						signal
					);
					if (firstSlot === null) return false;
					const firstHeight = assignmentCache.get(firstSlot)?.blockHeight;
					if (firstHeight !== transactionHeight) {
						const refreshedHeight = await this.#transactionBlockHeight(transactionId, signal);
						if (refreshedHeight === transactionHeight) return false;
						transactionHeight = refreshedHeight;
						assignmentCache.clear();
						continue;
					}
					const firstLaterSlot = await firstSlotAtOrAboveBlockHeight(
						processId,
						firstSlot,
						currentSlot,
						transactionHeight + 1,
						assignmentCache,
						this.#peerFetch,
						signal
					);
					const lastSlot = firstLaterSlot === null ? currentSlot : firstLaterSlot - 1;
					for (let fromSlot = firstSlot; fromSlot <= lastSlot; fromSlot += 100) {
						const toSlot = Math.min(lastSlot, fromSlot + 99);
						const assignments = await readProcessAssignments(processId, fromSlot, toSlot, {
							fetch: this.#peerFetch,
							signal,
						});
						const assignment = assignments.find((held) => held.transactionIds.includes(transactionId));
						if (!assignment) continue;
						try {
							assertAssignment(assignment);
						} catch (error) {
							if (error instanceof Error && error.message === proofMismatchCode) {
								proofMismatch = true;
								return true;
							}
							throw error;
						}
						const after = await readAssetStateAtSlot(processId, assignment.slot, {
							fetch: this.#peerFetch,
							signal,
						});
						const before = readPreviousState
							? await readAssetStateAtSlot(processId, assignment.slot - 1, {
									fetch: this.#peerFetch,
									signal,
							  })
							: undefined;
						exactState = after.state;
						rejected = !(await appliedAtSlot(after.state, assignment, before?.state));
						return true;
					}
					if (firstLaterSlot === null) return false;
					const refreshedHeight = await this.#transactionBlockHeight(transactionId, signal);
					if (refreshedHeight === transactionHeight) return false;
					transactionHeight = refreshedHeight;
					assignmentCache.clear();
				}
				return false;
			},
			{ fetch: this.#peerFetch, signal, timeout: STATE_INCLUSION_TIMEOUT }
		);
		if (proofMismatch) throw new Error(proofMismatchCode);
		if (rejected) throw new Error(rejectionCode);
		if (!exactState) throw new Error('scheduled-action-state-missing');
		return exactState;
	}

	purchaseAdapter(input: PurchaseAdapterInput): PurchaseAdapter {
		const purchaseOrder = filledOrder(input.order, input.fillQuantity ?? input.order.quantity);
		assertSafePurchaseOrder(purchaseOrder);
		assertTokenQuantity(input.startingBalance, true);
		const reportPrepared = (kind: PurchasePreparationEvent['kind'], transaction: SafePreparedTransaction) => {
			try {
				input.onPrepared?.({
					kind,
					orderId: input.order.orderId,
					transactionId: transaction.id,
					cost: transaction.cost.toString(),
				});
			} catch (cause) {
				this.#storage?.removeItem(`${SIGNED_TRANSACTION_PREFIX}${transaction.id}`);
				throw cause;
			}
			return transaction;
		};
		const prepareRegistration = async (signal: AbortSignal) =>
			reportPrepared(
				'registration',
				await this.#prepare(
					{
						processId: input.processId,
						target: input.processId,
						quantity: '1',
						rewardFloor: purchaseOrder.minimumFee,
						tags: [
							{ name: 'action', value: 'register-interest' },
							{ name: 'order-id', value: input.order.orderId },
							{ name: 'fill-quantity', value: purchaseOrder.quantity },
						],
					},
					signal,
					undefined,
					input.buyer
				)
			);
		const preparePayment = async (signal: AbortSignal) => {
			const tip = await this.#networkHeight(input.network, signal);
			const storedPaymentId = this.findStoredPayment(
				purchaseOrder.recipient,
				input.processId,
				input.order.orderId,
				purchaseOrder.asking,
				input.buyer,
				tip
			);
			if (storedPaymentId) {
				return reportPrepared(
					'payment',
					this.restore(storedPaymentId, input.buyer, {
						processId: input.processId,
					}) as SafePreparedTransaction
				);
			}

			return reportPrepared(
				'payment',
				await this.#prepare(
					{
						processId: input.processId,
						target: purchaseOrder.recipient,
						quantity: purchaseOrder.asking,
						tags: [{ name: 'order-id', value: input.order.orderId }],
					},
					signal,
					tip + SIGNATURE_WINDOW_BLOCKS,
					input.buyer
				)
			);
		};

		return {
			prepareRegistration,
			preparePayment: (_registrationId, signal) => preparePayment(signal),
			prepareBoth: async (signal) => {
				const prepared: SafePreparedTransaction[] = [];
				try {
					await this.#assertActiveSigner(input.buyer);
					const tip = await this.#networkHeight(input.network, signal);
					await this.#requireProcessState(
						input.processId,
						(state) =>
							isPurchasableOrderFill(
								state,
								input.order,
								purchaseOrder,
								input.buyer,
								tip,
								this.#reservationInclusionMargin
							),
						'asset-order-not-purchasable',
						signal,
						tip
					);
					const registration = await prepareRegistration(signal);
					prepared.push(registration);
					const payment = await preparePayment(signal);
					prepared.push(payment);
					registration.setRequiredBalance(registration.cost + payment.cost);
					payment.setRequiredBalance(payment.cost);
					await this.#assertBalance(input.buyer, registration.cost + payment.cost, signal);
					return { registration, payment };
				} catch (cause) {
					for (const transaction of prepared) {
						this.#storage?.removeItem(`${SIGNED_TRANSACTION_PREFIX}${transaction.id}`);
					}
					throw cause;
				}
			},
			// A persisted payment may have reached Arweave before its dispatched
			// bit was written. Always replay that exact ID; never expire it into a
			// second native-AR payment whose first dispatch remains ambiguous.
			restorePrepared: async (which, id, signal) => {
				if (which === 'registration') {
					const tip = await this.#networkHeight(input.network, signal);
					await this.#requireProcessState(
						input.processId,
						(state) =>
							isPurchasableOrderFill(
								state,
								input.order,
								purchaseOrder,
								input.buyer,
								tip,
								this.#reservationInclusionMargin
							),
						'asset-order-not-purchasable',
						signal,
						tip
					);
				}
				return this.restore(id, input.buyer, {
					preserveExpiry: which !== 'payment',
					processId: input.processId,
				});
			},
			waitForRegistrationAcceptance: async ({ registrationId, signal, report }) => {
				let expired = false;
				let rejected = false;
				const registrationHeight = await this.#transactionBlockHeight(registrationId, signal);
				await waitForAssetState(
					input.processId,
					async (state) => {
						const order = state.orders[input.order.orderId];
						const tip = await this.#networkHeight(input.network, signal);
						if (
							order &&
							purchaseOrderMatches(order, purchaseOrder) &&
							order.status === 'reserved' &&
							order.buyer === input.buyer
						) {
							expired = (order.reservedUntil ?? 0) < tip + this.#reservationInclusionMargin;
							return true;
						}

						// A reservation can have been accepted and later disappear from
						// the current state after its block-height deadline. Treat that
						// as expiry, not as proof that another buyer won the listing.
						if (
							order?.status === 'open' &&
							purchaseOrderMatches(order, input.order) &&
							tip > registrationHeight + input.order.deadline
						) {
							expired = true;
							return true;
						}

						// Once this process has computed safely beyond the registration's
						// L1 block, a missing reservation cannot appear later. It either
						// lost a race or was rejected by the token device. In either case
						// the pre-signed seller payment must remain undispatched and this
						// recovery must stop.
						rejected = state.swapHeight >= registrationHeight + SCHEDULER_INCLUSION_DEPTH;
						return rejected;
					},
					{
						fetch: this.#peerFetch,
						signal,
						timeout: STATE_INCLUSION_TIMEOUT,
						currentHeight: () => {
							const tip = input.network.tip();
							return Number.isSafeInteger(tip) && tip > 0 ? tip : undefined;
						},
						heightFetch: this.#fetch,
						heightGateway: this.#gateway,
						onAttempt: (provider, attempt, total) =>
							reportProvider(report, provider, attempt, total, 'checking-reservation'),
					}
				);
				if (rejected) throw new Error('asset-order-reservation-rejected');
				if (expired) throw new Error('asset-order-reservation-expired');
			},
			verifyOwnership: async ({ paymentId, signal, report }) => {
				if (!paymentId || !ADDRESS.test(paymentId)) {
					throw new Error('asset-payment-id-missing');
				}
				report({ code: 'checking-ownership' });
				await this.#waitForExactScheduledAction(
					input.processId,
					paymentId,
					{ startingSlot: 0 },
					(assignment) =>
						assertExactPurchaseAssignment(
							assignment,
							input.processId,
							paymentId,
							input.buyer,
							purchaseOrder
						),
					(after, assignment, before) =>
						Boolean(
							before && hasExactPurchaseTransition(before, after, assignment, input.buyer, purchaseOrder)
						),
					'asset-purchase-proof-mismatch',
					'asset-purchase-rejected',
					signal,
					true
				);
			},
		};
	}

	async preparePurchaseBatch(
		inputs: PurchaseAdapterInput[],
		signal?: AbortSignal,
		onPreparation?: (event: PurchaseBatchPreparationEvent) => void
	): Promise<PreparedPurchase[]> {
		if (!inputs.length) throw new TypeError('empty-purchase-batch');
		const buyer = inputs[0].buyer;
		if (!ADDRESS.test(buyer) || inputs.some((input) => input.buyer !== buyer)) {
			throw new TypeError('invalid-purchase-batch-buyer');
		}
		if (new Set(inputs.map((input) => input.order.orderId)).size !== inputs.length) {
			throw new TypeError('duplicate-purchase-batch-order');
		}
		await this.#assertActiveSigner(buyer);
		const estimates = await this.estimatePurchaseBatchCosts(
			inputs.map((input) => filledOrder(input.order, input.fillQuantity ?? input.order.quantity)),
			inputs[0].processId,
			signal
		);
		await this.#assertBalance(
			buyer,
			estimates.reduce((total, estimate) => total + BigInt(estimate.total), 0n),
			signal
		);
		onPreparation?.({
			type: 'quoted',
			entries: inputs.map((input, index) => ({
				order: input.order,
				fillQuantity: input.fillQuantity ?? input.order.quantity,
				paymentCost: (
					BigInt(estimates[index].asking) + BigInt(estimates[index].paymentNetworkReward)
				).toString(),
			})),
		});

		const prepared: Array<PreparedPurchase & { cost: bigint }> = [];
		try {
			for (const input of inputs) {
				if (signal?.aborted) throw signal.reason;
				const adapter = this.purchaseAdapter({
					...input,
					onPrepared: (event) => {
						input.onPrepared?.(event);
						onPreparation?.({ type: 'signed', ...event });
					},
				});
				if (!adapter.prepareBoth) throw new Error('purchase-presign-unavailable');
				const pair = await adapter.prepareBoth(signal ?? new AbortController().signal);
				const registration = pair.registration as SafePreparedTransaction;
				const payment = pair.payment as SafePreparedTransaction;
				prepared.push({
					order: input.order,
					fillQuantity: input.fillQuantity ?? input.order.quantity,
					registration,
					payment,
					paymentCost: payment.cost.toString(),
					snapshot: {
						registration: { id: registration.id, dispatched: false },
						payment: { id: payment.id, dispatched: false },
					},
					cost: registration.cost + payment.cost,
				});
			}
			await this.#assertBalance(
				buyer,
				prepared.reduce((total, item) => total + item.cost, 0n),
				signal
			);
			return prepared.map(({ cost: _cost, ...item }) => item);
		} catch (cause) {
			for (const item of prepared) {
				this.#storage?.removeItem(`${SIGNED_TRANSACTION_PREFIX}${item.registration.id}`);
				this.#storage?.removeItem(`${SIGNED_TRANSACTION_PREFIX}${item.payment.id}`);
			}
			throw cause;
		}
	}

	restore(
		id: string,
		expectedSigner?: string,
		options: { preserveExpiry?: boolean; processId?: string } = {}
	): PreparedTransaction {
		if (!ADDRESS.test(id)) throw new TypeError('invalid-signed-transaction-id');
		const held = this.#storage?.getItem(`${SIGNED_TRANSACTION_PREFIX}${id}`);
		if (!held) throw new Error('signed-transaction-not-found');
		const stored = JSON.parse(held);
		const transaction = stored.transaction ?? stored;
		if (transaction.id !== id) throw new Error('signed-transaction-id-mismatch');
		assertZeroDataTransaction(transaction);
		assertTransactionIntent(transaction, stored.intent);
		const processId = options.processId ?? stored.processId;
		if (processId) assertProcessInteractionRouting(transaction, processId);
		if (stored.expectedSigner && expectedSigner && stored.expectedSigner !== expectedSigner) {
			throw new Error('signed-transaction-signer-mismatch');
		}
		return this.#prepared(
			transaction,
			options.preserveExpiry === false ? undefined : stored.validUntilHeight,
			expectedSigner ?? stored.expectedSigner,
			stored.requiredBalance === undefined ? undefined : BigInt(stored.requiredBalance),
			stored.intent,
			processId
		);
	}

	findStoredRegistration(processId: string, orderId: string, expectedSigner: string): string | null {
		if (![processId, orderId, expectedSigner].every((value) => ADDRESS.test(value))) {
			throw new TypeError('invalid-stored-registration-lookup');
		}
		if (!this.#storage?.key || typeof this.#storage.length !== 'number') return null;
		for (let index = 0; index < this.#storage.length; index += 1) {
			const key = this.#storage.key(index);
			if (!key?.startsWith(SIGNED_TRANSACTION_PREFIX)) continue;
			try {
				const stored = JSON.parse(this.#storage.getItem(key) || 'null');
				const transaction = stored?.transaction ?? stored;
				if (
					stored?.expectedSigner === expectedSigner &&
					transaction?.target === processId &&
					transactionTagMatches(transaction?.tags, 'action', 'register-interest') &&
					transactionTagMatches(transaction?.tags, 'order-id', orderId) &&
					ADDRESS.test(transaction?.id)
				) {
					return transaction.id;
				}
			} catch {
				// Ignore unrelated or stale local entries.
			}
		}
		return null;
	}

	findStoredPayment(
		recipient: string,
		processId: string,
		orderId: string,
		asking: string,
		expectedSigner: string,
		minimumValidHeight?: number
	): string | null {
		if (
			![recipient, processId, orderId, expectedSigner].every((value) => ADDRESS.test(value)) ||
			!/^[1-9]\d*$/.test(asking)
		) {
			throw new TypeError('invalid-stored-payment-lookup');
		}
		if (!this.#storage?.key || typeof this.#storage.length !== 'number') return null;
		for (let index = this.#storage.length - 1; index >= 0; index -= 1) {
			const key = this.#storage.key(index);
			if (!key?.startsWith(SIGNED_TRANSACTION_PREFIX)) continue;
			try {
				const stored = JSON.parse(this.#storage.getItem(key) || 'null');
				const transaction = stored?.transaction ?? stored;
				const validUntilHeight = Number(stored?.validUntilHeight);
				if (
					stored?.expectedSigner === expectedSigner &&
					transaction?.target === recipient &&
					transaction?.quantity === asking &&
					transactionTagMatches(transaction?.tags, 'order-id', orderId) &&
					processInteractionRoutesTo(transaction, processId) &&
					ADDRESS.test(transaction?.id) &&
					(minimumValidHeight === undefined ||
						stored?.validUntilHeight === undefined ||
						validUntilHeight > minimumValidHeight)
				) {
					return transaction.id;
				}
			} catch {
				// Ignore unrelated or stale local entries.
			}
		}
		return null;
	}

	async estimatePurchaseCost(order: SwapOrder, processId: string, signal?: AbortSignal): Promise<bigint> {
		return BigInt((await this.estimatePurchaseCosts(order, processId, signal)).total);
	}

	async estimatePurchaseCosts(
		order: SwapOrder,
		processId: string,
		signal?: AbortSignal
	): Promise<PurchaseCostEstimate> {
		return (await this.estimatePurchaseBatchCosts([order], processId, signal))[0];
	}

	async estimatePurchaseBatchCosts(
		orders: SwapOrder[],
		processId: string,
		signal?: AbortSignal
	): Promise<PurchaseCostEstimate[]> {
		if (!orders.length) return [];
		orders.forEach(assertSafePurchaseOrder);
		const targets = [...new Set([processId, ...orders.map((order) => order.recipient)])];
		const rewards = new Map(
			await mapBounded(
				targets,
				PRICE_REQUEST_CONCURRENCY,
				async (target) => [target, await this.#price(target, signal)] as const
			)
		);
		const registrationReward = rewards.get(processId)!;
		return orders.map((order) => {
			const asking = BigInt(order.asking);
			const registrationFee = BigInt(order.minimumFee);
			const paymentReward = rewards.get(order.recipient)!;
			return {
				asking: asking.toString(),
				registrationFee: registrationFee.toString(),
				registrationNetworkReward: registrationReward.toString(),
				paymentNetworkReward: paymentReward.toString(),
				total: (asking + maxBigInt(registrationReward, registrationFee) + paymentReward + 1n).toString(),
			};
		});
	}

	async walletBalance(address: string, signal?: AbortSignal): Promise<bigint> {
		const response = await this.#fetch(`${this.#gateway}/wallet/${address}/balance`, { signal });
		if (!response.ok) throw new Error(`wallet-balance-${response.status}`);
		const value = (await response.text()).trim();
		return BigInt(value);
	}

	async #price(target: string, signal?: AbortSignal): Promise<bigint> {
		const response = await this.#fetch(`${this.#gateway}/price/0/${target}`, { signal });
		if (!response.ok) throw new Error(`transaction-price-${response.status}`);
		return BigInt((await response.text()).trim());
	}

	async #prepare(
		fields: TransactionFields,
		signal?: AbortSignal,
		validUntilHeight?: number,
		expectedSigner?: string
	): Promise<SafePreparedTransaction> {
		if (!this.#wallet?.sign) throw new Error('wallet-sign-unavailable');
		if (signal?.aborted) throw signal.reason;
		if (expectedSigner) await this.#assertActiveSigner(expectedSigner);
		const arweave = await this.#getArweave();
		const tags = processInteractionTags(fields);

		const transaction = await arweave.createTransaction(
			{
				...(fields.target ? { target: fields.target } : {}),
				...(fields.quantity ? { quantity: fields.quantity } : {}),
				data: fields.data ?? '',
			},
			'use_wallet'
		);
		if (fields.rewardFloor && BigInt(transaction.reward) < BigInt(fields.rewardFloor)) {
			transaction.reward = fields.rewardFloor;
		}
		for (const tag of tags) transaction.addTag(tag.name, tag.value);
		const intent: TransactionIntent = {
			target: fields.target,
			quantity: fields.quantity ?? '0',
			reward: String(transaction.reward),
			tags,
		};

		const walletResult = (await this.#wallet.sign(transaction)) ?? transaction;
		let signed = walletResult;
		if (walletResult !== transaction && typeof transaction?.setSignature === 'function') {
			transaction.setSignature({
				id: walletResult.id,
				owner: walletResult.owner,
				reward: walletResult.reward,
				tags: walletResult.tags,
				signature: walletResult.signature,
			});
			signed = transaction;
		}
		if (signal?.aborted) throw signal.reason;
		if (!ADDRESS.test(signed.id)) throw new Error('wallet-returned-unsigned-transaction');
		const serializable = typeof signed.toJSON === 'function' ? signed.toJSON() : JSON.parse(JSON.stringify(signed));
		serializable.id = signed.id;
		assertZeroDataTransaction(serializable);
		const signedReward = serializable.reward;
		if (typeof signedReward !== 'string' || !/^\d+$/.test(signedReward)) {
			throw new Error('wallet-modified-transaction-fields');
		}
		// Wander finalizes the network reward as part of the signed fields it
		// returns. Keep the business intent strict, then make that exact signed
		// reward immutable for persistence, recovery, and dispatch.
		intent.reward = signedReward;
		let signatureValid = false;
		try {
			signatureValid = Boolean(await arweave.transactions?.verify?.(signed));
		} catch {
			signatureValid = false;
		}
		if (!signatureValid) throw new Error('wallet-returned-invalid-signature');
		assertTransactionIntent(serializable, intent);
		if (expectedSigner) await this.#assertSigner(serializable, expectedSigner);
		if (signal?.aborted) throw signal.reason;
		const requiredBalance = transactionCost(serializable);
		if (this.#storage) {
			setCriticalStorageItem(
				this.#storage,
				`${SIGNED_TRANSACTION_PREFIX}${signed.id}`,
				JSON.stringify({
					transaction: serializable,
					intent,
					processId: fields.processId,
					...(validUntilHeight === undefined ? {} : { validUntilHeight }),
					...(expectedSigner ? { expectedSigner } : {}),
					...(expectedSigner ? { requiredBalance: requiredBalance.toString() } : {}),
				})
			);
		}
		return this.#prepared(
			serializable,
			validUntilHeight,
			expectedSigner,
			requiredBalance,
			intent,
			fields.processId
		);
	}

	#prepared(
		transaction: Record<string, unknown>,
		validUntilHeight?: number,
		expectedSigner?: string,
		initialRequiredBalance?: bigint,
		intent?: TransactionIntent,
		processId?: string
	): SafePreparedTransaction {
		const id = String(transaction.id);
		const cost = transactionCost(transaction);
		let requiredBalance = initialRequiredBalance ?? cost;
		return {
			id,
			cost,
			...(validUntilHeight === undefined ? {} : { validUntilHeight }),
			setRequiredBalance: (required) => {
				requiredBalance = required;
				const held = this.#storage?.getItem(`${SIGNED_TRANSACTION_PREFIX}${id}`);
				if (!held) return;
				const stored = JSON.parse(held);
				stored.requiredBalance = required.toString();
				if (this.#storage) {
					setCriticalStorageItem(this.#storage, `${SIGNED_TRANSACTION_PREFIX}${id}`, JSON.stringify(stored));
				}
			},
			dispatch: async (signal) => {
				try {
					assertZeroDataTransaction(transaction);
					assertTransactionIntent(transaction, intent);
					if (processId) assertProcessInteractionRouting(transaction, processId);
					if (expectedSigner) {
						await this.#assertSigner(transaction, expectedSigner);
						await this.#assertBalance(expectedSigner, requiredBalance, signal);
					}
				} catch (cause) {
					if (signal.aborted) throw cause;
					throw new TransactionDispatchNotSentError(cause instanceof Error ? cause.message : String(cause));
				}
				const response = await this.#fetch(`${this.#gateway}/tx`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(transaction),
					signal,
				});
				if (response.status === 200 || response.status === 202) {
					return { status: 'accepted', httpStatus: response.status, observer: this.#gateway };
				}
				if (response.status === 208) {
					return { status: 'duplicate', httpStatus: response.status, observer: this.#gateway };
				}
				const detail = (await response.text()).slice(0, 240);
				if (response.status === 400 || response.status === 422) {
					throw new TransactionDispatchRejectedError(
						response.status,
						`transaction-dispatch-${response.status}: ${detail}`
					);
				}
				throw new Error(`transaction-dispatch-${response.status}: ${detail}`);
			},
		};
	}

	async #assertSigner(transaction: Record<string, unknown>, expectedSigner: string): Promise<void> {
		const owner = String(transaction.owner ?? '');
		const arweave = await this.#getArweave();
		if (!owner || !arweave.wallets?.ownerToAddress) {
			throw new Error('signed-transaction-owner-unavailable');
		}
		if ((await arweave.wallets.ownerToAddress(owner)) !== expectedSigner) {
			throw new Error('wallet-account-changed');
		}
	}

	async #getArweave() {
		this.#arweave ??= await createArweaveClient(arweaveClientConfig(this.#gateway));
		return this.#arweave;
	}

	async #assertActiveSigner(expectedSigner: string): Promise<void> {
		if (this.#wallet.getActiveAddress && (await this.#wallet.getActiveAddress()) !== expectedSigner) {
			throw new Error('wallet-account-changed');
		}
	}

	async #assertBalance(address: string, required: bigint, signal?: AbortSignal): Promise<void> {
		const balance = await this.walletBalance(address, signal);
		signal?.throwIfAborted();
		if (balance < required) {
			throw new Error('asset-purchase-insufficient-funds');
		}
	}

	async #networkHeight(network: WeaveNetwork, signal: AbortSignal): Promise<number> {
		const observed = network.tip();
		if (Number.isSafeInteger(observed) && observed > 0) return observed;
		return currentArweaveHeight({
			fetch: this.#fetch,
			gateway: this.#gateway,
			maxAgeMs: 1_000,
			signal,
		});
	}

	async #transactionBlockHeight(transactionId: string, signal?: AbortSignal): Promise<number> {
		const request = requestDeadline(signal, 12_000);
		try {
			const response = await this.#fetch(`${this.#gateway}/tx/${transactionId}/status`, {
				cache: 'no-store',
				signal: request.signal,
			});
			if (!response.ok) throw new Error(`transaction-status-${response.status}`);
			const height = Number((await response.json()).block_height);
			if (!Number.isSafeInteger(height) || height < 0) {
				throw new Error('invalid-transaction-block-height');
			}
			return height;
		} finally {
			request.cleanup();
		}
	}

	async #requireProcessState(
		processId: string,
		accept: (state: AssetState) => boolean,
		errorCode: string,
		signal?: AbortSignal,
		currentHeight?: number
	): Promise<void> {
		try {
			const { state } = await readAssetState(processId, {
				fetch: this.#peerFetch,
				maxAge: 0,
				signal,
				...(currentHeight === undefined ? {} : { currentHeight }),
				heightFetch: this.#fetch,
				heightGateway: this.#gateway,
			});
			if (!accept(state)) throw new Error(errorCode);
		} catch (error) {
			if (signal?.aborted) throw error;
			throw new Error(errorCode);
		}
	}
}

export function fungibleTransferAppliedAtSlot(
	after: AssetState,
	assignment: ProcessAssignment,
	processId: string,
	transactionId: string,
	sender: string,
	recipient: string,
	quantity: string
) {
	assertExactFungibleTransferAssignment(assignment, processId, transactionId, sender, recipient, quantity);
	return hasExactFungibleTransferReceipt(after, assignment, sender, recipient, quantity);
}

export function cancelAppliedAtSlot(
	before: AssetState,
	after: AssetState,
	assignment: ProcessAssignment,
	processId: string,
	transactionId: string,
	seller: string,
	orderId: string
): boolean {
	assertExactCancelAssignment(assignment, processId, transactionId, seller, orderId);
	const expected = before.orders[orderId];
	return Boolean(expected && hasExactCancelTransition(before, after, assignment, seller, expected));
}

export function purchaseAppliedAtSlot(
	before: AssetState,
	after: AssetState,
	assignment: ProcessAssignment,
	processId: string,
	transactionId: string,
	buyer: string,
	expected: SwapOrder
): boolean {
	assertExactPurchaseAssignment(assignment, processId, transactionId, buyer, expected);
	return hasExactPurchaseTransition(before, after, assignment, buyer, expected);
}

export function assertExactPurchaseAssignment(
	assignment: ProcessAssignment,
	processId: string,
	transactionId: string,
	buyer: string,
	expected: SwapOrder
): void {
	const body = record(assignment.raw.body);
	const commitment = record(record(body?.commitments)?.[transactionId]);
	const committed = Array.isArray(commitment?.committed)
		? new Set(commitment.committed.filter((key): key is string => typeof key === 'string'))
		: new Set<string>();
	if (
		!assignment.transactionIds.includes(transactionId) ||
		assignment.raw.process !== processId ||
		body?.target !== expected.recipient ||
		body?.['order-id'] !== expected.orderId ||
		wireAmount(body?.quantity) !== expected.asking ||
		commitment?.['commitment-device'] !== 'tx@1.0' ||
		commitment.committer !== buyer ||
		commitment['field-target'] !== expected.recipient ||
		!['order-id', 'quantity', 'target'].every((field) => committed.has(field))
	)
		throw new Error('asset-purchase-proof-mismatch');
}

export function hasExactPurchaseTransition(
	before: AssetState,
	after: AssetState,
	assignment: ProcessAssignment,
	buyer: string,
	expected: SwapOrder
): boolean {
	if (assetStateSlot(before) !== assignment.slot - 1 || assetStateSlot(after) !== assignment.slot) return false;
	const beforeOrder = before.orders[expected.orderId];
	if (
		!beforeOrder ||
		beforeOrder.status !== 'reserved' ||
		beforeOrder.buyer !== buyer ||
		(beforeOrder.reservedUntil ?? -1) < assignment.blockHeight ||
		!purchaseOrderMatches(beforeOrder, expected) ||
		after.orders[expected.orderId]
	)
		return false;
	return BigInt(after.balances[buyer] ?? '0') === BigInt(before.balances[buyer] ?? '0') + BigInt(expected.quantity);
}

export function assertExactCancelAssignment(
	assignment: ProcessAssignment,
	processId: string,
	transactionId: string,
	seller: string,
	orderId: string
): void {
	const body = record(assignment.raw.body);
	const commitment = record(record(body?.commitments)?.[transactionId]);
	const committed = Array.isArray(commitment?.committed)
		? new Set(commitment.committed.filter((key): key is string => typeof key === 'string'))
		: new Set<string>();
	if (
		!assignment.transactionIds.includes(transactionId) ||
		assignment.raw.process !== processId ||
		body?.target !== processId ||
		body?.action !== 'cancel-order' ||
		body?.['order-id'] !== orderId ||
		commitment?.['commitment-device'] !== 'tx@1.0' ||
		commitment.committer !== seller ||
		commitment['field-target'] !== processId ||
		!['action', 'order-id', 'target'].every((field) => committed.has(field))
	)
		throw new Error('asset-cancel-proof-mismatch');
}

export function hasExactCancelTransition(
	before: AssetState,
	after: AssetState,
	assignment: ProcessAssignment,
	seller: string,
	expected: SwapOrder
): boolean {
	if (assetStateSlot(before) !== assignment.slot - 1 || assetStateSlot(after) !== assignment.slot) return false;
	const beforeOrder = before.orders[expected.orderId];
	if (
		!beforeOrder ||
		beforeOrder.status !== 'open' ||
		beforeOrder.creator !== seller ||
		!purchaseOrderMatches(beforeOrder, expected) ||
		after.orders[expected.orderId]
	)
		return false;
	return BigInt(after.balances[seller] ?? '0') >= BigInt(before.balances[seller] ?? '0') + BigInt(expected.quantity);
}

export function assertExactFungibleTransferAssignment(
	assignment: ProcessAssignment,
	processId: string,
	transactionId: string,
	sender: string,
	recipient: string,
	quantity: string
): void {
	const body = record(assignment.raw.body);
	const commitment = record(record(body?.commitments)?.[transactionId]);
	const committed = Array.isArray(commitment?.committed)
		? new Set(commitment.committed.filter((key): key is string => typeof key === 'string'))
		: new Set<string>();
	const decodedQuantity = wireAmount(body?.quantity);
	const nativeQuantity = wireAmount(commitment?.['field-quantity']) ?? '0';
	const originalQuantity = uniqueOriginalTagValue(commitment?.['original-tags'], 'quantity');
	const quantityShapeMatches =
		(nativeQuantity === '0' && decodedQuantity === quantity) ||
		(nativeQuantity === '1' && decodedQuantity === '1') ||
		(nativeQuantity === quantity && decodedQuantity === quantity);
	if (
		!assignment.transactionIds.includes(transactionId) ||
		assignment.raw.process !== processId ||
		body?.target !== processId ||
		body?.action !== 'transfer' ||
		body?.recipient !== recipient ||
		!quantityShapeMatches ||
		wireAmount(originalQuantity) !== quantity ||
		commitment?.['commitment-device'] !== 'tx@1.0' ||
		commitment.committer !== sender ||
		commitment['field-target'] !== processId ||
		!['action', 'recipient', 'quantity', 'target'].every((field) => committed.has(field))
	)
		throw new Error('fungible-transfer-proof-mismatch');
}

function uniqueOriginalTagValue(originalTags: unknown, expectedName: string): unknown {
	const tags = record(originalTags);
	if (!tags) return undefined;
	const matches = Object.values(tags)
		.map((tag) => record(tag))
		.filter((tag) => tag?.name?.toString().toLowerCase() === expectedName);
	return matches.length === 1 ? matches[0]?.value : undefined;
}

export function hasExactFungibleTransferReceipt(
	after: AssetState,
	assignment: ProcessAssignment,
	sender: string,
	recipient: string,
	quantity: string
): boolean {
	if (assetStateSlot(after) !== assignment.slot) return false;
	const results = record(after.raw.results);
	const outbox = Array.isArray(results?.outbox) ? results.outbox : Object.values(record(results?.outbox) ?? {});
	const notices = outbox
		.map((notice) => record(notice))
		.filter((notice): notice is Record<string, unknown> => notice !== null);
	return (
		notices.some(
			(notice) =>
				notice.action === 'Debit-Notice' &&
				notice.target === sender &&
				notice.recipient === recipient &&
				wireAmount(notice.quantity) === quantity
		) &&
		notices.some(
			(notice) =>
				notice.action === 'Credit-Notice' &&
				notice.target === recipient &&
				notice.sender === sender &&
				wireAmount(notice.quantity) === quantity
		)
	);
}

function record(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function wireAmount(value: unknown): string | null {
	if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
	return typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value) ? value : null;
}

async function firstSlotAtOrAboveBlockHeight(
	processId: string,
	fromSlot: number,
	toSlot: number,
	blockHeight: number,
	cache: Map<number, ProcessAssignment>,
	fetcher: typeof fetch,
	signal?: AbortSignal
): Promise<number | null> {
	let low = fromSlot;
	let high = toSlot;
	let found: number | null = null;
	while (low <= high) {
		const slot = low + Math.floor((high - low) / 2);
		let assignment = cache.get(slot);
		if (!assignment) {
			[assignment] = await readProcessAssignments(processId, slot, slot, { fetch: fetcher, signal });
			if (!assignment || assignment.slot !== slot) throw new Error('process-schedule-slot-missing');
			cache.set(slot, assignment);
		}
		if (assignment.blockHeight >= blockHeight) {
			found = slot;
			high = slot - 1;
		} else {
			low = slot + 1;
		}
	}
	return found;
}

function requestDeadline(parent: AbortSignal | undefined, timeout: number) {
	const controller = new AbortController();
	const abort = () => controller.abort(parent?.reason);
	if (parent?.aborted) abort();
	else parent?.addEventListener('abort', abort, { once: true });
	const timer = setTimeout(() => controller.abort(new Error('transaction-status-timeout')), timeout);
	return {
		signal: controller.signal,
		cleanup: () => {
			clearTimeout(timer);
			parent?.removeEventListener('abort', abort);
		},
	};
}

export type ConfirmTransactionOptions = {
	signal?: AbortSignal;
	target?: number;
	onProgress?: (progress: TransactionProgress) => void;
	onViews?: (views: ObserverView[]) => void;
	onConsensus?: (consensus: Consensus) => void;
};

/**
 * Acquire a shared observer network, watch `txId` to the requested
 * confirmation target, and forward every aggregate change through the
 * callbacks. `run` receives the live watcher and the settlement promise so a
 * caller can do additional work (e.g. dispatch the transaction) while the same
 * watcher observes it. The observer lease, watcher lifecycle, and the
 * settlement wiring are identical for watch-only and dispatch-and-watch use.
 */
async function withTransactionWatcher<T>(
	txId: string,
	options: ConfirmTransactionOptions,
	run: (context: { watcher: TxWatcher; settlement: Promise<void> }) => Promise<T>
): Promise<T> {
	const observerLease = acquireAssetObserverNetwork();
	const network = observerLease.network;
	try {
		await observerLease.ready;
		const watcher = network.watch(txId, {
			target: options.target ?? 1,
			minObservers: 2,
			propagation: 'all',
			notFoundTimeout: 180_000,
		});
		const settlement = new Promise<void>((resolve, reject) => {
			const abort = () => reject(options.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
			options.signal?.addEventListener('abort', abort, { once: true });
			watcher.on('consensus', (consensus) => {
				options.onViews?.(watcher.views());
				options.onConsensus?.(consensus);
				options.onProgress?.({
					confirmations: consensus.confirmations,
					propagated: consensus.propagated,
					seen: consensus.seen,
					eligible: consensus.eligible,
				});
			});
			watcher.on('settled', () => resolve());
			watcher.on('timeout', () => reject(new Error('transaction-propagation-timeout')));
		});
		void settlement.catch(() => undefined);
		watcher.start();
		try {
			return await run({ watcher, settlement });
		} finally {
			watcher.stop();
		}
	} finally {
		observerLease.release();
	}
}

/**
 * Watch an already-posted transaction id until it reaches the confirmation
 * target, forwarding observer views/consensus/progress. Unlike
 * dispatchAndConfirm this never submits anything — it is for flows that posted
 * the transaction elsewhere (e.g. a minted process tx) and only need the same
 * L1 confirmation race the buy/sell flow renders.
 */
export async function confirmTransactionId(txId: string, options: ConfirmTransactionOptions = {}): Promise<void> {
	await withTransactionWatcher(txId, options, async ({ settlement }) => {
		await settlement;
	});
}

export async function dispatchAndConfirm(
	transaction: PreparedTransaction,
	options: ConfirmTransactionOptions = {}
): Promise<void> {
	await withTransactionWatcher(transaction.id, options, async ({ watcher, settlement }) => {
		const dispatchController = new AbortController();
		const abortDispatch = () => dispatchController.abort(options.signal?.reason);
		if (options.signal?.aborted) abortDispatch();
		else options.signal?.addEventListener('abort', abortDispatch, { once: true });
		try {
			const dispatch = (async () => {
				let dispatchError: unknown;
				for (let attempt = 0; attempt < 2; attempt += 1) {
					try {
						await transaction.dispatch(dispatchController.signal);
						dispatchError = undefined;
						break;
					} catch (error) {
						dispatchError = error;
						if (
							isAmbiguousDispatchError(error) &&
							(await waitUntilSeen(watcher, 15_000, dispatchController.signal))
						) {
							dispatchError = undefined;
							break;
						}
						if (!isAmbiguousDispatchError(error)) break;
					}
				}
				if (dispatchError) throw dispatchError;
			})();
			void dispatch.catch(() => undefined);
			await Promise.race([dispatch, settlement]);
			await settlement;
		} finally {
			if (!dispatchController.signal.aborted) {
				dispatchController.abort(new DOMException('Transaction observation finished', 'AbortError'));
			}
			options.signal?.removeEventListener('abort', abortDispatch);
		}
	});
}

function reportProvider(
	report: (update: VerificationUpdate) => void,
	provider: string,
	attempt: number,
	total: number,
	code: string
): void {
	report({ provider, attempt, total, code });
}

function maxBigInt(left: bigint, right: bigint): bigint {
	return left > right ? left : right;
}

export function purchaseOrderSafetyError(order: SwapOrder): string | null {
	try {
		if (BigInt(order.minimumFee) > MAXIMUM_REGISTRATION_FEE) {
			return 'asset-purchase-registration-fee-too-high';
		}
	} catch {
		return 'asset-purchase-invalid-registration-fee';
	}
	return null;
}

export function assertSafePurchaseOrder(order: SwapOrder): void {
	const error = purchaseOrderSafetyError(order);
	if (error) throw new Error(error);
}

function assertSafeOfferAsking(value: string): void {
	if (!/^[1-9]\d*$/.test(value)) throw new TypeError('invalid-asset-offer-asking');
	if (BigInt(value) > MAXIMUM_ASSET_OFFER_PRICE) throw new TypeError('asset-offer-asking-too-high');
}

function assertTokenQuantity(value: string, allowZero = false): void {
	if (!/^(?:0|[1-9]\d*)$/.test(value) || (!allowZero && value === '0')) {
		throw new TypeError('invalid-token-quantity');
	}
}

function assertZeroDataTransaction(transaction: Record<string, unknown>): void {
	if (transaction.data !== '' && transaction.data !== undefined) {
		throw new Error('wallet-modified-transaction-data');
	}
	if (transaction.data_size !== undefined && String(transaction.data_size) !== '0') {
		throw new Error('wallet-modified-transaction-data');
	}
	if (transaction.data_root !== undefined && transaction.data_root !== '') {
		throw new Error('wallet-modified-transaction-data');
	}
}

function processInteractionTags(fields: TransactionFields): TransactionFields['tags'] {
	if (!ADDRESS.test(fields.processId) || !ADDRESS.test(fields.target)) {
		throw new TypeError('invalid-process-interaction-routing');
	}
	const assignmentTags = fields.tags.filter((tag) => tag.name === 'assign-to');
	if (assignmentTags.some((tag) => tag.value !== fields.processId)) {
		throw new TypeError('invalid-process-interaction-routing');
	}
	if (fields.target === fields.processId || assignmentTags.length) return fields.tags;
	return [...fields.tags, { name: 'assign-to', value: fields.processId }];
}

function assertProcessInteractionRouting(transaction: Record<string, unknown>, processId: string): void {
	if (!processInteractionRoutesTo(transaction, processId)) {
		throw new Error('signed-transaction-process-routing-mismatch');
	}
}

function processInteractionRoutesTo(transaction: Record<string, unknown>, processId: string): boolean {
	if (!ADDRESS.test(processId)) return false;
	if (transaction.target === processId) return true;
	const assignments = transactionTagNameValues(transaction.tags, 'assign-to');
	return assignments.length > 0 && assignments.every((value) => value === processId);
}

function assertTransactionIntent(transaction: Record<string, unknown>, expected: unknown): void {
	if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
		throw new Error('signed-transaction-intent-unavailable');
	}
	const intent = expected as TransactionIntent;
	if (
		typeof intent.target !== 'string' ||
		typeof intent.quantity !== 'string' ||
		typeof intent.reward !== 'string' ||
		!Array.isArray(intent.tags)
	) {
		throw new Error('signed-transaction-intent-unavailable');
	}
	if (
		typeof transaction.target !== 'string' ||
		transaction.target !== intent.target ||
		typeof transaction.quantity !== 'string' ||
		transaction.quantity !== intent.quantity ||
		typeof transaction.reward !== 'string' ||
		transaction.reward !== intent.reward ||
		!transactionTagsEqual(transaction.tags, intent.tags)
	) {
		throw new Error('wallet-modified-transaction-fields');
	}
}

function transactionTagsEqual(tags: unknown, expected: TransactionFields['tags']): boolean {
	if (!Array.isArray(tags)) return false;
	const decoded = tags.map((tag) => {
		if (!tag || typeof tag !== 'object') return null;
		const record = tag as Record<string, unknown>;
		const names = transactionTagValues(record.name);
		const values = transactionTagValues(record.value);
		return names.length === 1 && values.length === 1 ? { name: names[0], value: values[0] } : null;
	});
	if (decoded.some((tag) => tag === null)) return false;

	// Wander's signing finalizer merges the app's original tags with tags from
	// the signed wallet response. Permit signed metadata and identical copies of
	// an expected tag, but never permit a conflicting value for a business tag.
	return expected.every((expectedTag) => {
		const matchingName = decoded.filter((tag) => tag?.name === expectedTag.name);
		return matchingName.length > 0 && matchingName.every((tag) => tag?.value === expectedTag.value);
	});
}

function transactionCost(transaction: Record<string, unknown>): bigint {
	return BigInt(String(transaction.quantity ?? '0')) + BigInt(String(transaction.reward ?? '0'));
}

function transactionTagMatches(tags: unknown, expectedName: string, expectedValue: string): boolean {
	return transactionTagNameValues(tags, expectedName).includes(expectedValue);
}

function transactionTagNameValues(tags: unknown, expectedName: string): string[] {
	if (!Array.isArray(tags)) return [];
	return tags.flatMap((tag) => {
		if (!tag || typeof tag !== 'object') return [];
		const record = tag as Record<string, unknown>;
		return transactionTagValues(record.name).includes(expectedName) ? transactionTagValues(record.value) : [];
	});
}

function transactionTagValues(value: unknown): string[] {
	if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return [];
	try {
		const base64 = value
			.replaceAll('-', '+')
			.replaceAll('_', '/')
			.padEnd(Math.ceil(value.length / 4) * 4, '=');
		const binary = globalThis.atob(base64);
		const canonical = globalThis.btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
		if (canonical !== value) return [];
		return [new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))];
	} catch {
		return [];
	}
}

function isPurchasableOrderFill(
	state: AssetState,
	source: SwapOrder,
	fill: SwapOrder,
	buyer: string,
	tip: number,
	inclusionMargin: number
): boolean {
	const order = state.orders[source.orderId];
	// An order reserved for this buyer is still theirs to complete: without
	// this, a retry after a verification timeout refuses the very order the
	// buyer's own registration reserved.
	const claimable = Boolean(
		order &&
			((order.status === 'open' && purchaseOrderMatches(order, source)) ||
				(order.status === 'reserved' &&
					order.buyer === buyer &&
					(order.reservedUntil ?? 0) >= tip + inclusionMargin &&
					purchaseOrderMatches(order, fill)))
	);
	return Boolean(order && claimable && buyer !== order.creator && buyer !== order.recipient);
}

function purchaseOrderMatches(order: SwapOrder, expected: SwapOrder): boolean {
	return (
		order.creator === expected.creator &&
		order.recipient === expected.recipient &&
		order.asking === expected.asking &&
		order.deposit === expected.deposit &&
		order.minimumFee === expected.minimumFee &&
		order.deadline === expected.deadline &&
		order.createdAt === expected.createdAt &&
		order.quantity === expected.quantity
	);
}

function isAmbiguousDispatchError(error: unknown): boolean {
	return !(
		error &&
		typeof error === 'object' &&
		((error as { code?: unknown }).code === 'transaction-dispatch-not-sent' ||
			(error as { code?: unknown }).code === 'transaction-dispatch-rejected')
	);
}

export function waitUntilSeen(watcher: TxWatcher, timeout: number, signal: AbortSignal): Promise<boolean> {
	if (signal.aborted) return Promise.reject(signal.reason);
	if (watcher.consensus().seen > 0) return Promise.resolve(true);
	return new Promise((resolve, reject) => {
		const finish = (seen: boolean) => {
			clearTimeout(timer);
			off();
			signal.removeEventListener('abort', abort);
			resolve(seen);
		};
		const off = watcher.on('consensus', (consensus) => {
			if (consensus.seen > 0) finish(true);
		});
		const abort = () => {
			clearTimeout(timer);
			off();
			reject(signal.reason);
		};
		const timer = setTimeout(() => finish(false), timeout);
		signal.addEventListener('abort', abort, { once: true });
	});
}
