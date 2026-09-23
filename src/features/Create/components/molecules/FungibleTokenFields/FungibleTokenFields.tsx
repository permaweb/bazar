import React from 'react';
import { Upload, X } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { Icon } from 'components/atoms/Icon';
import { TextInput } from 'components/atoms/TextInput';
import { formatBytes } from 'helpers/format';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { CREATE_MESSAGES } from '../../../messages';

export default function FungibleTokenFields(props: {
	name: string;
	ticker: string;
	wholeSupply: string;
	denomination: string;
	logo: File | null;
	logoPreview: string;
	logoTxId: string;
	limits: { maxTickerLength: number; maxWholeSupply: bigint; maxDenomination: number };
	onTickerChange: (ticker: string) => void;
	onWholeSupplyChange: (wholeSupply: string) => void;
	onDenominationChange: (denomination: string) => void;
	/** Returns `false` when the logo was rejected. */
	onLogoSelect: (logo: File | null) => boolean;
}) {
	const messages = useMessages(CREATE_MESSAGES);
	const logoInput = React.useRef<HTMLInputElement>(null);

	const handleLogoSelect = (next: File | null) => {
		if (!props.onLogoSelect(next) && logoInput.current) logoInput.current.value = '';
	};

	return (
		<>
			<div className="create-field">
				<label htmlFor="mint-ticker">{messages.tokenTickerLabel}</label>
				<TextInput
					id="mint-ticker"
					maxLength={props.limits.maxTickerLength}
					placeholder={messages.tokenTickerPlaceholder}
					value={props.ticker}
					onChange={(event) => props.onTickerChange(event.target.value)}
				/>
				<span>
					{formatMessage(messages.createFieldCounter, {
						length: props.ticker.length,
						max: props.limits.maxTickerLength,
					})}
				</span>
			</div>
			<div className="create-field">
				<label htmlFor="mint-supply">{messages.tokenSupplyLabel}</label>
				<TextInput
					id="mint-supply"
					inputMode="numeric"
					maxLength={props.limits.maxWholeSupply.toString().length}
					placeholder="1000000"
					value={props.wholeSupply}
					onChange={(event) => props.onWholeSupplyChange(event.target.value)}
				/>
				<span>
					{formatMessage(messages.tokenSupplyMax, { max: props.limits.maxWholeSupply.toLocaleString() })}
				</span>
			</div>
			<div className="create-field">
				<label htmlFor="mint-denomination">{messages.tokenDenominationLabel}</label>
				<TextInput
					id="mint-denomination"
					inputMode="numeric"
					min="0"
					max={props.limits.maxDenomination}
					step="1"
					type="number"
					value={props.denomination}
					onChange={(event) => props.onDenominationChange(event.target.value)}
				/>
			</div>
			<div className="create-field fungible-logo-field">
				<label htmlFor="mint-logo">
					{messages.tokenLogoLabel} <small>{messages.createOptional}</small>
				</label>
				<Button
					className={`fungible-logo-dropzone${props.logoPreview ? ' has-file' : ''}`}
					type="button"
					size="custom"
					onClick={() => logoInput.current?.click()}
					onDragOver={(event) => event.preventDefault()}
					onDrop={(event) => {
						event.preventDefault();
						handleLogoSelect(event.dataTransfer.files?.[0] ?? null);
					}}
				>
					{props.logoPreview && props.logo ? (
						<>
							<img
								src={props.logoPreview}
								alt={formatMessage(messages.tokenLogoPreviewAlt, {
									name: props.name.trim() || props.ticker.trim() || messages.tokenLogoFallbackName,
								})}
							/>
							<span>
								<strong>{props.logo.name}</strong>
								<small>
									{formatMessage(messages.tokenLogoMeta, { size: formatBytes(props.logo.size) })}
								</small>
							</span>
						</>
					) : (
						<span>
							<Upload aria-hidden="true" />
							<strong>{messages.tokenLogoChoose}</strong>
							<small>{messages.tokenLogoHint}</small>
						</span>
					)}
				</Button>
				<FileInput
					ref={logoInput}
					className="mint-file-input"
					id="mint-logo"
					accept="image/png,image/jpeg,image/webp,image/gif"
					onChange={(event) => handleLogoSelect(event.target.files?.[0] ?? null)}
				/>
				{props.logo ? (
					<div className="fungible-logo-meta">
						<span>
							{props.logoTxId ? (
								<>
									{messages.tokenLogoTransactionId} <code>{props.logoTxId}</code>
								</>
							) : (
								messages.tokenLogoTransactionPending
							)}
						</span>
						<Button type="button" size="custom" variant="danger" onClick={() => handleLogoSelect(null)}>
							<Icon icon={X} size="sm" /> {messages.mintRemove}
						</Button>
					</div>
				) : null}
			</div>
		</>
	);
}
