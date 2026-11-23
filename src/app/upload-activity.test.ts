import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ObserverView } from 'weave-wrangler';

import type { MintActivity } from 'api/mint-activity';

vi.mock('./useDialogFocus', async (importOriginal) => ({
	...(await importOriginal<typeof import('./useDialogFocus')>()),
	useDialogFocus: () => ({ current: null }),
}));

import { type UploadActivity, UploadActivityPanel, uploadActivitySyncSteps } from './App';

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

describe('upload result announcements', () => {
	const render = (activity: UploadActivity) =>
		renderToStaticMarkup(
			React.createElement(
				MemoryRouter,
				null,
				React.createElement(UploadActivityPanel, {
					activity,
					relatedMintActivities: [],
					visible: true,
					onHide: () => undefined,
					onClose: () => undefined,
				})
			)
		);

	it('reads a failed upload as an alert, not a polite status', () => {
		const markup = render({
			...upload,
			phase: 'error',
			status: 'The wallet rejected the signature request.',
			transactionIds: [],
			transactions: [],
		});

		expect(markup).toContain('Upload needs attention');
		expect(markup).toContain('<p role="alert">The wallet rejected the signature request.</p>');
		expect(markup).not.toContain('aria-live="polite"');
	});

	it('keeps a finished upload as a polite status', () => {
		const markup = render({ ...upload, phase: 'done', status: 'Submitted to Arweave.', collectionId: 'c' });

		expect(markup).toContain('<p aria-live="polite" role="status">Submitted to Arweave.</p>');
		expect(markup).not.toContain('role="alert"');
	});
});
