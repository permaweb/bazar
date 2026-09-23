import type { LicenseDefaultCode, LicenseFieldKey, LicenseProperty } from 'api/marketplace';

import type { AssetDetailMessages } from '../messages';

/** One UDL row as the asset pages render it. */
export type LicenseDisplayProperty = {
	key: LicenseFieldKey;
	label: string;
	value: string;
};

const FIELD_LABEL_KEYS: Record<LicenseFieldKey, keyof AssetDetailMessages> = {
	license: 'licenseFieldLicense',
	access: 'licenseFieldAccess',
	'access-fee': 'licenseFieldAccessFee',
	derivation: 'licenseFieldDerivation',
	'derivation-fee': 'licenseFieldDerivationFee',
	'unknown-usage-rights': 'licenseFieldUnknownUsageRights',
	'commercial-use': 'licenseFieldCommercialUse',
	'commercial-use-fee': 'licenseFieldCommercialUseFee',
	'data-model-training': 'licenseFieldDataModelTraining',
	expiry: 'licenseFieldExpiry',
	'payment-mode': 'licenseFieldPaymentMode',
	'payment-address': 'licenseFieldPaymentAddress',
	currency: 'licenseFieldCurrency',
};

const DEFAULT_VALUE_KEYS: Record<LicenseDefaultCode, keyof AssetDetailMessages> = {
	'access-free': 'licenseValueAccessFree',
	'derivation-non-commercial': 'licenseValueDerivationNonCommercial',
	'unknown-usage-rights-included': 'licenseValueUnknownUsageRightsIncluded',
	'commercial-use-not-allowed': 'licenseValueCommercialUseNotAllowed',
	'data-model-training-not-allowed': 'licenseValueDataModelTrainingNotAllowed',
	'expiry-unlimited': 'licenseValueExpiryUnlimited',
	'currency-u': 'licenseValueCurrencyU',
};

function messageText(messages: AssetDetailMessages, key: keyof AssetDetailMessages): string {
	const message = messages[key];
	return typeof message === 'string' ? message : message.other;
}

/** Map the adapter's structured UDL terms onto the localized labels and values the asset pages show. */
export function licenseDisplayProperties(
	properties: LicenseProperty[],
	messages: AssetDetailMessages
): LicenseDisplayProperty[] {
	return properties.map((property) => ({
		key: property.key,
		label: messageText(messages, FIELD_LABEL_KEYS[property.key]),
		value:
			property.value.kind === 'declared'
				? property.value.text
				: property.value.kind === 'udl-license'
				? messages.licenseValueUdl
				: messageText(messages, DEFAULT_VALUE_KEYS[property.value.code]),
	}));
}
