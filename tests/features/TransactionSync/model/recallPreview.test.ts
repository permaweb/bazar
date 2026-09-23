import { describe, expect, it } from 'vitest';

import { TRANSACTION_SYNC_MESSAGES } from 'features/TransactionSync/messages';
import { recallContentPreview } from 'features/TransactionSync/model/recallPreview';

const language = TRANSACTION_SYNC_MESSAGES.en;

describe('recall content preview', () => {
	it('falls back to the offset label without content', () => {
		expect(recallContentPreview(undefined, 'Offset 4,096', language)).toEqual({
			kind: 'text',
			text: 'Offset 4,096',
		});
	});

	it('loads small images directly and unknown-size images through a bounded fetch', () => {
		const small = {
			kind: 'image' as const,
			contentType: 'image/png',
			contentLength: 1_024,
			contentUrl: 'https://a',
		};
		const unknown = { kind: 'image' as const, contentUrl: 'https://b' };
		const huge = { kind: 'image' as const, contentLength: 64 * 1024 * 1024, contentUrl: 'https://c' };

		expect(recallContentPreview(small, 'fallback', language)).toEqual({
			kind: 'image',
			src: 'https://a',
			title: 'image/png',
		});
		expect(recallContentPreview(unknown, 'fallback', language)).toEqual({
			kind: 'bounded-image',
			content: unknown,
			title: 'fallback',
		});
		expect(recallContentPreview(huge, 'fallback', language)).toEqual({ kind: 'text', text: '◫' });
	});

	it('summarizes other content by metadata or a kind symbol', () => {
		expect(
			recallContentPreview(
				{ kind: 'json', metadata: ['3 keys', 'v1'], contentUrl: 'https://j' },
				'fallback',
				language
			)
		).toEqual({ kind: 'text', text: '3 keys · v1' });
		expect(recallContentPreview({ kind: 'audio', contentUrl: 'https://a' }, 'fallback', language)).toEqual({
			kind: 'text',
			text: '♪',
		});
		expect(recallContentPreview({ kind: 'pdf', contentUrl: 'https://p' }, 'fallback', language)).toEqual({
			kind: 'text',
			text: 'PDF',
		});
		expect(recallContentPreview({ kind: 'text', contentUrl: 'https://t' }, 'fallback', language)).toEqual({
			kind: 'text',
			text: language.transactionSyncRecallTextSymbol,
		});
	});
});
