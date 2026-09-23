import React from 'react';
import { ArrowUpRight } from 'lucide-react';

import type { UdlPreset, UdlTerms } from 'api/mint';

import udlLogo from 'assets/udl.svg';
import { ArCurrencyLabel } from 'components/atoms/ArCurrencyLabel';
import { Icon } from 'components/atoms/Icon';
import { Pressable } from 'components/atoms/Pressable';
import { SegmentedTabs } from 'components/atoms/SegmentedTabs';
import { Select } from 'components/atoms/Select';
import { TextInput } from 'components/atoms/TextInput';

import type { UdlLicense } from '../../../hooks/useUdlLicense';
import {
	type UdlConfigurationMode,
	udlGrantNeedsValue,
	udlGrantSelection,
	type UdlGrantValue,
	udlLicenseUrl,
} from '../../../model/udl';

function WireframeGlobeIcon() {
	const clipId = React.useId();
	return (
		<svg
			aria-hidden="true"
			className="ui-icon ui-icon--sm udl-wireframe-globe"
			fill="currentColor"
			viewBox="0 0 256 256"
		>
			<defs>
				<clipPath id={clipId}>
					<circle cx="128" cy="128" r="88" />
				</clipPath>
			</defs>
			<g clipPath={`url(#${clipId})`} fill="none" stroke="currentColor" strokeWidth="16">
				<path d="M32 96h192M32 160h192" />
				<g className="udl-wireframe-globe__details">
					{[0, 128, 256, 384].map((center) => (
						<ellipse cx={center} cy="128" key={center} rx="44" ry="96" />
					))}
				</g>
			</g>
			<circle cx="128" cy="128" fill="none" r="96" stroke="currentColor" strokeWidth="16" />
		</svg>
	);
}

function FloatingPaymentIcon() {
	return (
		<svg aria-hidden="true" className="ui-icon ui-icon--sm udl-payment-icon" fill="none" viewBox="0 0 24 24">
			<g className="udl-payment-icon__pluses" stroke="currentColor" strokeLinecap="round" strokeWidth="1.35">
				<path className="udl-payment-icon__plus" d="M4.5 7v3M3 8.5h3" />
				<path className="udl-payment-icon__plus" d="M19.5 5.5v3M18 7h3" />
				<path className="udl-payment-icon__plus" d="M4.5 15v3M3 16.5h3" />
				<path className="udl-payment-icon__plus" d="M19.5 14v3M18 15.5h3" />
			</g>
			<g className="udl-payment-icon__coin" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
				<circle cx="12" cy="11" r="6.75" />
				<path d="M12 6.75v8.5" />
				<path d="M14.6 8.25h-3.7a1.7 1.7 0 0 0 0 3.4h2.2a1.7 1.7 0 0 1 0 3.4H9.4" />
			</g>
		</svg>
	);
}

function AnimatedCreditBadgeIcon() {
	return (
		<svg aria-hidden="true" className="ui-icon ui-icon--sm udl-credit-icon" fill="none" viewBox="0 0 24 24">
			<g className="udl-credit-icon__badge" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5">
				<polygon points="12,3.5 13.88,5 16.25,4.64 17.13,6.87 19.36,7.75 19,10.12 20.5,12 19,13.88 19.36,16.25 17.13,17.13 16.25,19.36 13.88,19 12,20.5 10.12,19 7.75,19.36 6.87,17.13 4.64,16.25 5,13.88 3.5,12 5,10.12 4.64,7.75 6.87,6.87 7.75,4.64 10.12,5" />
			</g>
			<path
				className="udl-credit-icon__check"
				d="m8.5 11.7 2.2 2.2 4.8-5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.7"
			/>
			<g className="udl-credit-icon__particles" fill="currentColor">
				<circle className="udl-credit-icon__particle" cx="5" cy="5" r="1" />
				<circle className="udl-credit-icon__particle" cx="19" cy="5.5" r="0.9" />
				<circle className="udl-credit-icon__particle" cx="4" cy="18" r="0.8" />
				<circle className="udl-credit-icon__particle" cx="20" cy="18" r="1" />
			</g>
		</svg>
	);
}

const UDL_PRESET_OPTIONS: Array<{
	value: UdlPreset;
	label: string;
	description: string;
	icon: React.ReactNode;
}> = [
	{
		value: 'share-with-credit',
		label: 'Share with credit',
		description: 'Derivatives and commercial use are allowed with credit. AI training is allowed.',
		icon: <AnimatedCreditBadgeIcon />,
	},
	{
		value: 'share-with-payment',
		label: 'Share with payment',
		description: 'Access is free. All usage rights are allowed with a one-time fee.',
		icon: <FloatingPaymentIcon />,
	},
	{
		value: 'open-use',
		label: 'Open use',
		description: 'Derivatives, commercial use, and AI training are allowed.',
		icon: <WireframeGlobeIcon />,
	},
];

function UdlGrantField(props: {
	label: string;
	value?: UdlGrantValue;
	options: Array<[string, string]>;
	onChange: (value: UdlGrantValue | undefined) => void;
}) {
	const needsValue = udlGrantNeedsValue(props.value);
	return (
		<div className={needsValue ? 'udl-field udl-grant-field has-value' : 'udl-field udl-grant-field'}>
			<label>{props.label}</label>
			<div className={needsValue ? 'udl-field-control with-value' : 'udl-field-control'}>
				<Select
					label={props.label}
					showLabel={false}
					value={props.value?.grant ?? ''}
					options={[
						{ value: '', label: 'Not granted' },
						...props.options.map(([optionValue, optionLabel]) => ({
							value: optionValue,
							label: optionLabel,
						})),
					]}
					onChange={(grant) => props.onChange(udlGrantSelection(grant))}
				/>
				{props.value && needsValue ? (
					<UdlGrantValueInput label={props.label} value={props.value} onChange={props.onChange} />
				) : null}
			</div>
		</div>
	);
}

function UdlGrantValueInput(props: {
	label: string;
	value: UdlGrantValue;
	onChange: (value: UdlGrantValue | undefined) => void;
}) {
	return (
		<label className="udl-value">
			<span className="udl-value-label">{props.value.grant === 'revenue-share' ? 'Percent' : 'Amount'}</span>
			<TextInput
				aria-label={`${props.label} ${props.value.grant === 'revenue-share' ? 'percentage' : 'fee amount'}`}
				className={props.value.grant === 'revenue-share' ? undefined : 'has-currency-suffix'}
				inputMode="decimal"
				min="0.000000000001"
				max={props.value.grant === 'revenue-share' ? '100' : undefined}
				step="any"
				type="number"
				value={props.value.value ?? '1'}
				onChange={(event) => props.onChange({ ...props.value, value: event.target.value || '1' })}
			/>
			{props.value.grant !== 'revenue-share' ? (
				<span className="udl-value-suffix">
					<ArCurrencyLabel />
				</span>
			) : null}
		</label>
	);
}

export default function UdlLicenseEditor(props: {
	/** Whether the terms describe one asset or every asset in a collection. */
	scope: 'asset' | 'collection';
	license: UdlLicense;
	onEnabledChange: (enabled: boolean) => void;
	onPresetApply: (preset: UdlPreset) => void;
	onShareWithPaymentAmountChange: (value: string) => void;
	onTermsChange: (patch: Partial<UdlTerms>) => void;
	onConfigurationModeChange: (mode: UdlConfigurationMode) => void;
	onCustomLicenseIdChange: (value: string) => void;
}) {
	return (
		<section className="create-license" aria-labelledby="mint-license-heading">
			<div className="create-license-heading">
				<div>
					<strong id="mint-license-heading">Usage rights</strong>
					<span>
						Attach machine-readable terms stored with{' '}
						{props.scope === 'asset' ? 'this asset' : 'every asset'} on Arweave.
					</span>
				</div>
				<Select<'udl' | 'none'>
					label="License"
					value={props.license.enabled ? 'udl' : 'none'}
					options={[
						{ value: 'udl', label: 'Universal Data License 0.2' },
						{ value: 'none', label: 'No license tags' },
					]}
					onChange={(value) => props.onEnabledChange(value === 'udl')}
					showLabel={false}
				/>
			</div>

			{props.license.enabled ? (
				<div className="udl-options">
					<p>
						<a href={udlLicenseUrl()} target="_blank" rel="noreferrer">
							Read UDL 0.2 <Icon icon={ArrowUpRight} size="sm" />
						</a>
					</p>
					<img alt="Universal Data License" className="udl-options-logo" src={udlLogo} />
					<div aria-label="UDL presets" className="udl-presets" role="group">
						{UDL_PRESET_OPTIONS.map((preset) => (
							<Pressable
								aria-pressed={
									props.license.configurationMode === 'configured' &&
									props.license.preset === preset.value
								}
								className={`udl-preset udl-preset--${preset.value}`}
								key={preset.value}
								onClick={() => props.onPresetApply(preset.value)}
								type="button"
							>
								<div className="udl-preset-title">
									{preset.icon}
									<strong>{preset.label}</strong>
								</div>
								<span>{preset.description}</span>
							</Pressable>
						))}
					</div>
					{props.license.configurationMode === 'configured' &&
					props.license.preset === 'share-with-payment' ? (
						<div className="udl-preset-payment">
							<div className="udl-preset-payment-copy">
								<strong>One-time fee</strong>
								<span>Applied to derivatives, commercial use, and AI model training.</span>
							</div>
							<label className="udl-value udl-preset-payment-value">
								<span className="udl-value-label">Amount</span>
								<TextInput
									aria-label="Share with payment one-time fee amount"
									className="has-currency-suffix"
									inputMode="decimal"
									min="0.000000000001"
									step="any"
									type="number"
									value={props.license.terms.derivation?.value ?? '1'}
									onBlur={(event) => {
										if (!event.target.value) props.onShareWithPaymentAmountChange('1');
									}}
									onChange={(event) => props.onShareWithPaymentAmountChange(event.target.value)}
								/>
								<span className="udl-value-suffix">
									<ArCurrencyLabel />
								</span>
							</label>
						</div>
					) : null}

					<details className="udl-advanced">
						<summary>
							Advanced UDL options
							{props.license.configurationMode === 'custom'
								? ' · Custom transaction'
								: props.license.preset
								? ''
								: ' · Custom terms'}
						</summary>
						<div className="udl-advanced-content">
							<SegmentedTabs<UdlConfigurationMode>
								active={props.license.configurationMode}
								ariaLabel="UDL configuration source"
								className="udl-source-tabs"
								idPrefix="udl-source"
								onChange={props.onConfigurationModeChange}
								tabs={[
									{
										value: 'configured',
										label: 'Bazar configuration',
										panelId: 'udl-configured-panel',
									},
									{
										value: 'custom',
										label: 'Custom transaction ID',
										panelId: 'udl-custom-panel',
									},
								]}
							/>
							{props.license.configurationMode === 'configured' ? (
								<div
									aria-labelledby="udl-source-configured-tab"
									className="udl-source-panel"
									id="udl-configured-panel"
									role="tabpanel"
								>
									<section className="udl-term-section" aria-labelledby="udl-payment-terms-heading">
										<div className="udl-term-section-heading">
											<strong id="udl-payment-terms-heading">Usage and payment</strong>
											<span>
												Choose access and usage permissions, including any required fees.
											</span>
										</div>
										<div className="udl-grid udl-payment-terms-grid">
											<div className="udl-field">
												<label>Access</label>
												<div
													className={
														props.license.terms.accessFee
															? 'udl-field-control with-value'
															: 'udl-field-control'
													}
												>
													<Select<'free' | 'one-time'>
														label="Access"
														showLabel={false}
														value={props.license.terms.accessFee ? 'one-time' : 'free'}
														options={[
															{ value: 'free', label: 'Free' },
															{
																value: 'one-time',
																label: 'One-time fee',
															},
														]}
														onChange={(value) =>
															props.onTermsChange({
																accessFee: value === 'one-time' ? '1' : undefined,
															})
														}
													/>
													{props.license.terms.accessFee ? (
														<label className="udl-value">
															<span className="udl-value-label">Amount</span>
															<TextInput
																aria-label="Access fee amount"
																className="has-currency-suffix"
																inputMode="decimal"
																min="0.000000000001"
																step="any"
																type="number"
																value={props.license.terms.accessFee}
																onChange={(event) =>
																	props.onTermsChange({
																		accessFee: event.target.value || '1',
																	})
																}
															/>
															<span className="udl-value-suffix">
																<ArCurrencyLabel />
															</span>
														</label>
													) : null}
												</div>
											</div>
											<UdlGrantField
												label="Derivatives"
												value={props.license.terms.derivation}
												options={[
													['allowed', 'Allowed'],
													['credit', 'Allowed with credit'],
													['indication', 'Allowed with change indication'],
													['license-passthrough', 'Allowed with license passthrough'],
													['revenue-share', 'Allowed with revenue share'],
													['one-time', 'Allowed with one-time fee'],
													['monthly', 'Allowed with monthly fee'],
												]}
												onChange={(value) =>
													props.onTermsChange({ derivation: value as UdlTerms['derivation'] })
												}
											/>
											<UdlGrantField
												label="Commercial use"
												value={props.license.terms.commercialUse}
												options={[
													['allowed', 'Allowed'],
													['credit', 'Allowed with credit'],
													['revenue-share', 'Allowed with revenue share'],
													['one-time', 'Allowed with one-time fee'],
													['monthly', 'Allowed with monthly fee'],
												]}
												onChange={(value) =>
													props.onTermsChange({
														commercialUse: value as UdlTerms['commercialUse'],
													})
												}
											/>
											<UdlGrantField
												label="AI model training"
												value={props.license.terms.dataModelTraining}
												options={[
													['allowed', 'Allowed'],
													['one-time', 'Allowed with one-time fee'],
													['monthly', 'Allowed with monthly fee'],
												]}
												onChange={(value) =>
													props.onTermsChange({
														dataModelTraining: value as UdlTerms['dataModelTraining'],
													})
												}
											/>
										</div>
									</section>

									<section className="udl-term-section" aria-labelledby="udl-other-terms-heading">
										<div className="udl-term-section-heading">
											<strong id="udl-other-terms-heading">Other terms</strong>
											<span>Set the fallback rights and duration for this license.</span>
										</div>

										<div className="udl-grid udl-other-terms-grid">
											<div className="udl-field">
												<div className="udl-field-control">
													<Select<'included' | 'excluded'>
														label="Unknown usage rights"
														value={props.license.terms.unknownUsageRights ?? 'included'}
														options={[
															{
																value: 'included',
																label: 'Included when legally available',
															},
															{ value: 'excluded', label: 'Excluded' },
														]}
														onChange={(value) =>
															props.onTermsChange({
																unknownUsageRights:
																	value === 'excluded' ? 'excluded' : undefined,
															})
														}
													/>
												</div>
											</div>
											<div className="udl-field">
												<label htmlFor="udl-expiry">License term</label>
												<div className="udl-field-control with-suffix">
													<TextInput
														id="udl-expiry"
														inputMode="numeric"
														min="1"
														placeholder="Unlimited"
														step="1"
														type="number"
														value={props.license.terms.expiry ?? ''}
														onChange={(event) =>
															props.onTermsChange({
																expiry: event.target.value || undefined,
															})
														}
													/>
													<span>years</span>
												</div>
											</div>
										</div>
									</section>
								</div>
							) : (
								<section
									aria-labelledby="udl-source-custom-tab"
									className="udl-term-section udl-custom-license"
									id="udl-custom-panel"
									role="tabpanel"
								>
									<div className="udl-term-section-heading">
										<strong>Custom UDL transaction ID</strong>
										<span>
											Use an existing on-chain license definition. Bazar will write only the
											License tag; presets and configured terms will not be included.
										</span>
									</div>
									<div className="udl-field">
										<label htmlFor="udl-custom-license-id">Transaction ID</label>
										<TextInput
											aria-describedby="udl-custom-license-help"
											aria-invalid={
												Boolean(props.license.customLicenseId) &&
												!props.license.customLicenseIdValid
											}
											autoCapitalize="none"
											autoComplete="off"
											id="udl-custom-license-id"
											maxLength={43}
											placeholder="43-character Arweave transaction ID"
											spellCheck={false}
											value={props.license.customLicenseId}
											onChange={(event) => props.onCustomLicenseIdChange(event.target.value)}
										/>
										<span className="udl-field-help" id="udl-custom-license-help">
											{props.license.customLicenseIdValid ? (
												<a
													href={udlLicenseUrl(props.license.customLicenseId)}
													target="_blank"
													rel="noreferrer"
												>
													Open license transaction <Icon icon={ArrowUpRight} size="sm" />
												</a>
											) : (
												'Enter the transaction ID of the UDL definition you want this asset to use.'
											)}
										</span>
									</div>
								</section>
							)}
						</div>
					</details>
				</div>
			) : (
				<p className="udl-none">No license metadata will be written. Copyright defaults still apply.</p>
			)}
		</section>
	);
}
