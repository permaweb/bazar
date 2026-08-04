import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { UnavailableOperationRecoveryNotice } from './UnavailableOperationRecovery';

describe('unavailable operation recovery notice', () => {
	it('blocks silent replacement while preserving the exact transaction and recovery choices', () => {
		const txId = 't'.repeat(43);
		const markup = renderToStaticMarkup(React.createElement(UnavailableOperationRecoveryNotice, {
			recovery: {
				key: 'bazar-operation:asset:signer',
				kind: 'sell',
				signer: 's'.repeat(43),
				txId,
			},
			stateNoun: 'ownership and orders above',
			onRefresh: vi.fn(),
			onDiscard: vi.fn(),
		}));

		expect(markup).toContain('No replacement action will be created while this record remains.');
		expect(markup).toContain(`href="https://viewblock.io/arweave/tx/${txId}"`);
		expect(markup).toContain('Refresh live state');
		expect(markup).toContain('Discard local tracking');
		expect(markup).toContain('The live source of truth remains current ownership and orders above.');
	});
});
