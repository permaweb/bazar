import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyToClipboard, TX_ADDRESS_COPY_LABELS, TxAddress } from './index';

describe('TxAddress', () => {
	it('renders an explorer link and an aligned copy control', () => {
		const address = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
		const markup = renderToStaticMarkup(<TxAddress address={address} wrap={false} />);

		expect(markup).toContain('class="tx-address"');
		expect(markup).toContain('class="tx-address-link"');
		expect(markup).toContain('aria-label="Copy transaction address"');
		expect(markup).toContain('abcdefg…BCDEFG');
	});

	it('can display the complete transaction address', () => {
		const address = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';
		const markup = renderToStaticMarkup(<TxAddress address={address} wrap />);

		expect(markup).toContain('tx-address is-wrapped');
		expect(markup).toContain(`>${address}</a>`);
	});

	it('starts idle with an empty status region', () => {
		const markup = renderToStaticMarkup(<TxAddress address="abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG" />);

		expect(markup).toContain('role="status"></span>');
		expect(markup).not.toContain('Copy failed');
	});
});

describe('copyToClipboard', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('resolves copied when the clipboard accepts the text', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		await expect(copyToClipboard('tx-id')).resolves.toBe('copied');
		expect(writeText).toHaveBeenCalledWith('tx-id');
	});

	it('resolves failed instead of rejecting when the clipboard denies the write', async () => {
		const writeText = vi.fn().mockRejectedValue(new DOMException('Write permission denied.', 'NotAllowedError'));
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		await expect(copyToClipboard('tx-id')).resolves.toBe('failed');
	});

	it('resolves failed when the clipboard API is unavailable (insecure context)', async () => {
		vi.stubGlobal('navigator', {});

		await expect(copyToClipboard('tx-id')).resolves.toBe('failed');
	});
});

describe('TX_ADDRESS_COPY_LABELS', () => {
	it('announces a failed copy in the tooltip, label and status region', () => {
		expect(TX_ADDRESS_COPY_LABELS.failed).toEqual({
			tooltip: 'Copy failed',
			ariaLabel: 'Copy failed',
			status: 'Transaction address could not be copied.',
		});
	});

	it('keeps the existing idle and copied copy', () => {
		expect(TX_ADDRESS_COPY_LABELS.idle).toEqual({
			tooltip: 'Copy transaction address',
			ariaLabel: 'Copy transaction address',
			status: '',
		});
		expect(TX_ADDRESS_COPY_LABELS.copied).toEqual({
			tooltip: 'Copied',
			ariaLabel: 'Transaction address copied',
			status: 'Transaction address copied.',
		});
	});
});
