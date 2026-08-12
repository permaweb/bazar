import { describe, expect, it, vi } from 'vitest';
import { SwapPurchase, TransactionDispatchNotSentError, TransactionDispatchRejectedError } from 'weave-wrangler';

import { parseAssetState, type SwapOrder } from './asset-marketplace';
import {
	assertExactCancelAssignment,
	assertExactFungibleTransferAssignment,
	assertExactPurchaseAssignment,
	AssetTransactionClient,
	cancelAppliedAtSlot,
	fungibleTransferAppliedAtSlot,
	purchaseAppliedAtSlot,
	waitUntilSeen,
} from './asset-transactions';

const processId = 'IMKioUfmOrqtTnrLO3_Jpg5zv8zg8PKjWYNVhD3xsZM';
const seller = '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw';
const recipient = 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc';
const transactionId = 'qAhWNMSuX70lZpIRohKJn_SuVcymr_RmpGbltydjpwA';
const orderId = 'o'.repeat(43);

function transferState(
	slot: number,
	senderBalance: string,
	recipientBalance: string,
	orders: Record<string, unknown> = {}
) {
	return parseAssetState({
		'execution-device': 'token@1.0',
		'at-slot': slot,
		'total-supply': '1000',
		balances: { [seller]: senderBalance, [recipient]: recipientBalance },
		orders,
	});
}

function scheduledAssignment(slot: number, signedId: string, blockHeight = 51) {
	return {
		'block-height': blockHeight,
		body: {
			action: 'transfer',
			commitments: {
				[signedId]: {
					'commitment-device': 'tx@1.0',
					committer: seller,
					committed: ['action', 'recipient', 'quantity', 'target'],
					'field-quantity': undefined as string | undefined,
					'field-target': processId,
					'original-tags': {
						1: { name: 'action', value: 'transfer' },
						2: { name: 'recipient', value: recipient },
						3: { name: 'quantity', value: '10' },
					},
				},
			},
			quantity: '10',
			recipient,
			target: processId,
		},
		process: processId,
		slot,
	};
}

function scheduledCancelAssignment(slot: number, signedId: string, blockHeight = 51) {
	return {
		'block-height': blockHeight,
		body: {
			action: 'cancel-order',
			commitments: {
				[signedId]: {
					'commitment-device': 'tx@1.0',
					committer: seller,
					committed: ['action', 'order-id', 'target'],
					'field-target': processId,
				},
			},
			'order-id': orderId,
			target: processId,
		},
		process: processId,
		slot,
	};
}

function scheduledPurchaseAssignment(
	slot: number,
	signedId: string,
	expected: ReturnType<typeof swapOrder>,
	buyer = recipient,
	blockHeight = 51
) {
	return {
		'block-height': blockHeight,
		body: {
			commitments: {
				[signedId]: {
					'commitment-device': 'tx@1.0',
					committer: buyer,
					committed: ['order-id', 'quantity', 'target'],
					'field-target': expected.recipient,
				},
			},
			'order-id': expected.orderId,
			quantity: expected.asking,
			target: expected.recipient,
		},
		process: processId,
		slot,
	};
}

function transferNotices(quantity: string) {
	return [
		{ action: 'Credit-Notice', quantity, sender: seller, target: recipient },
		{ action: 'Debit-Notice', quantity, recipient, target: seller },
	];
}

function cancelOrderRaw(quantity = '10') {
	return {
		asking: '1000',
		'created-at': 1,
		creator: seller,
		deadline: 20,
		deposit: '0',
		'minimum-fee': '100000000',
		'order-id': orderId,
		quantity,
		recipient: seller,
		status: 'open',
	};
}

function reservedPurchaseOrderRaw(expected: ReturnType<typeof swapOrder>, buyer = recipient) {
	return {
		asking: expected.asking,
		buyer,
		'created-at': expected.createdAt,
		creator: expected.creator,
		deadline: expected.deadline,
		deposit: expected.deposit,
		'minimum-fee': expected.minimumFee,
		'order-id': expected.orderId,
		quantity: expected.quantity,
		recipient: expected.recipient,
		'reserved-until': 60,
		status: 'reserved',
	};
}

function decodedTags(transaction: { tags: Array<{ name: string; value: string }> }) {
	return transaction.tags.map((tag) => ({
		name: Buffer.from(tag.name, 'base64url').toString(),
		value: Buffer.from(tag.value, 'base64url').toString(),
	}));
}

function client(
	sign: (transaction: any) => Promise<any> = async (transaction) => transaction,
	fetchResponse?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
	verify: (transaction: any) => Promise<boolean> = async () => true
) {
	const values = new Map<string, string>();
	const requests: string[] = [];
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
		key: (index: number) => [...values.keys()][index] ?? null,
		get length() {
			return values.size;
		},
	};
	const arweave = {
		createTransaction: async ({ target, quantity, data }: Record<string, string>) => {
			const transaction: any = {
				id: transactionId,
				owner: 'owner-key',
				target,
				quantity,
				data,
				reward: '1000',
				tags: [] as Array<{ name: string; value: string }>,
				addTag(name: string, value: string) {
					this.tags.push({ name, value });
				},
				setSignature({ id, owner, reward, tags, signature }: Record<string, any>) {
					this.id = id;
					this.owner = owner;
					if (reward) this.reward = reward;
					if (tags) this.tags = tags;
					this.signature = signature;
				},
				toJSON() {
					return {
						...this,
						addTag: undefined,
						setSignature: undefined,
						toJSON: undefined,
						tags: this.tags.map((tag: { name: string; value: string }) => ({
							name: Buffer.from(tag.name).toString('base64url'),
							value: Buffer.from(tag.value).toString('base64url'),
						})),
					};
				},
			};
			return transaction;
		},
		transactions: { verify },
		wallets: { ownerToAddress: async () => seller },
	};
	return {
		storage,
		arweave,
		requests,
		client: new AssetTransactionClient({
			wallet: {
				getActiveAddress: async () => seller,
				sign,
			},
			arweave,
			storage,
			fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
				requests.push(String(input));
				if (fetchResponse) return fetchResponse(input, init);
				return new Response('1000000000000');
			},
		}),
	};
}

describe('fungible asset transactions', () => {
	it('does not start an ambiguity wait after its operation was already aborted', async () => {
		const controller = new AbortController();
		controller.abort(new Error('route changed'));
		const watcher = {
			consensus: () => ({ seen: 0 }),
			on: () => {
				throw new Error('An aborted wait must not subscribe.');
			},
		} as any;

		await expect(waitUntilSeen(watcher, 15_000, controller.signal)).rejects.toBe(controller.signal.reason);
	});

	it('puts the exact token lot in offer-quantity while sending only the scheduler dust', async () => {
		const subject = client();
		const prepared = await subject.client.makeOffer({
			processId,
			quantity: '3500000000000',
			asking: '700000000000',
			seller,
		});
		const stored = JSON.parse(subject.storage.getItem(`bazar-signed-transaction:${prepared.id}`)!);
		expect(prepared.id).toBe(transactionId);
		expect(stored.transaction.quantity).toBe('1');
		expect(decodedTags(stored.transaction)).toContainEqual({ name: 'offer-quantity', value: '3500000000000' });
		expect(decodedTags(stored.transaction)).toContainEqual({ name: 'asking', value: '700000000000' });
	});

	it('verifies listing acceptance from uncached live process state', async () => {
		const subject = client(undefined, async () =>
			Response.json({
				'execution-device': 'token@1.0',
				'total-supply': '10',
				balances: { [seller]: '9' },
				orders: { [orderId]: cancelOrderRaw() },
			})
		);

		await subject.client.waitForOfferAcceptance(processId, {
			orderId,
			seller,
			quantity: '10',
			asking: '1000',
			minimumFee: '100000000',
		});

		expect(subject.requests).toHaveLength(1);
		expect(subject.requests[0]).toContain('/now/remove~message@1.0&item=data?require-codec=');
	});

	it('leaves native AR at zero so tx@1.0 promotes the token quantity tag', async () => {
		const subject = client();
		const prepared = await subject.client.transfer(processId, recipient, '12500000000000', seller);
		const stored = JSON.parse(subject.storage.getItem(`bazar-signed-transaction:${prepared.id}`)!);
		expect((prepared as typeof prepared & { cost: bigint }).cost).toBe(1000n);
		expect(stored.transaction.quantity).toBe('0');
		expect(decodedTags(stored.transaction)).toContainEqual({
			name: 'quantity',
			value: '12500000000000',
		});
	});

	it('verifies the base64url tag representation emitted by Arweave transaction JSON', async () => {
		const subject = client();
		const prepared = await subject.client.transfer(processId, recipient, '12500000000000', seller);
		const stored = JSON.parse(subject.storage.getItem(`bazar-signed-transaction:${prepared.id}`)!);
		expect(stored.transaction.tags).toContainEqual({
			name: Buffer.from('recipient').toString('base64url'),
			value: Buffer.from(recipient).toString('base64url'),
		});
	});

	it('applies Wander signature fields to the original transaction before validating its intent', async () => {
		const subject = client(async (transaction) => ({
			id: transaction.id,
			owner: transaction.owner,
			reward: transaction.reward,
			tags: transaction.tags,
			signature: 'wallet-signature',
		}));

		const prepared = await subject.client.transfer(processId, recipient, '12500000000000', seller);
		const stored = JSON.parse(subject.storage.getItem(`bazar-signed-transaction:${prepared.id}`)!);

		expect(stored.transaction.target).toBe(processId);
		expect(stored.transaction.quantity).toBe('0');
		expect(stored.transaction.signature).toBe('wallet-signature');
		expect(decodedTags(stored.transaction)).toContainEqual({ name: 'recipient', value: recipient });
	});

	it('accepts Wander finalizing the cancellation reward and stores that exact signed intent', async () => {
		const subject = client(async (transaction) => ({
			id: transaction.id,
			owner: transaction.owner,
			reward: '2000',
			tags: transaction.tags,
			signature: 'wallet-signature',
		}));

		const prepared = await subject.client.cancelOrder(processId, orderId, seller);
		const stored = JSON.parse(subject.storage.getItem(`bazar-signed-transaction:${prepared.id}`)!);

		expect(stored.transaction.target).toBe(processId);
		expect(stored.transaction.quantity).toBe('1');
		expect(stored.transaction.reward).toBe('2000');
		expect(stored.intent.reward).toBe('2000');
		expect(decodedTags(stored.transaction)).toEqual([
			{ name: 'action', value: 'cancel-order' },
			{ name: 'order-id', value: orderId },
		]);
	});

	it('accepts Wander merging signed metadata and identical business tags into its response', async () => {
		const subject = client(async (transaction) => ({
			id: transaction.id,
			owner: transaction.owner,
			reward: transaction.reward,
			tags: [...transaction.tags, ...transaction.tags, { name: 'App-Name', value: 'Wander' }],
			signature: 'wallet-signature',
		}));

		const prepared = await subject.client.cancelOrder(processId, orderId, seller);
		const stored = JSON.parse(subject.storage.getItem(`bazar-signed-transaction:${prepared.id}`)!);

		expect(decodedTags(stored.transaction)).toEqual([
			{ name: 'action', value: 'cancel-order' },
			{ name: 'order-id', value: orderId },
			{ name: 'action', value: 'cancel-order' },
			{ name: 'order-id', value: orderId },
			{ name: 'App-Name', value: 'Wander' },
		]);
	});

	it('rejects a conflicting duplicate business tag returned by the wallet', async () => {
		const subject = client(async (transaction) => ({
			id: transaction.id,
			owner: transaction.owner,
			reward: transaction.reward,
			tags: [...transaction.tags, { name: 'action', value: 'make-offer' }],
			signature: 'wallet-signature',
		}));

		await expect(subject.client.cancelOrder(processId, orderId, seller)).rejects.toThrow(
			'wallet-modified-transaction-fields'
		);
		expect(subject.storage.getItem(`bazar-signed-transaction:${transactionId}`)).toBeNull();
	});

	it('rejects signed fields that do not verify against the reconstructed transaction', async () => {
		const subject = client(undefined, undefined, async () => false);

		await expect(subject.client.cancelOrder(processId, orderId, seller)).rejects.toThrow(
			'wallet-returned-invalid-signature'
		);
		expect(subject.storage.getItem(`bazar-signed-transaction:${transactionId}`)).toBeNull();
	});

	it('rejects a noncanonical raw wire tag before persistence', async () => {
		const subject = client(async (transaction) => {
			const toJSON = transaction.toJSON.bind(transaction);
			transaction.toJSON = () => {
				const json = toJSON();
				json.tags[0].name = 'action';
				return json;
			};
			return transaction;
		});
		await expect(subject.client.transfer(processId, recipient, '12500000000000', seller)).rejects.toThrow(
			'wallet-modified-transaction-fields'
		);
		expect(subject.storage.getItem(`bazar-signed-transaction:${transactionId}`)).toBeNull();
	});

	it.each([
		[
			'native quantity',
			(transaction: any) => {
				transaction.quantity = '2';
			},
		],
		[
			'process target',
			(transaction: any) => {
				transaction.target = recipient;
			},
		],
		[
			'recipient',
			(transaction: any) => {
				transaction.tags.find((tag: { name: string }) => tag.name === 'recipient').value = seller;
			},
		],
		[
			'token quantity',
			(transaction: any) => {
				transaction.tags.find((tag: { name: string }) => tag.name === 'quantity').value = '1';
			},
		],
		[
			'action',
			(transaction: any) => {
				transaction.tags.find((tag: { name: string }) => tag.name === 'action').value = 'make-offer';
			},
		],
	])('rejects a wallet-modified transfer %s before persistence', async (_field, mutate) => {
		const subject = client(async (transaction) => {
			mutate(transaction);
			return transaction;
		});
		await expect(subject.client.transfer(processId, recipient, '12500000000000', seller)).rejects.toThrow(
			'wallet-modified-transaction-fields'
		);
		expect(subject.storage.getItem(`bazar-signed-transaction:${transactionId}`)).toBeNull();
	});

	it('rejects a persisted transaction that no longer matches its approved intent', async () => {
		const subject = client();
		const prepared = await subject.client.transfer(processId, recipient, '12500000000000', seller);
		const key = `bazar-signed-transaction:${prepared.id}`;
		const stored = JSON.parse(subject.storage.getItem(key)!);
		stored.transaction.quantity = '2';
		subject.storage.setItem(key, JSON.stringify(stored));

		expect(() => subject.client.restore(prepared.id, seller)).toThrow('wallet-modified-transaction-fields');
		expect(subject.requests).toEqual([]);
	});

	it('rechecks approved intent immediately before dispatch', async () => {
		let serializedTransaction: any;
		const subject = client(async (transaction) => {
			const toJSON = transaction.toJSON.bind(transaction);
			transaction.toJSON = () => {
				serializedTransaction = toJSON();
				return serializedTransaction;
			};
			return transaction;
		});
		const prepared = await subject.client.transfer(processId, recipient, '12500000000000', seller);
		serializedTransaction.target = recipient;

		await expect(prepared.dispatch(new AbortController().signal)).rejects.toBeInstanceOf(
			TransactionDispatchNotSentError
		);
		expect(subject.requests).toEqual([]);
	});

	it('rejects a reward changed after signing before dispatch', async () => {
		let serializedTransaction: any;
		const subject = client(async (transaction) => {
			const toJSON = transaction.toJSON.bind(transaction);
			transaction.toJSON = () => {
				serializedTransaction = toJSON();
				return serializedTransaction;
			};
			return transaction;
		});
		const prepared = await subject.client.cancelOrder(processId, orderId, seller);
		serializedTransaction.reward = '999999';

		await expect(prepared.dispatch(new AbortController().signal)).rejects.toBeInstanceOf(
			TransactionDispatchNotSentError
		);
		expect(subject.requests).toEqual([]);
	});

	it('classifies a demonstrated invalid-transaction response as terminal', async () => {
		const subject = client(undefined, async (input) =>
			String(input).endsWith('/tx')
				? new Response('invalid transaction', { status: 400 })
				: new Response('1000000000000')
		);
		const prepared = await subject.client.transfer(processId, recipient, '12500000000000', seller);

		let failure: unknown;
		try {
			await prepared.dispatch(new AbortController().signal);
		} catch (cause) {
			failure = cause;
		}
		expect(failure).toBeInstanceOf(TransactionDispatchRejectedError);
		expect(failure).toMatchObject({
			code: 'transaction-dispatch-rejected',
			httpStatus: 400,
		});
	});

	it.each([408, 425, 429])('keeps HTTP %s ambiguous so only the exact signed ID may be retried', async (status) => {
		const subject = client(undefined, async (input) =>
			String(input).endsWith('/tx') ? new Response('retry later', { status }) : new Response('1000000000000')
		);
		const prepared = await subject.client.transfer(processId, recipient, '12500000000000', seller);

		let failure: unknown;
		try {
			await prepared.dispatch(new AbortController().signal);
		} catch (cause) {
			failure = cause;
		}
		expect(failure).toBeInstanceOf(Error);
		expect(failure).not.toBeInstanceOf(TransactionDispatchRejectedError);
		expect((failure as Error).message).toContain(`transaction-dispatch-${status}`);
	});

	it('proves a purchase from its exact native-AR payment transition', () => {
		const expected = {
			...swapOrder(orderId, '10', '25'),
			creator: seller,
			recipient: seller,
		};
		const assignment = {
			slot: 11,
			blockHeight: 51,
			transactionIds: [transactionId],
			raw: scheduledPurchaseAssignment(11, transactionId, expected),
		};
		const before = transferState(10, '90', '2', {
			[orderId]: reservedPurchaseOrderRaw(expected),
		});
		const unrelatedGrowth = transferState(11, '90', '12', {
			[orderId]: reservedPurchaseOrderRaw(expected),
		});
		const wrongQuantity = transferState(11, '90', '13');
		const settled = transferState(11, '90', '12');

		expect(
			purchaseAppliedAtSlot(before, unrelatedGrowth, assignment, processId, transactionId, recipient, expected)
		).toBe(false);
		expect(
			purchaseAppliedAtSlot(before, wrongQuantity, assignment, processId, transactionId, recipient, expected)
		).toBe(false);
		expect(purchaseAppliedAtSlot(before, settled, assignment, processId, transactionId, recipient, expected)).toBe(
			true
		);
	});

	it('rejects incomplete exact payment evidence before reading it as settlement', () => {
		const expected = {
			...swapOrder(orderId, '10', '25'),
			creator: seller,
			recipient: seller,
		};
		const validRaw = scheduledPurchaseAssignment(11, transactionId, expected);
		const mutations: Array<(raw: any) => void> = [
			(raw) => {
				raw.process = recipient;
			},
			(raw) => {
				raw.body.commitments[transactionId].committer = seller;
			},
			(raw) => {
				raw.body.target = recipient;
			},
			(raw) => {
				raw.body['order-id'] = recipient;
			},
			(raw) => {
				raw.body.quantity = '26';
			},
			(raw) => {
				raw.body.commitments[transactionId].committed = ['quantity', 'target'];
			},
			(raw) => {
				delete raw.body.commitments[transactionId]['field-target'];
			},
		];

		for (const mutate of mutations) {
			const raw = structuredClone(validRaw);
			mutate(raw);
			expect(() =>
				assertExactPurchaseAssignment(
					{ slot: 11, blockHeight: 51, transactionIds: [transactionId], raw },
					processId,
					transactionId,
					recipient,
					expected
				)
			).toThrow('asset-purchase-proof-mismatch');
		}
	});

	it('verifies exact historical settlement after the buyer spends the purchased units', async () => {
		const expected = {
			...swapOrder(orderId, '10', '25'),
			creator: seller,
			recipient: seller,
		};
		const before = transferState(10, '90', '2', {
			[orderId]: reservedPurchaseOrderRaw(expected),
		});
		const settled = transferState(11, '90', '12');
		const later = transferState(12, '90', '0');
		const subject = new AssetTransactionClient({
			fetch: async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes(`/tx/${transactionId}/status`)) {
					return new Response(JSON.stringify({ block_height: 51 }));
				}
				if (url.includes('/now/remove~message@1.0')) return new Response(JSON.stringify(later.raw));
				const schedule = url.match(/schedule&from=(\d+)&to=(\d+)\/assignments/);
				if (schedule) {
					const assignments: Record<number, unknown> = {};
					for (let slot = Number(schedule[1]); slot <= Number(schedule[2]); slot += 1) {
						assignments[slot] = scheduledPurchaseAssignment(
							slot,
							slot === 11 ? transactionId : `p${String(slot).padStart(42, '0')}`,
							expected,
							recipient,
							slot < 11 ? 50 : slot === 11 ? 51 : 52
						);
					}
					return new Response(JSON.stringify(assignments));
				}
				if (url.includes('compute&slot=10/')) return new Response(JSON.stringify(before.raw));
				if (url.includes('compute&slot=11/')) return new Response(JSON.stringify(settled.raw));
				throw new Error(`unexpected-request:${url}`);
			},
		});
		const adapter = subject.purchaseAdapter({
			processId,
			order: expected,
			buyer: recipient,
			startingBalance: '2',
			network: { tip: () => 60 } as any,
		});

		await expect(
			adapter.verifyOwnership!({
				registrationId: 'R'.repeat(43),
				paymentId: transactionId,
				signal: new AbortController().signal,
				report: () => undefined,
			})
		).resolves.toBeUndefined();
	});

	it('proves cancellation from the exact scheduled transition rather than order absence', () => {
		const assignment = {
			slot: 11,
			blockHeight: 51,
			transactionIds: [transactionId],
			raw: scheduledCancelAssignment(11, transactionId),
		};
		const before = transferState(10, '90', '0', { [orderId]: cancelOrderRaw() });
		const absentWithoutCredit = transferState(11, '90', '0');
		const cancelled = transferState(11, '100', '0');

		expect(
			cancelAppliedAtSlot(before, absentWithoutCredit, assignment, processId, transactionId, seller, orderId)
		).toBe(false);
		expect(cancelAppliedAtSlot(before, cancelled, assignment, processId, transactionId, seller, orderId)).toBe(
			true
		);
	});

	it('rejects incomplete exact cancellation evidence before reading it as success', () => {
		const validRaw = scheduledCancelAssignment(11, transactionId);
		const mutations: Array<(raw: any) => void> = [
			(raw) => {
				raw.process = recipient;
			},
			(raw) => {
				raw.body.commitments[transactionId].committer = recipient;
			},
			(raw) => {
				raw.body.action = 'transfer';
			},
			(raw) => {
				raw.body['order-id'] = recipient;
			},
			(raw) => {
				raw.body.target = recipient;
			},
			(raw) => {
				raw.body.commitments[transactionId].committed = ['action', 'target'];
			},
			(raw) => {
				delete raw.body.commitments[transactionId]['field-target'];
			},
		];

		for (const mutate of mutations) {
			const raw = structuredClone(validRaw);
			mutate(raw);
			expect(() =>
				assertExactCancelAssignment(
					{ slot: 11, blockHeight: 51, transactionIds: [transactionId], raw },
					processId,
					transactionId,
					seller,
					orderId
				)
			).toThrow('asset-cancel-proof-mismatch');
		}
	});

	it('waits for the exact cancellation and treats a missing exact transition as rejection', async () => {
		const current = transferState(12, '100', '0');
		const before = transferState(11, '90', '0', { [orderId]: cancelOrderRaw() });
		const rejected = transferState(12, '90', '0', { [orderId]: cancelOrderRaw() });
		const expected = before.orders[orderId];
		const subject = new AssetTransactionClient({
			fetch: async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes(`/tx/${transactionId}/status`)) {
					return new Response(JSON.stringify({ block_height: 51 }));
				}
				if (url.includes('/now/remove~message@1.0')) return new Response(JSON.stringify(current.raw));
				const schedule = url.match(/schedule&from=(\d+)&to=(\d+)\/assignments/);
				if (schedule) {
					const assignments: Record<number, unknown> = {};
					for (let slot = Number(schedule[1]); slot <= Number(schedule[2]); slot += 1) {
						assignments[slot] = scheduledCancelAssignment(
							slot,
							slot === 12 ? transactionId : `c${String(slot).padStart(42, '0')}`,
							slot === 12 ? 51 : 50
						);
					}
					return new Response(JSON.stringify(assignments));
				}
				if (url.includes('compute&slot=11/')) return new Response(JSON.stringify(before.raw));
				if (url.includes('compute&slot=12/')) return new Response(JSON.stringify(rejected.raw));
				throw new Error(`unexpected-request:${url}`);
			},
		});

		await expect(
			subject.waitForExactCancellation(processId, transactionId, seller, expected, { startingSlot: 10 })
		).rejects.toThrow('asset-cancel-rejected');
	});

	it('accepts an exact cancellation transition even after later state changes', async () => {
		const current = transferState(13, '100', '0');
		const before = transferState(11, '90', '0', { [orderId]: cancelOrderRaw() });
		const cancelled = transferState(12, '100', '0');
		const expected = before.orders[orderId];
		const subject = new AssetTransactionClient({
			fetch: async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes(`/tx/${transactionId}/status`)) {
					return new Response(JSON.stringify({ block_height: 51 }));
				}
				if (url.includes('/now/remove~message@1.0')) return new Response(JSON.stringify(current.raw));
				const schedule = url.match(/schedule&from=(\d+)&to=(\d+)\/assignments/);
				if (schedule) {
					const assignments: Record<number, unknown> = {};
					for (let slot = Number(schedule[1]); slot <= Number(schedule[2]); slot += 1) {
						assignments[slot] = scheduledCancelAssignment(
							slot,
							slot === 12 ? transactionId : `d${String(slot).padStart(42, '0')}`,
							slot < 12 ? 50 : slot === 12 ? 51 : 52
						);
					}
					return new Response(JSON.stringify(assignments));
				}
				if (url.includes('compute&slot=11/')) return new Response(JSON.stringify(before.raw));
				if (url.includes('compute&slot=12/')) return new Response(JSON.stringify(cancelled.raw));
				throw new Error(`unexpected-request:${url}`);
			},
		});

		await expect(
			subject.waitForExactCancellation(processId, transactionId, seller, expected, { startingSlot: 10 })
		).resolves.toMatchObject({ raw: { 'at-slot': 12 } });
	});

	it('proves an exact-slot transfer from its paired notices rather than noisy balances', () => {
		const assignment = {
			slot: 11,
			blockHeight: 51,
			transactionIds: [transactionId],
			raw: scheduledAssignment(11, transactionId),
		};
		const applied = transferState(11, '140', '3');
		applied.raw.results = { outbox: transferNotices('10') };
		const rejected = transferState(11, '100', '107');

		expect(
			fungibleTransferAppliedAtSlot(rejected, assignment, processId, transactionId, seller, recipient, '10')
		).toBe(false);
		expect(
			fungibleTransferAppliedAtSlot(applied, assignment, processId, transactionId, seller, recipient, '10')
		).toBe(true);
	});

	it('accepts exact legacy transfers whose native quantity matched the token amount', () => {
		const raw = scheduledAssignment(11, transactionId);
		raw.body.quantity = '10';
		raw.body.commitments[transactionId]['field-quantity'] = '10';

		expect(() =>
			assertExactFungibleTransferAssignment(
				{ slot: 11, blockHeight: 51, transactionIds: [transactionId], raw },
				processId,
				transactionId,
				seller,
				recipient,
				'10'
			)
		).not.toThrow();
	});

	it('accepts transfers created by the previous one-winston workaround', () => {
		const raw = scheduledAssignment(11, transactionId);
		raw.body.quantity = '1';
		raw.body.commitments[transactionId]['field-quantity'] = '1';

		expect(() =>
			assertExactFungibleTransferAssignment(
				{ slot: 11, blockHeight: 51, transactionIds: [transactionId], raw },
				processId,
				transactionId,
				seller,
				recipient,
				'10'
			)
		).not.toThrow();
	});

	it('distinguishes incomplete scheduler proof from an exact token rejection', () => {
		const validRaw = scheduledAssignment(11, transactionId);
		const mutations: Array<(raw: any) => void> = [
			(raw) => {
				raw.process = recipient;
			},
			(raw) => {
				raw.body.commitments[transactionId].committer = recipient;
			},
			(raw) => {
				raw.body.recipient = seller;
			},
			(raw) => {
				raw.body.quantity = '11';
			},
			(raw) => {
				raw.body.commitments[transactionId]['field-quantity'] = '11';
			},
			(raw) => {
				raw.body.commitments[transactionId]['original-tags'][3].value = '11';
			},
			(raw) => {
				raw.body.commitments[transactionId]['original-tags'][4] = {
					name: 'Quantity',
					value: '10',
				};
			},
			(raw) => {
				raw.body.target = recipient;
			},
			(raw) => {
				raw.body.commitments[transactionId].committed = ['action', 'quantity', 'target'];
			},
			(raw) => {
				delete raw.body.commitments[transactionId]['field-target'];
			},
		];

		for (const mutate of mutations) {
			const raw = structuredClone(validRaw);
			mutate(raw);
			expect(() =>
				assertExactFungibleTransferAssignment(
					{ slot: 11, blockHeight: 51, transactionIds: [transactionId], raw },
					processId,
					transactionId,
					seller,
					recipient,
					'10'
				)
			).toThrow('fungible-transfer-proof-mismatch');
		}
	});

	it('reports incomplete exact-assignment evidence without reading it as rejection', async () => {
		const later = transferState(11, '100', '100');
		const mismatched = scheduledAssignment(11, transactionId);
		mismatched.body.commitments[transactionId].committer = recipient;
		let historicalReads = 0;
		const subject = new AssetTransactionClient({
			fetch: async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes(`/tx/${transactionId}/status`)) {
					return new Response(JSON.stringify({ block_height: 51 }));
				}
				if (url.includes('/now/remove~message@1.0')) return new Response(JSON.stringify(later.raw));
				if (url.includes('/schedule&from=11&to=11/assignments')) {
					return new Response(JSON.stringify({ 11: mismatched }));
				}
				if (url.includes('compute&slot=')) historicalReads += 1;
				throw new Error(`unexpected-request:${url}`);
			},
		});

		await expect(
			subject.waitForFungibleTransfer(processId, transactionId, seller, recipient, '10', { startingSlot: 10 })
		).rejects.toThrow('fungible-transfer-proof-mismatch');
		expect(historicalReads).toBe(0);
	});

	it('verifies the exact scheduled transfer even after later recipient spending', async () => {
		const before = transferState(11, '100', '100');
		const applied = transferState(12, '90', '110');
		applied.raw.results = { outbox: transferNotices('10') };
		const later = transferState(13, '140', '0');
		const fetcher = async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes(`/tx/${transactionId}/status`)) {
				return new Response(JSON.stringify({ block_height: 51 }));
			}
			if (url.includes('/now/remove~message@1.0')) return new Response(JSON.stringify(later.raw));
			const schedule = url.match(/schedule&from=(\d+)&to=(\d+)\/assignments/);
			if (schedule) {
				const assignments: Record<number, unknown> = {};
				for (let slot = Number(schedule[1]); slot <= Number(schedule[2]); slot += 1) {
					assignments[slot] = scheduledAssignment(
						slot,
						slot === 12 ? transactionId : String.fromCharCode(54 + slot).repeat(43)
					);
				}
				return new Response(JSON.stringify(assignments));
			}
			if (url.includes('compute&slot=11/')) return new Response(JSON.stringify(before.raw));
			if (url.includes('compute&slot=12/')) return new Response(JSON.stringify(applied.raw));
			throw new Error(`unexpected-request:${url}`);
		};
		const subject = new AssetTransactionClient({ fetch: fetcher as typeof fetch });

		await expect(
			subject.waitForFungibleTransfer(processId, transactionId, seller, recipient, '10', { startingSlot: 10 })
		).resolves.toMatchObject({ raw: { 'at-slot': 12 }, balances: { [recipient]: '110' } });
	});

	it('locates a late exact transfer in logarithmic schedule probes', async () => {
		const targetSlot = 99_999;
		const currentSlot = 100_000;
		const blockHeight = (slot: number) => Math.floor(slot / 5) + 100;
		const targetHeight = blockHeight(targetSlot);
		const current = transferState(currentSlot, '90', '110');
		const applied = transferState(targetSlot, '90', '110');
		applied.raw.results = { outbox: transferNotices('10') };
		let scheduleReads = 0;
		const subject = new AssetTransactionClient({
			fetch: async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes(`/tx/${transactionId}/status`)) {
					return new Response(JSON.stringify({ block_height: targetHeight }));
				}
				if (url.includes('/now/remove~message@1.0')) return new Response(JSON.stringify(current.raw));
				const schedule = url.match(/schedule&from=(\d+)&to=(\d+)\/assignments/);
				if (schedule) {
					scheduleReads += 1;
					const assignments: Record<number, unknown> = {};
					for (let slot = Number(schedule[1]); slot <= Number(schedule[2]); slot += 1) {
						assignments[slot] = scheduledAssignment(
							slot,
							slot === targetSlot ? transactionId : `x${String(slot).padStart(42, '0')}`,
							blockHeight(slot)
						);
					}
					return new Response(JSON.stringify(assignments));
				}
				if (url.includes(`compute&slot=${targetSlot}/`)) {
					return new Response(JSON.stringify(applied.raw));
				}
				throw new Error(`unexpected-request:${url}`);
			},
		});

		await expect(
			subject.waitForFungibleTransfer(processId, transactionId, seller, recipient, '10', { startingSlot: 0 })
		).resolves.toMatchObject({ raw: { 'at-slot': targetSlot } });
		expect(scheduleReads).toBeLessThan(45);
	});

	it('follows a confirmed transfer when its block height changes before scheduler finality', async () => {
		const current = transferState(14, '90', '110');
		const applied = transferState(13, '90', '110');
		applied.raw.results = { outbox: transferNotices('10') };
		let statusReads = 0;
		const subject = new AssetTransactionClient({
			fetch: async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes(`/tx/${transactionId}/status`)) {
					statusReads += 1;
					return new Response(JSON.stringify({ block_height: statusReads === 1 ? 51 : 52 }));
				}
				if (url.includes('/now/remove~message@1.0')) return new Response(JSON.stringify(current.raw));
				const schedule = url.match(/schedule&from=(\d+)&to=(\d+)\/assignments/);
				if (schedule) {
					const assignments: Record<number, unknown> = {};
					for (let slot = Number(schedule[1]); slot <= Number(schedule[2]); slot += 1) {
						assignments[slot] = scheduledAssignment(
							slot,
							slot === 13 ? transactionId : `r${String(slot).padStart(42, '0')}`,
							slot < 13 ? 51 : 52
						);
					}
					return new Response(JSON.stringify(assignments));
				}
				if (url.includes('compute&slot=13/')) return new Response(JSON.stringify(applied.raw));
				throw new Error(`unexpected-request:${url}`);
			},
		});

		await expect(
			subject.waitForFungibleTransfer(processId, transactionId, seller, recipient, '10', { startingSlot: 10 })
		).resolves.toMatchObject({ raw: { 'at-slot': 13 } });
		expect(statusReads).toBe(2);
	});

	it('rediscovers schedule boundaries after a same-height reorg moves the exact transaction', async () => {
		vi.useFakeTimers();
		try {
			const current = transferState(12, '90', '110');
			const applied = transferState(10, '90', '110');
			applied.raw.results = { outbox: transferNotices('10') };
			let statePolls = 0;
			let statusReads = 0;
			let firstWindowRead!: () => void;
			const firstWindow = new Promise<void>((resolve) => (firstWindowRead = resolve));
			const subject = new AssetTransactionClient({
				fetch: async (input: RequestInfo | URL) => {
					const url = String(input);
					if (url.includes(`/tx/${transactionId}/status`)) {
						statusReads += 1;
						return new Response(JSON.stringify({ block_height: 51 }));
					}
					if (url.includes('/now/remove~message@1.0')) {
						statePolls += 1;
						return new Response(JSON.stringify(current.raw));
					}
					const schedule = url.match(/schedule&from=(\d+)&to=(\d+)\/assignments/);
					if (schedule) {
						const moved = statePolls > 1;
						if (!moved && schedule[1] === '12' && schedule[2] === '12') firstWindowRead();
						const assignments: Record<number, unknown> = {};
						for (let slot = Number(schedule[1]); slot <= Number(schedule[2]); slot += 1) {
							const blockHeight = moved ? (slot < 10 ? 50 : slot === 10 ? 51 : 52) : slot < 11 ? 50 : 51;
							assignments[slot] = scheduledAssignment(
								slot,
								moved && slot === 10 ? transactionId : `s${String(slot).padStart(42, '0')}`,
								blockHeight
							);
						}
						return new Response(JSON.stringify(assignments));
					}
					if (url.includes('compute&slot=10/')) return new Response(JSON.stringify(applied.raw));
					throw new Error(`unexpected-request:${url}`);
				},
			});
			const pending = subject.waitForFungibleTransfer(processId, transactionId, seller, recipient, '10', {
				startingSlot: 0,
			});

			await firstWindow;
			await vi.advanceTimersByTimeAsync(0);
			await vi.advanceTimersByTimeAsync(4_000);

			await expect(pending).resolves.toMatchObject({ raw: { 'at-slot': 10 } });
			expect(statePolls).toBe(2);
			expect(statusReads).toBe(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it('does not persist a wallet approval that resolves after its operation was revoked', async () => {
		const subject = client();
		let releaseApproval!: () => void;
		let approvalStarted!: () => void;
		const started = new Promise<void>((resolve) => {
			approvalStarted = resolve;
		});
		const approval = new Promise<void>((resolve) => {
			releaseApproval = resolve;
		});
		const buyer = new AssetTransactionClient({
			wallet: {
				getActiveAddress: async () => seller,
				sign: async (transaction: any) => {
					approvalStarted();
					await approval;
					return transaction;
				},
			},
			arweave: subject.arweave,
			storage: subject.storage,
			fetch: async () => new Response('0'),
		});
		const controller = new AbortController();
		const pending = buyer.transfer(processId, recipient, '1', seller, controller.signal);
		await started;
		controller.abort(new DOMException('Operation revoked', 'AbortError'));
		releaseApproval();

		await expect(pending).rejects.toThrow('Operation revoked');
		expect(subject.storage.getItem(`bazar-signed-transaction:${transactionId}`)).toBeNull();
	});

	it('rejects zero and malformed token quantities before signing', async () => {
		await expect(client().client.makeOffer({ processId, quantity: '0', asking: '1', seller })).rejects.toThrow(
			'invalid-token-quantity'
		);
		await expect(client().client.transfer(processId, recipient, '1.5', seller)).rejects.toThrow(
			'invalid-token-quantity'
		);
	});

	it('includes the one-winston scheduler quantity in purchase estimates', async () => {
		const subject = new AssetTransactionClient({ fetch: async () => new Response('1000') });
		await expect(
			subject.estimatePurchaseCosts(swapOrder(transactionId, '3000000000000', '1000000'), processId)
		).resolves.toMatchObject({ total: '101001001' });
	});

	it('coalesces identical price targets across a matched purchase batch', async () => {
		const requests: string[] = [];
		const subject = new AssetTransactionClient({
			fetch: async (input) => {
				requests.push(String(input));
				return new Response('1000');
			},
		});
		const orders = [
			swapOrder(transactionId, '3000000000000', '1000000'),
			swapOrder('A'.repeat(43), '5000000000000', '2000000'),
		];

		await expect(subject.estimatePurchaseBatchCosts(orders, processId)).resolves.toHaveLength(2);
		expect(requests).toEqual([
			`https://arweave.net/price/0/${processId}`,
			`https://arweave.net/price/0/${recipient}`,
		]);
	});

	it('uses the Arweave gateway serving the browser by default', async () => {
		vi.stubGlobal('window', {
			location: {
				protocol: 'https:',
				hostname: 'deployment.arweave.net',
				port: '',
				search: '',
				hash: '',
			},
		});
		const requests: string[] = [];
		try {
			const subject = new AssetTransactionClient({
				fetch: async (input) => {
					requests.push(String(input));
					return new Response('1000');
				},
			});

			await subject.estimatePurchaseCosts(swapOrder(transactionId, '3000000000000', '1000000'), processId);
		} finally {
			vi.unstubAllGlobals();
		}

		expect(requests).toEqual([
			`https://deployment.arweave.net/price/0/${processId}`,
			`https://deployment.arweave.net/price/0/${recipient}`,
		]);
	});

	it('bounds distinct purchase price requests to eight at a time', async () => {
		let active = 0;
		let peak = 0;
		const subject = new AssetTransactionClient({
			fetch: async () => {
				active += 1;
				peak = Math.max(peak, active);
				await new Promise((resolve) => setTimeout(resolve, 0));
				active -= 1;
				return new Response('1000');
			},
		});
		const orders = Array.from({ length: 32 }, (_, index) => {
			const address = index.toString(36).padStart(43, 'A');
			return {
				...swapOrder((index + 100).toString(36).padStart(43, 'B'), '1', '1'),
				creator: address,
				recipient: address,
			};
		});

		await expect(subject.estimatePurchaseBatchCosts(orders, processId)).resolves.toHaveLength(32);
		expect(peak).toBe(8);
	});

	it('does not start queued price requests after quote cancellation', async () => {
		const controller = new AbortController();
		const reason = new DOMException('Selection changed', 'AbortError');
		let started = 0;
		let reachedLimit!: () => void;
		const atLimit = new Promise<void>((resolve) => {
			reachedLimit = resolve;
		});
		const subject = new AssetTransactionClient({
			fetch: async (_input, init) => {
				started += 1;
				if (started === 8) reachedLimit();
				await new Promise<void>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
				});
				return new Response('1000');
			},
		});
		const orders = Array.from({ length: 32 }, (_, index) => {
			const address = index.toString(36).padStart(43, 'C');
			return {
				...swapOrder((index + 100).toString(36).padStart(43, 'D'), '1', '1'),
				creator: address,
				recipient: address,
			};
		});
		const quote = subject.estimatePurchaseBatchCosts(orders, processId, controller.signal);

		await atLimit;
		controller.abort(reason);

		await expect(quote).rejects.toBe(reason);
		expect(started).toBe(8);
	});

	it('passes quote cancellation through every price request', async () => {
		const controller = new AbortController();
		const reason = new DOMException('Selection changed', 'AbortError');
		const signals: Array<AbortSignal | null | undefined> = [];
		controller.abort(reason);
		const subject = new AssetTransactionClient({
			fetch: async (_input, init) => {
				signals.push(init?.signal);
				if (init?.signal?.aborted) throw init.signal.reason;
				return new Response('1000');
			},
		});

		await expect(
			subject.estimatePurchaseBatchCosts(
				[swapOrder(transactionId, '3000000000000', '1000000')],
				processId,
				controller.signal
			)
		).rejects.toBe(reason);
		expect(signals).toEqual([controller.signal, controller.signal]);
	});

	it('rejects an unaffordable batch before opening any wallet signature prompts', async () => {
		let signatures = 0;
		const subject = client();
		const unavailable = new AssetTransactionClient({
			wallet: {
				getActiveAddress: async () => seller,
				sign: async (transaction: any) => {
					signatures += 1;
					return transaction;
				},
			},
			arweave: subject.arweave,
			storage: subject.storage,
			fetch: async (url: string | URL | Request) => new Response(String(url).includes('/wallet/') ? '0' : '1000'),
		});
		await expect(
			unavailable.preparePurchaseBatch([
				{
					processId,
					order: swapOrder(transactionId, '3000000000000', '1000000'),
					buyer: seller,
					startingBalance: '0',
					network: { tip: () => 0 } as any,
				},
			])
		).rejects.toThrow('asset-purchase-insufficient-funds');
		expect(signatures).toBe(0);
	});

	it('discards a signed reservation when its paired payment approval is rejected', async () => {
		const order = swapOrder(transactionId, '3000000000000', '1000000');
		const subject = approvalSubject([order], { rejectAt: 2 });
		const adapter = subject.client.purchaseAdapter({
			processId,
			order,
			buyer: seller,
			startingBalance: '0',
			network: { tip: () => 1000 } as any,
		});

		await expect(adapter.prepareBoth!(new AbortController().signal)).rejects.toThrow('wallet approval rejected');
		expect(subject.signatures()).toBe(2);
		expect(subject.signedKeys()).toEqual([]);
		expect(subject.client.findStoredRegistration(processId, order.orderId, seller)).toBeNull();
	});

	it.each([3, 4])('discards every earlier batch approval when wallet prompt %i is rejected', async (rejectAt) => {
		const orders = [
			swapOrder(transactionId, '3000000000000', '1000000'),
			swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '5000000000000', '2000000'),
		];
		const subject = approvalSubject(orders, { rejectAt });

		await expect(
			subject.client.preparePurchaseBatch(
				orders.map((order) => ({
					processId,
					order,
					buyer: seller,
					startingBalance: '0',
					network: { tip: () => 1000 } as any,
				}))
			)
		).rejects.toThrow('wallet approval rejected');

		expect(subject.signatures()).toBe(rejectAt);
		expect(subject.signedKeys()).toEqual([]);
	});

	it('discards a complete pre-signed batch when the final balance check fails', async () => {
		const orders = [
			swapOrder(transactionId, '3000000000000', '1000000'),
			swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '5000000000000', '2000000'),
		];
		const subject = approvalSubject(orders, { failBalanceAt: 4 });

		await expect(
			subject.client.preparePurchaseBatch(
				orders.map((order) => ({
					processId,
					order,
					buyer: seller,
					startingBalance: '0',
					network: { tip: () => 1000 } as any,
				}))
			)
		).rejects.toThrow('asset-purchase-insufficient-funds');

		expect(subject.signatures()).toBe(4);
		expect(subject.signedKeys()).toEqual([]);
	});

	it('checkpoints the batch quote and every up-front signature in approval order', async () => {
		const orders = [
			swapOrder(transactionId, '3000000000000', '1000000'),
			swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '5000000000000', '2000000'),
		];
		const subject = approvalSubject(orders);
		const events: Array<
			| { type: 'quoted'; entries: Array<{ order: SwapOrder; fillQuantity: string; paymentCost: string }> }
			| { type: 'signed'; kind: 'registration' | 'payment'; orderId: string; transactionId: string; cost: string }
		> = [];

		await subject.client.preparePurchaseBatch(
			orders.map((order) => ({
				processId,
				order,
				buyer: seller,
				startingBalance: '0',
				network: { tip: () => 1000 } as any,
			})),
			undefined,
			(event) => events.push(event)
		);

		expect(
			events.map((event) => (event.type === 'quoted' ? event.type : `${event.kind}:${event.orderId}`))
		).toEqual([
			'quoted',
			`registration:${orders[0].orderId}`,
			`payment:${orders[0].orderId}`,
			`registration:${orders[1].orderId}`,
			`payment:${orders[1].orderId}`,
		]);
		expect(events[0]).toMatchObject({
			type: 'quoted',
			entries: [
				{ fillQuantity: orders[0].quantity, paymentCost: '1001000' },
				{ fillQuantity: orders[1].quantity, paymentCost: '2001000' },
			],
		});
	});

	it('discards an atomic approval pair when navigation aborts its final balance check', async () => {
		const order = swapOrder(transactionId, '3000000000000', '1000000');
		const subject = approvalSubject([order], { deferBalanceAt: 1 });
		const controller = new AbortController();
		const adapter = subject.client.purchaseAdapter({
			processId,
			order,
			buyer: seller,
			startingBalance: '0',
			network: { tip: () => 1000 } as any,
		});
		const preparation = adapter.prepareBoth!(controller.signal);

		await subject.balanceStarted;
		const reason = new DOMException('Route changed', 'AbortError');
		controller.abort(reason);
		subject.releaseBalance();

		await expect(preparation).rejects.toBe(reason);
		expect(subject.signatures()).toBe(2);
		expect(subject.signedKeys()).toEqual([]);
	});

	it('discards a pre-signed batch when navigation aborts its final balance check', async () => {
		const orders = [
			swapOrder(transactionId, '3000000000000', '1000000'),
			swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '5000000000000', '2000000'),
		];
		const subject = approvalSubject(orders, { deferBalanceAt: 4 });
		const controller = new AbortController();
		const preparation = subject.client.preparePurchaseBatch(
			orders.map((order) => ({
				processId,
				order,
				buyer: seller,
				startingBalance: '0',
				network: { tip: () => 1000 } as any,
			})),
			controller.signal
		);

		await subject.balanceStarted;
		const reason = new DOMException('Wallet changed', 'AbortError');
		controller.abort(reason);
		subject.releaseBalance();

		await expect(preparation).rejects.toBe(reason);
		expect(subject.signatures()).toBe(4);
		expect(subject.signedKeys()).toEqual([]);
	});

	it('hands a fresh pre-signed batch to the lifecycle without an invalid payment resume', async () => {
		const order = swapOrder(transactionId, '3000000000000', '1000000');
		const subject = client();
		const buyer = new AssetTransactionClient({
			wallet: {
				getActiveAddress: async () => seller,
				sign: async (transaction: any) => transaction,
			},
			arweave: subject.arweave,
			storage: subject.storage,
			fetch: async (url: string | URL | Request) => {
				const path = String(url);
				if (path.includes('/wallet/')) return new Response('1000000000000');
				if (path.includes('/price/')) return new Response('1000');
				if (path.endsWith('/info')) return Response.json({ height: 1000 });
				return Response.json({
					'execution-device': 'token@1.0',
					'total-supply': '1000000000000000000',
					denomination: 12,
					ticker: 'WEAVE',
					balances: { [recipient]: '3000000000000' },
					orders: {
						[transactionId]: {
							'order-id': transactionId,
							creator: recipient,
							recipient,
							asking: order.asking,
							'minimum-fee': order.minimumFee,
							deadline: order.deadline,
							'created-at': order.createdAt,
							quantity: order.quantity,
							status: 'open',
						},
					},
				});
			},
		});
		const network = { tip: () => 1000 } as any;
		const [prepared] = await buyer.preparePurchaseBatch([
			{
				processId,
				order,
				buyer: seller,
				startingBalance: '0',
				network,
			},
		]);

		expect(prepared.snapshot).toEqual({
			registration: { id: transactionId, dispatched: false },
			payment: { id: transactionId, dispatched: false },
		});
		const adapter = buyer.purchaseAdapter({ processId, order, buyer: seller, startingBalance: '0', network });
		expect(() => new SwapPurchase(network, adapter, { resume: prepared.snapshot })).not.toThrow();
		expect(
			(await adapter.restorePrepared!('registration', prepared.registration.id, new AbortController().signal))
				.validUntilHeight
		).toBeDefined();
		expect(
			(await adapter.restorePrepared!('payment', prepared.payment.id, new AbortController().signal))
				.validUntilHeight
		).toBeUndefined();
	});

	it('signs a proportional partial fill against the original order', async () => {
		const order = swapOrder(transactionId, '3000000000000', '1000000');
		const subject = approvalSubject([order]);
		const [prepared] = await subject.client.preparePurchaseBatch([
			{
				processId,
				order,
				fillQuantity: '1000000000000',
				buyer: seller,
				startingBalance: '0',
				network: { tip: () => 1000 } as any,
			},
		]);
		const registration = subject.storedTransaction(prepared.registration.id);
		const payment = subject.storedTransaction(prepared.payment.id);

		expect(prepared.order).toBe(order);
		expect(prepared.fillQuantity).toBe('1000000000000');
		expect(registration.reward).toBe('33333334');
		expect(registration.tags).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: Buffer.from('order-id').toString('base64url'),
					value: Buffer.from(order.orderId).toString('base64url'),
				}),
				expect.objectContaining({
					name: Buffer.from('fill-quantity').toString('base64url'),
					value: Buffer.from('1000000000000').toString('base64url'),
				}),
			])
		);
		expect(payment.target).toBe(order.recipient);
		expect(payment.quantity).toBe('333334');
	});

	it.each(['0', '3000000000001'])('refuses invalid fill quantity %s before wallet approval', (fillQuantity) => {
		const order = swapOrder(transactionId, '3000000000000', '1000000');
		const subject = approvalSubject([order]);

		expect(() =>
			subject.client.purchaseAdapter({
				processId,
				order,
				fillQuantity,
				buyer: seller,
				startingBalance: '0',
				network: { tip: () => 1000 } as any,
			})
		).toThrow('fill-quantity-out-of-range');
		expect(subject.signatures()).toBe(0);
	});

	it('refuses to dispatch a stored registration after its exact order disappears', async () => {
		const order = swapOrder(transactionId, '3000000000000', '1000000');
		const subject = client();
		const network = { tip: () => 1000 } as any;
		const initial = subject.client.purchaseAdapter({
			processId,
			order,
			buyer: seller,
			startingBalance: '0',
			network,
		});
		const prepared = await initial.prepareRegistration(new AbortController().signal);
		let posts = 0;
		const resumed = new AssetTransactionClient({
			wallet: { getActiveAddress: async () => seller, sign: async (transaction: any) => transaction },
			arweave: subject.arweave,
			storage: subject.storage,
			fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
				if (init?.method === 'POST' && String(input).endsWith('/tx')) posts += 1;
				if (String(input).endsWith('/info')) return Response.json({ height: 1000 });
				return Response.json({
					'execution-device': 'token@1.0',
					'total-supply': '1000000000000000000',
					denomination: 12,
					ticker: 'WEAVE',
					balances: { [recipient]: '3000000000000' },
					orders: {},
				});
			},
		}).purchaseAdapter({ processId, order, buyer: seller, startingBalance: '0', network });

		await expect(
			resumed.restorePrepared!('registration', prepared.id, new AbortController().signal)
		).rejects.toThrow('asset-order-not-purchasable');
		expect(posts).toBe(0);
	});

	it('stops an expired reservation on its first fresh-state check', async () => {
		const order = swapOrder(transactionId, '3000000000000', '1000000');
		let stateReads = 0;
		let posts = 0;
		const subject = new AssetTransactionClient({
			fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (init?.method === 'POST') posts += 1;
				if (url.includes('/tx/') && url.endsWith('/status')) return Response.json({ block_height: 90 });
				if (url.endsWith('/info')) return Response.json({ height: 101 });
				stateReads += 1;
				return Response.json({
					'execution-device': 'token@1.0',
					'total-supply': '1000000000000000000',
					denomination: 12,
					ticker: 'WEAVE',
					balances: { [recipient]: '999997000000000000' },
					orders: {
						[order.orderId]: {
							'order-id': order.orderId,
							creator: order.creator,
							recipient: order.recipient,
							asking: order.asking,
							deposit: order.deposit,
							'minimum-fee': order.minimumFee,
							deadline: order.deadline,
							'created-at': order.createdAt,
							quantity: order.quantity,
							status: 'reserved',
							buyer: seller,
							'reserved-until': 100,
						},
					},
				});
			},
		});
		const adapter = subject.purchaseAdapter({
			processId,
			order,
			buyer: seller,
			startingBalance: '0',
			network: { tip: () => 101 } as any,
		});

		await expect(
			adapter.waitForRegistrationAcceptance!({
				registrationId: 'R'.repeat(43),
				signal: new AbortController().signal,
				report: () => undefined,
			})
		).rejects.toThrow('asset-order-reservation-expired');
		expect(stateReads).toBe(1);
		expect(posts).toBe(0);
	});

	it('stops a reservation after live process state has definitively passed its block', async () => {
		const order = swapOrder(transactionId, '3000000000000', '6000000');
		const registrationId = 'R'.repeat(43);
		let stateReads = 0;
		const subject = new AssetTransactionClient({
			fetch: async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.endsWith(`/tx/${registrationId}/status`)) return Response.json({ block_height: 100 });
				if (url.endsWith('/info')) return Response.json({ height: 120 });
				stateReads += 1;
				return Response.json({
					'execution-device': 'token@1.0',
					'at-slot': 40,
					'swap-height': 111,
					'total-supply': '1000000000000000000',
					denomination: 12,
					ticker: 'WEAVE',
					balances: { [recipient]: '999997000000000000' },
					orders: {
						[order.orderId]: {
							'order-id': order.orderId,
							creator: order.creator,
							recipient: order.recipient,
							asking: order.asking,
							deposit: order.deposit,
							'minimum-fee': order.minimumFee,
							deadline: order.deadline,
							'created-at': order.createdAt,
							quantity: order.quantity,
							status: 'open',
						},
					},
				});
			},
		});
		const adapter = subject.purchaseAdapter({
			processId,
			order,
			buyer: seller,
			startingBalance: '0',
			network: { tip: () => 120 } as any,
		});

		await expect(
			adapter.waitForRegistrationAcceptance!({
				registrationId,
				signal: new AbortController().signal,
				report: () => undefined,
			})
		).rejects.toThrow('asset-order-reservation-rejected');
		expect(stateReads).toBe(1);
	});

	it('reports a matching reopened order as expired once its reservation window has passed', async () => {
		const order = swapOrder(transactionId, '3000000000000', '6000000');
		const registrationId = 'R'.repeat(43);
		let stateReads = 0;
		const subject = new AssetTransactionClient({
			fetch: async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.endsWith(`/tx/${registrationId}/status`)) return Response.json({ block_height: 100 });
				if (url.endsWith('/info')) return Response.json({ height: 125 });
				stateReads += 1;
				return Response.json({
					'execution-device': 'token@1.0',
					'at-slot': 40,
					'swap-height': 121,
					'total-supply': '1000000000000000000',
					denomination: 12,
					ticker: 'WEAVE',
					balances: { [recipient]: '999997000000000000' },
					orders: {
						[order.orderId]: {
							'order-id': order.orderId,
							creator: order.creator,
							recipient: order.recipient,
							asking: order.asking,
							deposit: order.deposit,
							'minimum-fee': order.minimumFee,
							deadline: order.deadline,
							'created-at': order.createdAt,
							quantity: order.quantity,
							status: 'open',
						},
					},
				});
			},
		});
		const adapter = subject.purchaseAdapter({
			processId,
			order,
			buyer: seller,
			startingBalance: '0',
			network: { tip: () => 125 } as any,
		});

		await expect(
			adapter.waitForRegistrationAcceptance!({
				registrationId,
				signal: new AbortController().signal,
				report: () => undefined,
			})
		).rejects.toThrow('asset-order-reservation-expired');
		expect(stateReads).toBe(1);
	});
});

function swapOrder(orderId: string, quantity: string, asking: string) {
	return {
		orderId,
		creator: recipient,
		recipient,
		asking,
		deposit: '0',
		minimumFee: '100000000',
		deadline: 20,
		createdAt: 1,
		quantity,
		status: 'open' as const,
	};
}

function approvalSubject(
	orders: ReturnType<typeof swapOrder>[],
	options: { rejectAt?: number; failBalanceAt?: number; deferBalanceAt?: number } = {}
) {
	const values = new Map<string, string>();
	const ids = ['R', 'P', 'S', 'T', 'U', 'V'].map((prefix) => prefix.repeat(43));
	let created = 0;
	let signatures = 0;
	let balanceChecks = 0;
	let announceBalanceStarted!: () => void;
	let releaseBalance!: () => void;
	const balanceStarted = new Promise<void>((resolve) => {
		announceBalanceStarted = resolve;
	});
	const balanceRelease = new Promise<void>((resolve) => {
		releaseBalance = resolve;
	});
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
		key: (index: number) => [...values.keys()][index] ?? null,
		get length() {
			return values.size;
		},
	};
	const arweave = {
		createTransaction: async ({ target, quantity, data }: Record<string, string>) => {
			const transaction: any = {
				id: ids[created++],
				owner: 'owner-key',
				target,
				quantity,
				data,
				reward: '1000',
				tags: [] as Array<{ name: string; value: string }>,
				addTag(name: string, value: string) {
					this.tags.push({ name, value });
				},
				toJSON() {
					return {
						...this,
						addTag: undefined,
						toJSON: undefined,
						tags: this.tags.map((tag: { name: string; value: string }) => ({
							name: Buffer.from(tag.name).toString('base64url'),
							value: Buffer.from(tag.value).toString('base64url'),
						})),
					};
				},
			};
			return transaction;
		},
		transactions: { verify: async () => true },
		wallets: { ownerToAddress: async () => seller },
	};
	const state = {
		'execution-device': 'token@1.0',
		'total-supply': '1000000000000000000',
		denomination: 12,
		ticker: 'WEAVE',
		balances: { [recipient]: '8000000000000' },
		orders: Object.fromEntries(
			orders.map((order) => [
				order.orderId,
				{
					'order-id': order.orderId,
					creator: order.creator,
					recipient: order.recipient,
					asking: order.asking,
					'minimum-fee': order.minimumFee,
					deadline: order.deadline,
					'created-at': order.createdAt,
					quantity: order.quantity,
					status: 'open',
				},
			])
		),
	};
	const subject = new AssetTransactionClient({
		wallet: {
			getActiveAddress: async () => seller,
			sign: async (transaction: any) => {
				signatures += 1;
				if (signatures === options.rejectAt) throw new Error('wallet approval rejected');
				return transaction;
			},
		},
		arweave,
		storage,
		fetch: async (url: string | URL | Request) => {
			const path = String(url);
			if (path.includes('/wallet/')) {
				balanceChecks += 1;
				if (balanceChecks === options.deferBalanceAt) {
					announceBalanceStarted();
					await balanceRelease;
				}
				return new Response(balanceChecks === options.failBalanceAt ? '0' : '1000000000000');
			}
			if (path.includes('/price/')) return new Response('1000');
			if (path.endsWith('/info')) return Response.json({ height: 1000 });
			return Response.json(state);
		},
	});
	return {
		client: subject,
		balanceStarted,
		releaseBalance,
		signatures: () => signatures,
		signedKeys: () => [...values.keys()].filter((key) => key.startsWith('bazar-signed-transaction:')),
		storedTransaction: (id: string) => JSON.parse(values.get(`bazar-signed-transaction:${id}`)!).transaction,
	};
}
