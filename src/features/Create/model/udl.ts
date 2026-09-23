import { UDL_LICENSE_ID, type UdlPreset, type UdlTerms, udlTermsForPreset } from 'api/mint';

import { arweaveGatewayFromLocation } from 'helpers/config';

export type UdlGrantValue = NonNullable<
	UdlTerms['derivation'] | UdlTerms['commercialUse'] | UdlTerms['dataModelTraining']
>;

/** Terms come from Bazar's presets and fields, or from an existing on-chain license definition. */
export type UdlConfigurationMode = 'configured' | 'custom';

/** Preset order, which is also the match priority when terms satisfy more than one preset. */
export const UDL_PRESETS: ReadonlyArray<UdlPreset> = ['share-with-credit', 'share-with-payment', 'open-use'];

const UDL_GRANT_KEYS = ['derivation', 'commercialUse', 'dataModelTraining'] as const;

/** Grants that carry a fee amount or a revenue-share percentage. */
const VALUED_GRANTS: ReadonlyArray<string> = ['revenue-share', 'one-time', 'monthly'];

export function udlTermsMatchPreset(terms: UdlTerms, preset: UdlPreset): boolean {
	const expected = udlTermsForPreset(preset);
	const baseTermsMatch =
		terms.accessFee === expected.accessFee &&
		terms.unknownUsageRights === expected.unknownUsageRights &&
		terms.expiry === expected.expiry;
	const grantsMatch = UDL_GRANT_KEYS.every((key) => terms[key]?.grant === expected[key]?.grant);
	if (preset === 'share-with-payment') {
		const feeValues = UDL_GRANT_KEYS.map((key) => terms[key]?.value ?? '');
		return baseTermsMatch && grantsMatch && feeValues.every((value) => value === feeValues[0]);
	}
	return baseTermsMatch && grantsMatch && UDL_GRANT_KEYS.every((key) => terms[key]?.value === expected[key]?.value);
}

/** The preset the configured terms still describe, or `null` once they have been customized. */
export function matchingUdlPreset(terms: UdlTerms): UdlPreset | null {
	return UDL_PRESETS.find((preset) => udlTermsMatchPreset(terms, preset)) ?? null;
}

/** The license a mint writes: none, the configured terms, or only the custom license transaction. */
export function activeUdlTerms(input: {
	enabled: boolean;
	configurationMode: UdlConfigurationMode;
	terms: UdlTerms;
	customLicenseId: string;
}): UdlTerms | undefined {
	if (!input.enabled) return undefined;
	return input.configurationMode === 'custom' ? { licenseId: input.customLicenseId } : input.terms;
}

/** "Share with payment" charges one fee amount across every usage grant. */
export function withShareWithPaymentAmount(terms: UdlTerms, value: string): UdlTerms {
	return {
		...terms,
		derivation: { grant: 'one-time', value },
		commercialUse: { grant: 'one-time', value },
		dataModelTraining: { grant: 'one-time', value },
	};
}

export function udlGrantNeedsValue(value: UdlGrantValue | undefined): boolean {
	return Boolean(value && VALUED_GRANTS.includes(value.grant));
}

/** A newly selected grant with its default amount: 1 AR for fees, 10% for revenue share. */
export function udlGrantSelection(grant: string): UdlGrantValue | undefined {
	if (!grant) return undefined;
	return {
		grant: grant as UdlGrantValue['grant'],
		...(['one-time', 'monthly'].includes(grant)
			? { value: '1' }
			: grant === 'revenue-share'
			? { value: '10' }
			: {}),
	};
}

/** Gateway link to a license definition transaction; Bazar's UDL 0.2 definition by default. */
export function udlLicenseUrl(licenseId: string = UDL_LICENSE_ID): string {
	return `${arweaveGatewayFromLocation()}/${licenseId}`;
}
