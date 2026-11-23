import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ObserverView } from 'weave-wrangler';

import { MINT_ACTIVITY_ATTENTION_AFTER_MS, MINT_ACTIVITY_STALLED_STATUS, type MintActivity } from 'api/mint-activity';

import { mintActivityUploadActivity, type UploadActivity, UploadActivityPanel, uploadActivitySyncSteps } from './App';

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
			terminal: true,
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

describe('background mint activity panel', () => {
	const stalledAt = mint.createdAt + MINT_ACTIVITY_ATTENTION_AFTER_MS;

	function renderPanel(activity: UploadActivity) {
		return renderToStaticMarkup(
			React.createElement(
				MemoryRouter,
				null,
				React.createElement(UploadActivityPanel, {
					activity,
					relatedMintActivities: [mint],
					visible: true,
					onHide: vi.fn(),
					onClose: vi.fn(),
					onCheckAgain: vi.fn(),
					onStopTracking: vi.fn(),
				})
			)
		);
	}

	it('shows live tracking progress before the attention threshold', () => {
		const activity = mintActivityUploadActivity(mint, stalledAt - 1);
		expect(activity).toMatchObject({ phase: 'tracking', status: mint.status, assetId: processId });

		const markup = renderPanel(activity);
		expect(markup).toContain('Hide transaction details');
		expect(markup).not.toContain('Check again');
		expect(markup).not.toContain('Stop tracking');
	});

	it('matches the Activity menu once stalled and offers Check again and Stop tracking', () => {
		const activity = mintActivityUploadActivity(mint, stalledAt);
		expect(activity).toMatchObject({ phase: 'error', status: MINT_ACTIVITY_STALLED_STATUS });

		const markup = renderPanel(activity);
		expect(markup).toContain('Upload needs attention');
		expect(markup).toContain('Bazar is still checking');
		expect(markup).toContain('>Check again</button>');
		expect(markup).toContain('>Stop tracking</button>');
		expect(markup).toContain('aria-label="Close dialog"');
		expect(markup).not.toContain('Hide transaction details');
		expect(markup).not.toContain('operation-working');
	});
});
