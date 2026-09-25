// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CollectionActivityEvent } from 'api/discovery';

import { useHomeTokenPriceChanges } from 'features/Home/hooks/useHomeTokenPriceChanges';
import type { HomeTokenPriceChange } from 'features/Home/model/home-market';

import { assetId } from '../../../fixtures/home-market';

const discoverCollectionActivity = vi.hoisted(() => vi.fn());

vi.mock('api/discovery', async (importOriginal) => ({
	...(await importOriginal<typeof import('api/discovery')>()),
	discoverCollectionActivity,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const token = assetId('T');
const other = assetId('U');

let host: HTMLElement;
let root: Root;
let changes: Record<string, HomeTokenPriceChange>;

function Changes(props: { active: boolean; tokenKey: string; scope: string }) {
	changes = useHomeTokenPriceChanges({ active: props.active, tokenKey: props.tokenKey, scope: props.scope });
	return null;
}

function render(props: Partial<React.ComponentProps<typeof Changes>> = {}) {
	React.act(() =>
		root.render(
			<Changes
				active={props.active ?? true}
				scope={props.scope ?? 'scope-a'}
				tokenKey={props.tokenKey ?? token}
			/>
		)
	);
}

function offer(processId: string, hoursAgo: number, asking: string): CollectionActivityEvent {
	return {
		id: `${processId}-${hoursAgo}`,
		processId,
		action: 'make-offer',
		actor: assetId('W'),
		height: 1,
		timestamp: (Date.now() - hoursAgo * 3_600_000) / 1_000,
		asking,
		quantity: '1',
	};
}

async function settle() {
	await React.act(async () => {
		await Promise.resolve();
	});
}

beforeEach(() => {
	discoverCollectionActivity.mockReset();
	host = document.createElement('div');
	document.body.append(host);
	root = createRoot(host);
});

afterEach(() => {
	React.act(() => root.unmount());
	host.remove();
});

describe('useHomeTokenPriceChanges', () => {
	it('reads recent listings for the visible tokens and reports each change', async () => {
		discoverCollectionActivity.mockResolvedValue([
			offer(token, 20, '1000000000000'),
			offer(token, 1, '2000000000000'),
		]);
		render({ tokenKey: `${token},${other}` });
		expect(changes).toEqual({});

		await settle();

		expect(discoverCollectionActivity).toHaveBeenCalledWith(
			expect.objectContaining({ actions: ['make-offer'], limit: 200, recipients: [token, other] })
		);
		expect(changes).toEqual({ [token]: 100, [other]: null });
	});

	it('marks every requested token unavailable when the index read fails', async () => {
		discoverCollectionActivity.mockRejectedValue(new Error('index down'));
		render({ tokenKey: token });
		await settle();

		expect(changes).toEqual({ [token]: 'unavailable' });
	});

	it('clears changes and issues no request without visible tokens or on another tab', async () => {
		discoverCollectionActivity.mockResolvedValue([]);
		render({ tokenKey: '' });
		render({ active: false, tokenKey: token });
		await settle();

		expect(discoverCollectionActivity).not.toHaveBeenCalled();
		expect(changes).toEqual({});
	});

	it('abandons a superseded read and keeps the newest result', async () => {
		const aborted: Array<boolean> = [];
		discoverCollectionActivity.mockImplementation(
			async (options: { signal: AbortSignal; recipients: string[] }) => {
				await Promise.resolve();
				aborted.push(options.signal.aborted);
				return options.recipients.includes(other) ? [offer(other, 1, '1000000000000')] : [];
			}
		);

		render({ tokenKey: token });
		render({ tokenKey: other });
		await settle();

		expect(aborted).toEqual([true, false]);
		expect(changes).toEqual({ [other]: null });
	});

	it('restarts when the network scope changes', async () => {
		discoverCollectionActivity.mockResolvedValue([]);
		render({ scope: 'scope-a' });
		await settle();
		render({ scope: 'scope-b' });
		await settle();

		expect(discoverCollectionActivity).toHaveBeenCalledTimes(2);
	});
});
