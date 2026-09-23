import React from 'react';

import { type UdlPreset, type UdlTerms, udlTermsForPreset } from 'api/mint';

import { isArweaveId } from 'helpers/arweave-id';

import { activeUdlTerms, matchingUdlPreset, type UdlConfigurationMode, withShareWithPaymentAmount } from '../model/udl';

export type UdlLicense = {
	enabled: boolean;
	terms: UdlTerms;
	configurationMode: UdlConfigurationMode;
	/** The custom license transaction ID as entered (whitespace removed). */
	customLicenseId: string;
	customLicenseIdValid: boolean;
	/** The preset the configured terms still match, if any. */
	preset: UdlPreset | null;
	/** The license tags a mint writes, or `undefined` for none. */
	active: UdlTerms | undefined;
};

export type UdlLicenseControls = UdlLicense & {
	setEnabled(enabled: boolean): void;
	applyPreset(preset: UdlPreset): void;
	setShareWithPaymentAmount(value: string): void;
	updateTerms(patch: Partial<UdlTerms>): void;
	setConfigurationMode(mode: UdlConfigurationMode): void;
	setCustomLicenseId(value: string): void;
};

/** Universal Data License choices for a mint: presets, configured terms, or a custom license transaction. */
export function useUdlLicense(): UdlLicenseControls {
	const [enabled, setEnabled] = React.useState(true);
	const [terms, setTerms] = React.useState<UdlTerms>(() => udlTermsForPreset('share-with-credit'));
	const [configurationMode, setConfigurationMode] = React.useState<UdlConfigurationMode>('configured');
	const [customLicenseId, setCustomLicenseId] = React.useState('');
	const normalizedCustomLicenseId = customLicenseId.trim();
	const active = React.useMemo(
		() => activeUdlTerms({ enabled, configurationMode, terms, customLicenseId: normalizedCustomLicenseId }),
		[normalizedCustomLicenseId, configurationMode, enabled, terms]
	);

	return {
		enabled,
		terms,
		configurationMode,
		customLicenseId,
		customLicenseIdValid: isArweaveId(normalizedCustomLicenseId),
		preset: matchingUdlPreset(terms),
		active,
		setEnabled,
		applyPreset: (preset) => {
			setConfigurationMode('configured');
			setTerms(udlTermsForPreset(preset));
		},
		setShareWithPaymentAmount: (value) => setTerms((current) => withShareWithPaymentAmount(current, value)),
		updateTerms: (patch) => setTerms((current) => ({ ...current, ...patch })),
		setConfigurationMode,
		setCustomLicenseId: (value) => setCustomLicenseId(value.trim()),
	};
}
