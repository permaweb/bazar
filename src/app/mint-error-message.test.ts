import { describe, expect, it } from 'vitest';

import { mintErrorMessage } from './App';

describe('mintErrorMessage', () => {
	it('explains exhausted uploads without dashed error codes', () => {
		const guidance = 'Check your connection and try again; your earlier uploads are kept.';
		expect(mintErrorMessage(new Error('mint-upload-network'))).toBe(
			`The gateway did not accept the upload. ${guidance}`
		);
		// A status answer means the gateway saw the signed upload, so its copy also says where the ID is listed.
		expect(mintErrorMessage(new Error('mint-upload-503'))).toBe(
			'Your wallet signed this upload, but the Arweave gateway did not accept it, so as far as Bazar can tell it was not published or charged. Its transaction ID is listed in Transaction activity. ' +
				guidance
		);
	});
});
