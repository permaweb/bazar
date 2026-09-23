import type { ArweaveRecallContent } from 'api/mining-telemetry';
import type { ObserverView, PurchaseTransaction } from 'api/transactions';

export type ArweaveSyncTransaction = Pick<PurchaseTransaction, 'id' | 'views'> & {
	consensus?: PurchaseTransaction['consensus'];
};

export type ArweaveSyncStep = {
	key: string;
	label: string;
	transaction?: ArweaveSyncTransaction;
	target: number;
	/** The last transaction has no bounded follow-up depth; keep displaying its live depth. */
	terminal?: boolean;
	confirmations?: number;
	hasError?: boolean;
};

export type ObserverTooltipStage = {
	label: string;
	count: number;
	target: number;
	state: ObserverView['state'];
	hasError: boolean;
};

export type Infinity3DMarker = {
	kind: 'event' | 'proof';
	confirmation: boolean;
	progress: number;
	state: ObserverView['state'];
	confirmations: number;
	error: boolean;
	detail: string;
	observedAt?: number;
};

export type Infinity3DLane = {
	observerUrl: string;
	label: string;
	detail: string;
	statusLabel: string;
	stages: ObserverTooltipStage[];
	progress: number;
	phases: Array<{
		progress: number;
		started: boolean;
		complete: boolean;
	}>;
	state: ObserverView['state'];
	confirmations: number;
	error: boolean;
	markers: Infinity3DMarker[];
};

export type CableMiningActivity = {
	candidateRate?: number;
	acceptedProofs: Array<{
		key: string;
		height: number;
		observedAt: number;
		label: string;
		meta: string;
		recalls: Array<{
			key: string;
			content?: ArweaveRecallContent;
			fallback: string;
			contentLabel: string;
			meta?: string;
		}>;
	}>;
};

export type CableTelemetry = {
	heading: string;
	liveLabel: string;
	metrics: Array<{ label: string; value: string }>;
	activityLabel: string;
	activity: Array<{
		key: string;
		label: string;
		detail: string;
		kind: 'proof' | 'status' | 'confirmation' | 'error';
		typeLabel: string;
	}>;
	mining: {
		heading: string;
		status: string;
		metrics: Array<{ label: string; value: string }>;
	};
};
