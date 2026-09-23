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
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import type { UdlLicense } from '../../../hooks/useUdlLicense';
import { CREATE_MESSAGES, type CreateMessages } from '../../../messages';
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
	labelKey: keyof CreateMessages;
	detailKey: keyof CreateMessages;
	icon: React.ReactNode;
}> = [
	{
		value: 'share-with-credit',
		labelKey: 'udlPresetShareWithCreditLabel',
		detailKey: 'udlPresetShareWithCreditDetail',
		icon: <AnimatedCreditBadgeIcon />,
	},
	{
		value: 'share-with-payment',
		labelKey: 'udlPresetShareWithPaymentLabel',
		detailKey: 'udlPresetShareWithPaymentDetail',
		icon: <FloatingPaymentIcon />,
	},
	{
		value: 'open-use',
		labelKey: 'udlPresetOpenUseLabel',
		detailKey: 'udlPresetOpenUseDetail',
		icon: <WireframeGlobeIcon />,
	},
];

function UdlGrantField(props: {
	label: string;
	value?: UdlGrantValue;
	options: Array<[string, string]>;
	onChange: (value: UdlGrantValue | undefined) => void;
}) {
	const messages = useMessages(CREATE_MESSAGES);
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
						{ value: '', label: messages.udlGrantNotGranted },
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
	const messages = useMessages(CREATE_MESSAGES);
	return (
		<label className="udl-value">
			<span className="udl-value-label">
				{props.value.grant === 'revenue-share' ? messages.udlValuePercent : messages.udlValueAmount}
			</span>
			<TextInput
				aria-label={formatMessage(messages.udlValueInputLabel, {
					label: props.label,
					kind:
						props.value.grant === 'revenue-share'
							? messages.udlValueKindPercentage
							: messages.udlValueKindFeeAmount,
				})}
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
	const messages = useMessages(CREATE_MESSAGES);
	return (
		<section className="create-license" aria-labelledby="mint-license-heading">
			<div className="create-license-heading">
				<div>
					<strong id="mint-license-heading">{messages.udlHeading}</strong>
					<span>
						{props.scope === 'asset' ? messages.udlHeadingDetailAsset : messages.udlHeadingDetailCollection}
					</span>
				</div>
				<Select<'udl' | 'none'>
					label={messages.udlLicenseSelectLabel}
					value={props.license.enabled ? 'udl' : 'none'}
					options={[
						{ value: 'udl', label: messages.udlLicenseOptionUdl },
						{ value: 'none', label: messages.udlLicenseOptionNone },
					]}
					onChange={(value) => props.onEnabledChange(value === 'udl')}
					showLabel={false}
				/>
			</div>

			{props.license.enabled ? (
				<div className="udl-options">
					<p>
						<a href={udlLicenseUrl()} target="_blank" rel="noreferrer">
							{messages.udlReadLink} <Icon icon={ArrowUpRight} size="sm" />
						</a>
					</p>
					<img alt={messages.udlLogoAlt} className="udl-options-logo" src={udlLogo} />
					<div aria-label={messages.udlPresetsLabel} className="udl-presets" role="group">
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
									<strong>{messages[preset.labelKey]}</strong>
								</div>
								<span>{messages[preset.detailKey]}</span>
							</Pressable>
						))}
					</div>
					{props.license.configurationMode === 'configured' &&
					props.license.preset === 'share-with-payment' ? (
						<div className="udl-preset-payment">
							<div className="udl-preset-payment-copy">
								<strong>{messages.udlOneTimeFeeTitle}</strong>
								<span>{messages.udlOneTimeFeeDetail}</span>
							</div>
							<label className="udl-value udl-preset-payment-value">
								<span className="udl-value-label">{messages.udlValueAmount}</span>
								<TextInput
									aria-label={messages.udlShareWithPaymentAmountLabel}
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
							{messages.udlAdvancedSummary}
							{props.license.configurationMode === 'custom'
								? messages.udlAdvancedCustomTransaction
								: props.license.preset
								? ''
								: messages.udlAdvancedCustomTerms}
						</summary>
						<div className="udl-advanced-content">
							<SegmentedTabs<UdlConfigurationMode>
								active={props.license.configurationMode}
								ariaLabel={messages.udlSourceTabsLabel}
								className="udl-source-tabs"
								idPrefix="udl-source"
								onChange={props.onConfigurationModeChange}
								tabs={[
									{
										value: 'configured',
										label: messages.udlSourceConfigured,
										panelId: 'udl-configured-panel',
									},
									{
										value: 'custom',
										label: messages.udlSourceCustom,
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
											<strong id="udl-payment-terms-heading">
												{messages.udlPaymentTermsHeading}
											</strong>
											<span>{messages.udlPaymentTermsDetail}</span>
										</div>
										<div className="udl-grid udl-payment-terms-grid">
											<div className="udl-field">
												<label>{messages.udlAccessLabel}</label>
												<div
													className={
														props.license.terms.accessFee
															? 'udl-field-control with-value'
															: 'udl-field-control'
													}
												>
													<Select<'free' | 'one-time'>
														label={messages.udlAccessLabel}
														showLabel={false}
														value={props.license.terms.accessFee ? 'one-time' : 'free'}
														options={[
															{ value: 'free', label: messages.udlAccessFree },
															{
																value: 'one-time',
																label: messages.udlAccessOneTime,
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
															<span className="udl-value-label">
																{messages.udlValueAmount}
															</span>
															<TextInput
																aria-label={messages.udlAccessFeeAmountLabel}
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
												label={messages.udlDerivativesLabel}
												value={props.license.terms.derivation}
												options={[
													['allowed', messages.udlGrantAllowed],
													['credit', messages.udlGrantCredit],
													['indication', messages.udlGrantIndication],
													['license-passthrough', messages.udlGrantLicensePassthrough],
													['revenue-share', messages.udlGrantRevenueShare],
													['one-time', messages.udlGrantOneTime],
													['monthly', messages.udlGrantMonthly],
												]}
												onChange={(value) =>
													props.onTermsChange({ derivation: value as UdlTerms['derivation'] })
												}
											/>
											<UdlGrantField
												label={messages.udlCommercialUseLabel}
												value={props.license.terms.commercialUse}
												options={[
													['allowed', messages.udlGrantAllowed],
													['credit', messages.udlGrantCredit],
													['revenue-share', messages.udlGrantRevenueShare],
													['one-time', messages.udlGrantOneTime],
													['monthly', messages.udlGrantMonthly],
												]}
												onChange={(value) =>
													props.onTermsChange({
														commercialUse: value as UdlTerms['commercialUse'],
													})
												}
											/>
											<UdlGrantField
												label={messages.udlDataModelTrainingLabel}
												value={props.license.terms.dataModelTraining}
												options={[
													['allowed', messages.udlGrantAllowed],
													['one-time', messages.udlGrantOneTime],
													['monthly', messages.udlGrantMonthly],
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
											<strong id="udl-other-terms-heading">
												{messages.udlOtherTermsHeading}
											</strong>
											<span>{messages.udlOtherTermsDetail}</span>
										</div>

										<div className="udl-grid udl-other-terms-grid">
											<div className="udl-field">
												<div className="udl-field-control">
													<Select<'included' | 'excluded'>
														label={messages.udlUnknownRightsLabel}
														value={props.license.terms.unknownUsageRights ?? 'included'}
														options={[
															{
																value: 'included',
																label: messages.udlUnknownRightsIncluded,
															},
															{
																value: 'excluded',
																label: messages.udlUnknownRightsExcluded,
															},
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
												<label htmlFor="udl-expiry">{messages.udlExpiryLabel}</label>
												<div className="udl-field-control with-suffix">
													<TextInput
														id="udl-expiry"
														inputMode="numeric"
														min="1"
														placeholder={messages.udlExpiryPlaceholder}
														step="1"
														type="number"
														value={props.license.terms.expiry ?? ''}
														onChange={(event) =>
															props.onTermsChange({
																expiry: event.target.value || undefined,
															})
														}
													/>
													<span>{messages.udlExpiryYears}</span>
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
										<strong>{messages.udlCustomHeading}</strong>
										<span>{messages.udlCustomDetail}</span>
									</div>
									<div className="udl-field">
										<label htmlFor="udl-custom-license-id">{messages.udlCustomIdLabel}</label>
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
											placeholder={messages.udlCustomIdPlaceholder}
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
													{messages.udlCustomIdOpenLink}{' '}
													<Icon icon={ArrowUpRight} size="sm" />
												</a>
											) : (
												messages.udlCustomIdHelp
											)}
										</span>
									</div>
								</section>
							)}
						</div>
					</details>
				</div>
			) : (
				<p className="udl-none">{messages.udlNone}</p>
			)}
		</section>
	);
}
