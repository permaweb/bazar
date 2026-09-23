import {
	type AssetState,
	filledOrder,
	formatTokenAmount,
	liquidBalanceOf,
	listedBalanceOf,
	matchOrderFills,
	type OrderFill,
	parseTokenAmount,
	type SwapOrder,
} from 'api/marketplace';
import { hasRecoverablePurchase, shouldAutomaticallyResumePurchase } from 'api/operations';
import {
	type Consensus,
	type ObserverView,
	type PreparedTransaction,
	PURCHASE_PAYMENT_TARGET,
	PURCHASE_REGISTRATION_TARGET,
	purchaseSkipKind,
	type PurchaseState,
} from 'api/transactions';

import type { ArweaveSyncStep } from 'features/TransactionSync';
import { type AppErrorReason, appErrorReasonMessage, toAppError } from 'helpers/app-error';
import { winstonToArDecimal } from 'helpers/ar-units';

import { safeArPrice, safeLotQuote, safeTokenAmount, tokenLabel } from './fungible-market';
import {
	type FungibleOperation,
	fungiblePurchaseResumeOf,
	fungibleTransferRecipientError,
	fungibleTransferSubmitLabel,
	operationLabel,
} from './fungible-operation';

/** The editable inputs of one operation dialog. */
export type FungibleOperationDraft = {
	quantity: string;
	unitPrice: string;
	recipient: string;
};

/** A dialog opens with the amounts its operation carried, or the whole saved batch it resumes. */
export function initialFungibleOperationDraft(
	operation: FungibleOperation,
	denomination: number
): FungibleOperationDraft {
	const initialQuantity =
		operation.kind === 'buy' && operation.resume
			? formatTokenAmount(
					operation.resume.entries
						.reduce((total, entry) => total + BigInt(entry.fillQuantity), 0n)
						.toString(),
					denomination
			  )
			: operation.kind === 'buy'
			? operation.quantity ?? ''
			: '';
	return {
		quantity:
			operation.kind === 'sell' || operation.kind === 'transfer' ? operation.quantity ?? '' : initialQuantity,
		unitPrice: operation.kind === 'sell' ? operation.unitPrice ?? '' : '',
		recipient: operation.kind === 'transfer' ? operation.recipient ?? '' : '',
	};
}

/** Open orders a purchase dialog may fill. */
export function fungiblePurchaseCandidates(operation: FungibleOperation): SwapOrder[] {
	return operation.kind === 'buy' ? operation.availableOrders.filter((order) => order.status === 'open') : [];
}

export type FungiblePurchaseDraftMatch = {
	match: ReturnType<typeof matchOrderFills> | null;
	error: string;
};

/** Match a requested purchase amount against the dialog's candidate orders. */
export function fungiblePurchaseDraftMatch(
	kind: FungibleOperation['kind'],
	eligible: SwapOrder[],
	quantity: string,
	state: AssetState,
	tickerDisplay: string
): FungiblePurchaseDraftMatch {
	if (kind !== 'buy') return { match: null, error: '' };
	try {
		const atomic = parseTokenAmount(quantity, state.denomination);
		const match = matchOrderFills(eligible, atomic);
		return {
			match,
			error: match
				? ''
				: `Only ${tokenLabel(
						eligible.reduce((total, order) => total + BigInt(order.quantity), 0n).toString(),
						state
				  )} is currently available.`,
		};
	} catch (cause) {
		return {
			match: null,
			error:
				toAppError(cause, 'invalid-input').reason === 'order-match-search-limit'
					? appErrorReasonMessage('order-match-search-limit')
					: quantity
					? `Enter a valid ${tickerDisplay} amount using no more than ${state.denomination} decimal places.`
					: '',
		};
	}
}

export type FungibleOperationDraftView = {
	/** Liquid balance of the signer, in atomic units. */
	available: string;
	enteredQuantity: bigint | null;
	currentLiquid: bigint;
	currentListed: bigint;
	/** A quantity was entered but is malformed or exceeds the liquid balance. */
	quantityInvalid: boolean;
	listingQuote: string | null;
	unitPriceValid: boolean;
	transferRecipient: string;
	recipientError: AppErrorReason | null;
	sellValid: boolean;
	transferValid: boolean;
};

/** Validate a dialog draft against the signer's current balance before anything is signed. */
export function fungibleOperationDraftView(
	operation: FungibleOperation,
	state: AssetState,
	owner: string,
	draft: FungibleOperationDraft
): FungibleOperationDraftView {
	const available = liquidBalanceOf(state, owner);
	const enteredQuantity = safeTokenAmount(draft.quantity, state.denomination);
	const currentLiquid = BigInt(available);
	const currentListed = BigInt(listedBalanceOf(state, owner));
	const listingQuote = operation.kind === 'sell' ? safeLotQuote(draft.quantity, draft.unitPrice, state) : null;
	const unitPriceValid = safeArPrice(draft.unitPrice);
	const transferRecipient =
		operation.kind === 'transfer' ? (operation.recipient ?? draft.recipient).trim() : draft.recipient.trim();
	const recipientError =
		operation.kind === 'transfer' ? fungibleTransferRecipientError(transferRecipient, owner) : null;
	return {
		available,
		enteredQuantity,
		currentLiquid,
		currentListed,
		quantityInvalid: Boolean(draft.quantity) && (enteredQuantity === null || enteredQuantity > currentLiquid),
		listingQuote,
		unitPriceValid,
		transferRecipient,
		recipientError,
		sellValid:
			operation.kind === 'sell' &&
			enteredQuantity !== null &&
			enteredQuantity <= currentLiquid &&
			unitPriceValid &&
			listingQuote !== null,
		transferValid:
			operation.kind === 'transfer' &&
			!recipientError &&
			enteredQuantity !== null &&
			enteredQuantity <= currentLiquid,
	};
}

/** The exact order lots a purchase dialog shows: its saved batch when resuming, otherwise the live match. */
export function fungibleOperationVisibleFills(operation: FungibleOperation, matchedFills: OrderFill[]): OrderFill[] {
	if (operation.kind !== 'buy') return [];
	return (
		fungiblePurchaseResumeOf(operation)?.entries.map((entry) => ({
			sourceOrder: entry.order,
			order: filledOrder(entry.order, entry.fillQuantity),
			partial: entry.fillQuantity !== entry.order.quantity,
		})) ?? matchedFills
	);
}

/** Whether a purchase holds signed settlement work that must be resumed rather than restarted. */
export function isRecoverableFungiblePurchase(
	operation: FungibleOperation,
	purchaseStates: Record<string, PurchaseState>
): boolean {
	return (
		operation.kind === 'buy' &&
		Boolean(
			fungiblePurchaseResumeOf(operation)?.entries.some((entry) => hasRecoverablePurchase(entry.snapshot)) ||
				Object.values(purchaseStates).some((purchase) => hasRecoverablePurchase(purchase))
		)
	);
}

/** Whether a dialog should resume its saved signed work as soon as it opens. */
export function shouldResumeFungibleOperation(operation: FungibleOperation): boolean {
	return Boolean(
		(operation.kind === 'buy' &&
			fungiblePurchaseResumeOf(operation)?.entries.every((entry) =>
				shouldAutomaticallyResumePurchase(entry.snapshot)
			)) ||
			(operation.kind !== 'buy' && operation.resumeId)
	);
}

/** The proven start slot for exact cancel and transfer checks restored from a saved operation. */
export function initialExactActionBaseline(operation: FungibleOperation): { startingSlot: number } | null {
	if (operation.kind !== 'cancel' && operation.kind !== 'transfer') return null;
	if (operation.startingSlot !== undefined && Number.isSafeInteger(operation.startingSlot)) {
		return { startingSlot: operation.startingSlot };
	}
	return operation.resumeId ? { startingSlot: 0 } : null;
}

export type FungiblePurchaseSync = {
	steps: ArweaveSyncStep[];
	activeStep: 'register' | 'pay';
	skipKind?: 'yolo' | 'skip';
	pendingAfterConfirmation?: string;
};

/** Reservation and payment progress for the purchase lot currently shown. */
export function fungiblePurchaseSync(purchase?: PurchaseState): FungiblePurchaseSync {
	if (!purchase) return { steps: [], activeStep: 'register' };
	return {
		steps: [
			{
				key: 'register',
				label: 'Reserve listing',
				target: PURCHASE_REGISTRATION_TARGET,
				transaction: purchase.registration,
			},
			{
				key: 'pay',
				label: 'Pay seller',
				target: PURCHASE_PAYMENT_TARGET,
				terminal: true,
				transaction: purchase.payment,
			},
		],
		activeStep: purchase.stage.includes('payment') || purchase.stage === 'ownership-verifying' ? 'pay' : 'register',
		skipKind: purchaseSkipKind(purchase),
		pendingAfterConfirmation:
			purchase.stage === 'registration-accepting'
				? 'Checking live reservation'
				: purchase.stage === 'ownership-verifying'
				? 'Checking receipt'
				: undefined,
	};
}

/** Confirmation progress for a single listing, cancellation, or transfer transaction. */
export function fungibleSingleSyncSteps(
	kind: FungibleOperation['kind'],
	transaction: PreparedTransaction | null,
	confirmations: number,
	views: ObserverView[],
	consensus: Consensus | null
): ArweaveSyncStep[] {
	return transaction
		? [
				{
					key: kind,
					label: operationLabel(kind),
					target: 5,
					terminal: true,
					confirmations,
					transaction: { id: transaction.id, views, ...(consensus ? { consensus } : {}) },
				},
		  ]
		: [];
}

export type FungibleOperationOutcome = {
	title: string;
	detail: string;
	/** Tokens received across every settled purchase lot. */
	purchasedQuantity: bigint;
};

/** The completion copy announced and shown when an operation finishes. */
export function fungibleOperationOutcome(
	operation: FungibleOperation,
	state: AssetState,
	visibleOrders: SwapOrder[],
	draft: Pick<FungibleOperationDraftView, 'enteredQuantity' | 'listingQuote' | 'transferRecipient'>
): FungibleOperationOutcome {
	const purchasedQuantity = visibleOrders.reduce((total, order) => total + BigInt(order.quantity), 0n);
	const title =
		operation.kind === 'buy'
			? 'Purchase complete'
			: operation.kind === 'sell'
			? 'Tokens listed'
			: operation.kind === 'cancel'
			? 'Listing cancelled'
			: 'Transfer complete';
	const detail =
		operation.kind === 'buy'
			? `${tokenLabel(purchasedQuantity.toString(), state)} received from ${visibleOrders.length} ${
					visibleOrders.length === 1 ? 'listing' : 'listings'
			  } · ${winstonToArDecimal(
					visibleOrders.reduce((total, order) => total + BigInt(order.asking), 0n).toString()
			  )} AR paid to sellers.`
			: operation.kind === 'sell' && draft.enteredQuantity && draft.listingQuote
			? `${tokenLabel(draft.enteredQuantity.toString(), state)} listed for ${draft.listingQuote} AR.`
			: operation.kind === 'cancel'
			? `${tokenLabel(operation.order.quantity, state)} returned to your liquid balance.`
			: draft.enteredQuantity
			? `${tokenLabel(draft.enteredQuantity.toString(), state)} sent to ${draft.transferRecipient}.`
			: 'The live token state now reflects this action.';
	return { title, detail, purchasedQuantity };
}

export type FungiblePurchaseTotals = {
	quantity: bigint;
	/** Seller payments in winston. */
	asking: bigint;
	sellers: number;
};

/** Token quantity, seller payments, and distinct sellers across purchase lots. */
export function fungiblePurchaseTotals(orders: SwapOrder[]): FungiblePurchaseTotals {
	return {
		quantity: orders.reduce((total, order) => total + BigInt(order.quantity), 0n),
		asking: orders.reduce((total, order) => total + BigInt(order.asking), 0n),
		sellers: new Set(orders.map((order) => order.creator)).size,
	};
}

export type FungibleOperationSubmit = {
	label: string;
	/** A complete accessible name when the visible label abbreviates the recipient. */
	ariaLabel?: string;
	disabled: boolean;
};

/** The dialog's primary submit action for the current draft and purchase quote. */
export function fungibleOperationSubmit(
	operation: FungibleOperation,
	state: AssetState,
	draft: Pick<
		FungibleOperationDraftView,
		'enteredQuantity' | 'listingQuote' | 'transferRecipient' | 'sellValid' | 'transferValid'
	>,
	purchase: { orders: SwapOrder[]; quantity: bigint; estimatedCost?: string; canAfford?: boolean }
): FungibleOperationSubmit {
	const label =
		operation.kind === 'buy' && purchase.orders.length
			? `Buy ${tokenLabel(purchase.quantity.toString(), state)} · ${
					purchase.estimatedCost ? `${winstonToArDecimal(purchase.estimatedCost)} AR max` : 'checking total…'
			  }`
			: operation.kind === 'sell' && draft.listingQuote && draft.enteredQuantity
			? `List ${tokenLabel(draft.enteredQuantity.toString(), state)} for ${draft.listingQuote} AR`
			: operation.kind === 'cancel'
			? `Cancel listing and return ${tokenLabel(operation.order.quantity, state)}`
			: operation.kind === 'transfer' && draft.enteredQuantity
			? fungibleTransferSubmitLabel(draft.enteredQuantity.toString(), state, draft.transferRecipient)
			: operationLabel(operation.kind);
	return {
		label,
		ariaLabel:
			operation.kind === 'transfer' && draft.enteredQuantity && draft.transferValid
				? fungibleTransferSubmitLabel(draft.enteredQuantity.toString(), state, draft.transferRecipient, true)
				: undefined,
		disabled:
			(operation.kind === 'buy' &&
				(!purchase.orders.length || !purchase.estimatedCost || purchase.canAfford !== true)) ||
			(operation.kind === 'sell' && !draft.sellValid) ||
			(operation.kind === 'transfer' && !draft.transferValid),
	};
}
