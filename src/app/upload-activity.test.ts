import { describe, expect, it } from 'vitest';
import type { ObserverView } from 'weave-wrangler';

import type { MintActivity } from 'api/mint-activity';

import { type UploadActivity, uploadActivitySyncSteps } from './App';

const processId = 'P'.repeat(43);
const owner = 'O'.repeat(43);

const upload: UploadActivity = {
	id: 'upload-1',
	owner,
	kind: 'asset',
	name: 'Atomic image',
	phase: 'tracking',
	status: 'Waiting for live process state',
	createdAt: 1,
	transactionIds: [processId],
	transactions: [{ id: processId, label: 'Asset transaction' }],
	assetId: processId,
};

const mint: MintActivity = {
	id: `mint:${owner}:${processId}`,
	owner,
	asset: {
		id: processId,
		name: 'Atomic image',
		description: '',
		contentType: 'image/png',
		image: `https://arweave.net/raw/${processId}`,
		mediaId: processId,
		owner,
		createdAt: 1,
	},
	collectionId: 'created-assets',
	transactionIds: [processId],
	arweaveGateway: 'https://arweave.net',
	computeGateway: 'https://alpha.example',
	phase: 'mined',
	status: 'Mined on Arweave. Waiting for live process state.',
	createdAt: 1,
};

function observer(host: string): ObserverView {
	return {
		observer: { url: `https://${host}`, label: host, source: 'peer', failures: 0 },
		state: 'confirmed',
		confirmations: 8,
		blockId: 'block',
		blockHeight: 10,
		updatedAt: 2,
		changedAt: 2,
	};
}

describe('upload observer lanes', () => {
	it('does not invent a local observer lane before the network answers', () => {
		expect(uploadActivitySyncSteps(upload, [mint])[0]).toMatchObject({
			confirmations: 1,
			transaction: { id: processId, views: [] },
		});
	});

	it('renders every live observer view attached to the uploaded transaction', () => {
		const views = [observer('alpha.example'), observer('bravo.example'), observer('charlie.example')];
		const step = uploadActivitySyncSteps(upload, [mint], { [processId]: { views } })[0];

		expect(step.transaction?.views).toEqual(views);
		expect(step.transaction?.views.map((view) => view.observer.label)).toEqual([
			'alpha.example',
			'bravo.example',
			'charlie.example',
		]);
	});
});
