// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ArweaveRecallContent } from 'api/mining-telemetry';

import { appError } from 'helpers/app-error';
import type { AsyncState } from 'helpers/async-state';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const control = vi.hoisted(() => ({
	fetch: undefined as undefined | ((content: ArweaveRecallContent, signal: AbortSignal) => Promise<Blob | undefined>),
	signals: [] as AbortSignal[],
}));

vi.mock('api/mining-telemetry', async (importOriginal) => {
	const actual = await importOriginal<typeof import('api/mining-telemetry')>();
	return {
		...actual,
		fetchBoundedRecallImage: (content: ArweaveRecallContent, signal: AbortSignal) => {
			control.signals.push(signal);
			if (!control.fetch) throw new Error('fetch-not-configured');
			return control.fetch(content, signal);
		},
	};
});

import { useBoundedRecallImage } from 'features/TransactionSync/hooks/useBoundedRecallImage';

const first: ArweaveRecallContent = { kind: 'image', contentUrl: 'https://first.example' };
const second: ArweaveRecallContent = { kind: 'image', contentUrl: 'https://second.example' };

let root: Root;
let state: AsyncState<string | null> = { status: 'idle' };
let created: string[] = [];
let revoked: string[] = [];

function Probe(props: { content: ArweaveRecallContent }) {
	state = useBoundedRecallImage(props.content);
	return null;
}

function render(content: ArweaveRecallContent) {
	React.act(() => root.render(<Probe content={content} />));
}

async function settle() {
	await React.act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

describe('useBoundedRecallImage', () => {
	beforeEach(() => {
		root = createRoot(document.createElement('div'));
		created = [];
		revoked = [];
		control.fetch = undefined;
		control.signals = [];
		let index = 0;
		URL.createObjectURL = vi.fn(() => {
			index += 1;
			const url = `blob:image-${index}`;
			created.push(url);
			return url;
		});
		URL.revokeObjectURL = vi.fn((url: string) => void revoked.push(url));
	});

	afterEach(() => {
		React.act(() => root.unmount());
	});

	it('exposes the loaded image as an object URL', async () => {
		control.fetch = async () => new Blob(['image']);

		render(first);
		expect(state).toEqual({ status: 'loading' });
		await settle();

		expect(state).toEqual({ status: 'success', data: 'blob:image-1' });
	});

	it('reports content that is not a previewable image as an empty success', async () => {
		control.fetch = async () => undefined;

		render(first);
		await settle();

		expect(state).toEqual({ status: 'success', data: null });
		expect(created).toEqual([]);
	});

	it('records a failed preview as an application error', async () => {
		control.fetch = async () => {
			throw appError('unavailable');
		};

		render(first);
		await settle();

		expect(state.status).toBe('error');
		expect(state.status === 'error' && state.error.reason).toBe('unavailable');
	});

	it('aborts and revokes the previous request when the content changes', async () => {
		control.fetch = async () => new Blob(['image']);

		render(first);
		await settle();
		render(second);

		expect(control.signals[0].aborted).toBe(true);
		expect(revoked).toEqual(['blob:image-1']);
		expect(state).toEqual({ status: 'loading' });
		await settle();
		expect(state).toEqual({ status: 'success', data: 'blob:image-2' });
	});

	it('revokes the object URL on unmount', async () => {
		control.fetch = async () => new Blob(['image']);

		render(first);
		await settle();
		React.act(() => root.unmount());
		root = createRoot(document.createElement('div'));

		expect(revoked).toEqual(['blob:image-1']);
	});
});
