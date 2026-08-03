import Arweave from 'arweave';
import type {
	ObserverView,
	PreparedTransaction,
	PurchaseAdapter,
	TxWatcher,
	VerificationUpdate,
	WeaveNetwork,
} from 'weave-wrangler';

import { GATEWAYS } from 'helpers/config';

import { ArweaveObserverNetwork } from './arweave-observers';
import { type AssetState, readAssetState, type SwapOrder, waitForAssetState } from './asset-marketplace';

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const SIGNED_TRANSACTION_PREFIX = 'bazar-signed-transaction:';
export const DEFAULT_REGISTRATION_FEE = 100_000_000n;
export const ASSET_TRANSACTION_CONFIRMATION_TARGET = 5;
/** No asset offer may exceed the maximum 66 million AR supply. */
export const MAXIMUM_ASSET_OFFER_PRICE = 66_000_000_000_000_000_000n;
const DEFAULT_OFFER_DEADLINE = 20;
const SIGNATURE_WINDOW_BLOCKS = 40;
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

type SafePreparedTransaction = PreparedTransaction & {
	cost: bigint;
	setRequiredBalance(required: bigint): void;
};

type TransactionFields = {
	target?: string;
	quantity?: string;
	rewardFloor?: string;
	data?: string;
	tags: Array<{ name: string; value: string }>;
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
	deadline?: number;
	seller?: string;
};

export type PurchaseAdapterInput = {
	processId: string;
	order: SwapOrder;
	buyer: string;
	startingBalance: string;
	network: WeaveNetwork;
};

export type PreparedPurchase = {
	order: SwapOrder;
	registration: PreparedTransaction;
	payment: PreparedTransaction;
	paymentCost: string;
	snapshot: {
		registration: { id: string; dispatched: false };
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
	#arweave: any;
	#gateway: string;
	#storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & Partial<Pick<Storage, 'key' | 'length'>>;
	#reservationInclusionMargin: number;
	#height?: { at: number; value: Promise<number> };

	constructor(options: AssetTransactionClientOptions = {}) {
		this.#wallet = options.wallet ?? globalThis.window?.arweaveWallet;
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
		this.#arweave =
			options.arweave ??
			Arweave.init({
				host: GATEWAYS.default.host,
				port: 443,
				protocol: GATEWAYS.default.protocol,
			});
		this.#gateway = options.gateway ?? `${GATEWAYS.default.protocol}://${GATEWAYS.default.host}`;
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
		if (!ADDRESS.test(processId) || !ADDRESS.test(recipient)) {
			throw new TypeError('invalid-asset-transfer');
		}
		assertTokenQuantity(quantity);
		return this.#prepare(
			{
				target: processId,
				quantity: '1',
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
				{ fetch: this.#fetch, signal, timeout: STATE_INCLUSION_TIMEOUT }
			)
		).state;
	}

	async waitForOrderCancelled(processId: string, orderId: string, signal?: AbortSignal): Promise<AssetState> {
		return (
			await waitForAssetState(processId, (state) => state.orders[orderId] === undefined, {
				fetch: this.#fetch,
				signal,
				timeout: STATE_INCLUSION_TIMEOUT,
			})
		).state;
	}

	async waitForAssetBalance(
		processId: string,
		owner: string,
		minimum: string,
		signal?: AbortSignal
	): Promise<AssetState> {
		assertTokenQuantity(minimum);
		return (
			await waitForAssetState(processId, (state) => BigInt(state.balances[owner] ?? '0') >= BigInt(minimum), {
				fetch: this.#fetch,
				signal,
				timeout: STATE_INCLUSION_TIMEOUT,
			})
		).state;
	}

	async waitForPurchaseBatch(
		processId: string,
		buyer: string,
		startingBalance: string,
		orders: SwapOrder[],
		signal?: AbortSignal
	): Promise<AssetState> {
		if (!ADDRESS.test(processId) || !ADDRESS.test(buyer) || !orders.length) {
			throw new TypeError('invalid-purchase-batch');
		}
		assertTokenQuantity(startingBalance, true);
		const expectedBalance = orders
			.reduce((total, order) => total + BigInt(order.quantity), BigInt(startingBalance))
			.toString();
		const orderIds = new Set(orders.map((order) => order.orderId));
		if (orderIds.size !== orders.length) throw new TypeError('duplicate-purchase-batch-order');
		return (
			await waitForAssetState(
				processId,
				(state) =>
					[...orderIds].every((orderId) => state.orders[orderId] === undefined) &&
					BigInt(state.balances[buyer] ?? '0') >= BigInt(expectedBalance),
				{ fetch: this.#fetch, signal, timeout: STATE_INCLUSION_TIMEOUT }
			)
		).state;
	}

	purchaseAdapter(input: PurchaseAdapterInput): PurchaseAdapter {
		assertSafePurchaseOrder(input.order);
		assertTokenQuantity(input.startingBalance, true);
		const prepareRegistration = (signal: AbortSignal) =>
			this.#prepare(
				{
					target: input.processId,
					quantity: '1',
					rewardFloor: input.order.minimumFee,
					tags: [
						{ name: 'action', value: 'register-interest' },
						{ name: 'order-id', value: input.order.orderId },
					],
				},
				signal,
				undefined,
				input.buyer
			);
		const preparePayment = async (signal: AbortSignal) => {
			const tip = Math.max(await this.#currentHeight(signal), input.network.tip());
			const storedPaymentId = this.findStoredPayment(
				input.order.recipient,
				input.order.orderId,
				input.order.asking,
				input.buyer,
				tip
			);
			if (storedPaymentId) {
				return this.restore(storedPaymentId, input.buyer) as SafePreparedTransaction;
			}

			return this.#prepare(
				{
					target: input.order.recipient,
					quantity: input.order.asking,
					tags: [{ name: 'order-id', value: input.order.orderId }],
				},
				signal,
				tip + SIGNATURE_WINDOW_BLOCKS,
				input.buyer
			);
		};

		return {
			prepareRegistration,
			preparePayment: (_registrationId, signal) => preparePayment(signal),
			prepareBoth: async (signal) => {
				await this.#assertActiveSigner(input.buyer);
				const tip = Math.max(await this.#currentHeight(signal), input.network.tip());
				await this.#requireProcessState(
					input.processId,
					(state) => isExactOpenOrder(state, input.order, input.buyer, tip, this.#reservationInclusionMargin),
					'asset-order-not-purchasable',
					signal
				);
				const registration = await prepareRegistration(signal);
				const payment = await preparePayment(signal);
				registration.setRequiredBalance(registration.cost + payment.cost);
				payment.setRequiredBalance(payment.cost);
				await this.#assertBalance(input.buyer, registration.cost + payment.cost);
				return { registration, payment };
			},
			// A persisted payment may have reached Arweave before its dispatched
			// bit was written. Always replay that exact ID; never expire it into a
			// second native-AR payment whose first dispatch remains ambiguous.
			restorePrepared: async (which, id) =>
				this.restore(id, input.buyer, { preserveExpiry: which !== 'payment' }),
			waitForRegistrationAcceptance: async ({ signal, report }) => {
				await waitForAssetState(
					input.processId,
					async (state) => {
						const order = state.orders[input.order.orderId];
						const tip = Math.max(await this.#currentHeight(signal), input.network.tip());
						return Boolean(
							order &&
								order.status === 'reserved' &&
								order.buyer === input.buyer &&
								(order.reservedUntil ?? 0) >= tip + this.#reservationInclusionMargin
						);
					},
					{
						fetch: this.#fetch,
						signal,
						timeout: STATE_INCLUSION_TIMEOUT,
						onAttempt: (provider, attempt, total) =>
							reportProvider(report, provider, attempt, total, 'checking-reservation'),
					}
				);
			},
			verifyOwnership: async ({ signal, report }) => {
				const expectedBalance = (BigInt(input.startingBalance) + BigInt(input.order.quantity)).toString();
				await waitForAssetState(
					input.processId,
					(state) =>
						state.orders[input.order.orderId] === undefined &&
						BigInt(state.balances[input.buyer] ?? '0') >= BigInt(expectedBalance),
					{
						fetch: this.#fetch,
						signal,
						timeout: STATE_INCLUSION_TIMEOUT,
						onAttempt: (provider, attempt, total) =>
							reportProvider(report, provider, attempt, total, 'checking-ownership'),
					}
				);
			},
		};
	}

	async preparePurchaseBatch(
		inputs: PurchaseAdapterInput[],
		signal?: AbortSignal
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
		const estimates = await Promise.all(
			inputs.map((input) => this.estimatePurchaseCosts(input.order, input.processId))
		);
		await this.#assertBalance(
			buyer,
			estimates.reduce((total, estimate) => total + BigInt(estimate.total), 0n)
		);

		const prepared: Array<PreparedPurchase & { cost: bigint }> = [];
		for (const input of inputs) {
			if (signal?.aborted) throw signal.reason;
			const adapter = this.purchaseAdapter(input);
			if (!adapter.prepareBoth) throw new Error('purchase-presign-unavailable');
			const pair = await adapter.prepareBoth(signal ?? new AbortController().signal);
			const registration = pair.registration as SafePreparedTransaction;
			const payment = pair.payment as SafePreparedTransaction;
			prepared.push({
				order: input.order,
				registration,
				payment,
				paymentCost: payment.cost.toString(),
				snapshot: {
					registration: { id: registration.id, dispatched: false },
				},
				cost: registration.cost + payment.cost,
			});
		}
		await this.#assertBalance(
			buyer,
			prepared.reduce((total, item) => total + item.cost, 0n)
		);
		return prepared.map(({ cost: _cost, ...item }) => item);
	}

	restore(
		id: string,
		expectedSigner?: string,
		options: { preserveExpiry?: boolean } = {}
	): PreparedTransaction {
		if (!ADDRESS.test(id)) throw new TypeError('invalid-signed-transaction-id');
		const held = this.#storage?.getItem(`${SIGNED_TRANSACTION_PREFIX}${id}`);
		if (!held) throw new Error('signed-transaction-not-found');
		const stored = JSON.parse(held);
		const transaction = stored.transaction ?? stored;
		if (transaction.id !== id) throw new Error('signed-transaction-id-mismatch');
		assertZeroDataTransaction(transaction);
		if (stored.expectedSigner && expectedSigner && stored.expectedSigner !== expectedSigner) {
			throw new Error('signed-transaction-signer-mismatch');
		}
		return this.#prepared(
			transaction,
			options.preserveExpiry === false ? undefined : stored.validUntilHeight,
			expectedSigner ?? stored.expectedSigner,
			stored.requiredBalance === undefined ? undefined : BigInt(stored.requiredBalance)
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
		orderId: string,
		asking: string,
		expectedSigner: string,
		minimumValidHeight?: number
	): string | null {
		if (![recipient, orderId, expectedSigner].every((value) => ADDRESS.test(value)) || !/^[1-9]\d*$/.test(asking)) {
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

	async estimatePurchaseCost(order: SwapOrder, processId: string): Promise<bigint> {
		return BigInt((await this.estimatePurchaseCosts(order, processId)).total);
	}

	async estimatePurchaseCosts(order: SwapOrder, processId: string): Promise<PurchaseCostEstimate> {
		assertSafePurchaseOrder(order);
		const [registrationReward, paymentReward] = await Promise.all([
			this.#price(processId),
			this.#price(order.recipient),
		]);
		const asking = BigInt(order.asking);
		const registrationFee = BigInt(order.minimumFee);
		return {
			asking: asking.toString(),
			registrationFee: registrationFee.toString(),
			registrationNetworkReward: registrationReward.toString(),
			paymentNetworkReward: paymentReward.toString(),
				total: (asking + maxBigInt(registrationReward, registrationFee) + paymentReward + 1n).toString(),
		};
	}

	async walletBalance(address: string): Promise<bigint> {
		const response = await this.#fetch(`${this.#gateway}/wallet/${address}/balance`);
		if (!response.ok) throw new Error(`wallet-balance-${response.status}`);
		const value = (await response.text()).trim();
		return BigInt(value);
	}

	async #price(target: string): Promise<bigint> {
		const response = await this.#fetch(`${this.#gateway}/price/0/${target}`);
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

		const transaction = await this.#arweave.createTransaction(
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
		for (const tag of fields.tags) transaction.addTag(tag.name, tag.value);

		const signed = (await this.#wallet.sign(transaction)) ?? transaction;
		if (!ADDRESS.test(signed.id)) throw new Error('wallet-returned-unsigned-transaction');
		const serializable = typeof signed.toJSON === 'function' ? signed.toJSON() : JSON.parse(JSON.stringify(signed));
		serializable.id = signed.id;
		assertZeroDataTransaction(serializable);
		if (expectedSigner) await this.#assertSigner(serializable, expectedSigner);
		const requiredBalance = transactionCost(serializable);
		this.#storage?.setItem(
			`${SIGNED_TRANSACTION_PREFIX}${signed.id}`,
			JSON.stringify({
				transaction: serializable,
				...(validUntilHeight === undefined ? {} : { validUntilHeight }),
				...(expectedSigner ? { expectedSigner } : {}),
				...(expectedSigner ? { requiredBalance: requiredBalance.toString() } : {}),
			})
		);
		return this.#prepared(serializable, validUntilHeight, expectedSigner, requiredBalance);
	}

	#prepared(
		transaction: Record<string, unknown>,
		validUntilHeight?: number,
		expectedSigner?: string,
		initialRequiredBalance?: bigint
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
				this.#storage?.setItem(`${SIGNED_TRANSACTION_PREFIX}${id}`, JSON.stringify(stored));
			},
			dispatch: async (signal) => {
				assertZeroDataTransaction(transaction);
				if (expectedSigner) {
					await this.#assertSigner(transaction, expectedSigner);
					await this.#assertBalance(expectedSigner, requiredBalance);
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
				throw new Error(`transaction-dispatch-${response.status}: ${(await response.text()).slice(0, 240)}`);
			},
		};
	}

	async #assertSigner(transaction: Record<string, unknown>, expectedSigner: string): Promise<void> {
		const owner = String(transaction.owner ?? '');
		if (!owner || !this.#arweave.wallets?.ownerToAddress) {
			throw new Error('signed-transaction-owner-unavailable');
		}
		if ((await this.#arweave.wallets.ownerToAddress(owner)) !== expectedSigner) {
			throw new Error('wallet-account-changed');
		}
	}

	async #assertActiveSigner(expectedSigner: string): Promise<void> {
		if (this.#wallet.getActiveAddress && (await this.#wallet.getActiveAddress()) !== expectedSigner) {
			throw new Error('wallet-account-changed');
		}
	}

	async #assertBalance(address: string, required: bigint): Promise<void> {
		if ((await this.walletBalance(address)) < required) {
			throw new Error('asset-purchase-insufficient-funds');
		}
	}

	async #currentHeight(signal: AbortSignal): Promise<number> {
		const now = Date.now();
		if (!this.#height || now - this.#height.at > 1000) {
			this.#height = {
				at: now,
				value: this.#fetch(`${this.#gateway}/info`, {
					cache: 'no-store',
					signal,
				}).then(async (response) => {
					if (!response.ok) throw new Error(`network-info-${response.status}`);
					const height = Number((await response.json()).height);
					if (!Number.isSafeInteger(height) || height < 0) {
						throw new Error('invalid-network-height');
					}
					return height;
				}),
			};
		}
		return this.#height.value;
	}

	async #requireProcessState(
		processId: string,
		accept: (state: AssetState) => boolean,
		errorCode: string,
		signal?: AbortSignal
	): Promise<void> {
		try {
			const { state } = await readAssetState(processId, { fetch: this.#fetch, signal });
			if (!accept(state)) throw new Error(errorCode);
		} catch (error) {
			if (signal?.aborted) throw error;
			throw new Error(errorCode);
		}
	}
}

export async function dispatchAndConfirm(
	transaction: PreparedTransaction,
	options: {
		signal?: AbortSignal;
		target?: number;
		onProgress?: (progress: TransactionProgress) => void;
		onViews?: (views: ObserverView[]) => void;
	} = {}
): Promise<void> {
	const network = new ArweaveObserverNetwork({
		node: `${GATEWAYS.default.protocol}://${GATEWAYS.default.host}`,
		minObservers: 3,
		maxObservers: 12,
	});
	try {
		await network.ready();
		const watcher = network.watch(transaction.id, {
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
			const signal = options.signal ?? new AbortController().signal;
			let dispatchError: unknown;
			for (let attempt = 0; attempt < 2; attempt += 1) {
				try {
					await transaction.dispatch(signal);
					dispatchError = undefined;
					break;
				} catch (error) {
					dispatchError = error;
					if (isAmbiguousDispatchError(error) && (await waitUntilSeen(watcher, 15_000, signal))) {
						dispatchError = undefined;
						break;
					}
					if (!isAmbiguousDispatchError(error)) break;
				}
			}
			if (dispatchError) throw dispatchError;
			await settlement;
		} finally {
			watcher.stop();
		}
	} finally {
		network.stop();
	}
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

function transactionCost(transaction: Record<string, unknown>): bigint {
	return BigInt(String(transaction.quantity ?? '0')) + BigInt(String(transaction.reward ?? '0'));
}

function transactionTagMatches(tags: unknown, expectedName: string, expectedValue: string): boolean {
	if (!Array.isArray(tags)) return false;
	return tags.some((tag) => {
		if (!tag || typeof tag !== 'object') return false;
		const record = tag as Record<string, unknown>;
		return (
			transactionTagValues(record.name).includes(expectedName) &&
			transactionTagValues(record.value).includes(expectedValue)
		);
	});
}

function transactionTagValues(value: unknown): string[] {
	if (typeof value !== 'string') return [];
	try {
		return [value, Arweave.utils.b64UrlToString(value)];
	} catch {
		return [value];
	}
}

function isExactOpenOrder(
	state: AssetState,
	expected: SwapOrder,
	buyer: string,
	tip: number,
	inclusionMargin: number
): boolean {
	const order = state.orders[expected.orderId];
	// An order reserved for this buyer is still theirs to complete: without
	// this, a retry after a verification timeout refuses the very order the
	// buyer's own registration reserved.
	const claimable =
		order &&
		(order.status === 'open' ||
			(order.status === 'reserved' &&
				order.buyer === buyer &&
				(order.reservedUntil ?? 0) >= tip + inclusionMargin));
	return Boolean(
		order &&
			claimable &&
			buyer !== order.creator &&
			buyer !== order.recipient &&
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
	return !(error instanceof Error && /^transaction-dispatch-4\d\d:/.test(error.message));
}

function waitUntilSeen(watcher: TxWatcher, timeout: number, signal: AbortSignal): Promise<boolean> {
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
