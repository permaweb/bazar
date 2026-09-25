import { describe, expect, it } from 'vitest';

import { udlTermsForPreset } from 'api/mint';

import {
	activeUdlTerms,
	matchingUdlPreset,
	UDL_PRESETS,
	udlGrantNeedsValue,
	udlGrantSelection,
	udlLicenseUrl,
	udlTermsMatchPreset,
	withShareWithPaymentAmount,
} from 'features/Create/model/udl';

const LICENSE_ID = 'L'.repeat(43);

describe('UDL presets', () => {
	it('recognizes the terms of every preset', () => {
		for (const preset of UDL_PRESETS) {
			const terms = udlTermsForPreset(preset);
			expect(udlTermsMatchPreset(terms, preset)).toBe(true);
			expect(matchingUdlPreset(terms)).toBe(preset);
		}
	});

	it('treats any consistent one-time fee as the payment preset and other edits as custom terms', () => {
		const payment = withShareWithPaymentAmount(udlTermsForPreset('share-with-payment'), '25');
		expect(matchingUdlPreset(payment)).toBe('share-with-payment');

		const mixedFees = { ...payment, commercialUse: { grant: 'one-time' as const, value: '9' } };
		expect(matchingUdlPreset(mixedFees)).toBeNull();

		const expiring = { ...udlTermsForPreset('open-use'), expiry: '5' };
		expect(matchingUdlPreset(expiring)).toBeNull();
		expect(matchingUdlPreset({ ...udlTermsForPreset('open-use'), accessFee: '1' })).toBeNull();
	});

	it('applies one amount to every usage grant of the payment preset', () => {
		const terms = withShareWithPaymentAmount(udlTermsForPreset('share-with-credit'), '3');
		expect(terms.derivation).toEqual({ grant: 'one-time', value: '3' });
		expect(terms.commercialUse).toEqual({ grant: 'one-time', value: '3' });
		expect(terms.dataModelTraining).toEqual({ grant: 'one-time', value: '3' });
	});
});

describe('UDL grants', () => {
	it('defaults a new grant amount and knows which grants need one', () => {
		expect(udlGrantSelection('')).toBeUndefined();
		expect(udlGrantSelection('allowed')).toEqual({ grant: 'allowed' });
		expect(udlGrantSelection('one-time')).toEqual({ grant: 'one-time', value: '1' });
		expect(udlGrantSelection('monthly')).toEqual({ grant: 'monthly', value: '1' });
		expect(udlGrantSelection('revenue-share')).toEqual({ grant: 'revenue-share', value: '10' });

		expect(udlGrantNeedsValue(undefined)).toBe(false);
		expect(udlGrantNeedsValue({ grant: 'credit' })).toBe(false);
		expect(udlGrantNeedsValue({ grant: 'revenue-share', value: '10' })).toBe(true);
	});
});

describe('active UDL terms', () => {
	it('writes nothing when the license is off, the configured terms, or only a custom license', () => {
		const terms = udlTermsForPreset('open-use');
		expect(
			activeUdlTerms({ enabled: false, configurationMode: 'configured', terms, customLicenseId: '' })
		).toBeUndefined();
		expect(activeUdlTerms({ enabled: true, configurationMode: 'configured', terms, customLicenseId: '' })).toBe(
			terms
		);
		expect(
			activeUdlTerms({ enabled: true, configurationMode: 'custom', terms, customLicenseId: LICENSE_ID })
		).toEqual({ licenseId: LICENSE_ID });
	});

	it('links a license definition through the active gateway', () => {
		expect(udlLicenseUrl(LICENSE_ID).endsWith(`/${LICENSE_ID}`)).toBe(true);
		expect(udlLicenseUrl()).toMatch(/^https?:\/\/.+\/[\w-]{43}$/);
	});
});
