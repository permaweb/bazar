import React from 'react';
import { Upload, X } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { Icon } from 'components/atoms/Icon';
import { TextInput } from 'components/atoms/TextInput';
import { formatBytes } from 'helpers/format';

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
	const logoInput = React.useRef<HTMLInputElement>(null);

	const handleLogoSelect = (next: File | null) => {
		if (!props.onLogoSelect(next) && logoInput.current) logoInput.current.value = '';
	};

	return (
		<>
			<div className="create-field">
				<label htmlFor="mint-ticker">Ticker</label>
				<TextInput
					id="mint-ticker"
					maxLength={props.limits.maxTickerLength}
					placeholder="WEAVE"
					value={props.ticker}
					onChange={(event) => props.onTickerChange(event.target.value)}
				/>
				<span>
					{props.ticker.length} / {props.limits.maxTickerLength}
				</span>
			</div>
			<div className="create-field">
				<label htmlFor="mint-supply">Total supply</label>
				<TextInput
					id="mint-supply"
					inputMode="numeric"
					maxLength={props.limits.maxWholeSupply.toString().length}
					placeholder="1000000"
					value={props.wholeSupply}
					onChange={(event) => props.onWholeSupplyChange(event.target.value)}
				/>
				<span>Maximum {props.limits.maxWholeSupply.toLocaleString()} whole tokens</span>
			</div>
			<div className="create-field">
				<label htmlFor="mint-denomination">Decimal places</label>
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
					Token logo <small>Optional</small>
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
								alt={`${props.name.trim() || props.ticker.trim() || 'Token'} logo preview`}
							/>
							<span>
								<strong>{props.logo.name}</strong>
								<small>{formatBytes(props.logo.size)} · click or drop to replace</small>
							</span>
						</>
					) : (
						<span>
							<Upload aria-hidden="true" />
							<strong>Choose a token logo</strong>
							<small>PNG, JPG, WebP, or GIF · up to 10 MB</small>
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
									Transaction ID <code>{props.logoTxId}</code>
								</>
							) : (
								'The transaction ID will appear here after the logo upload.'
							)}
						</span>
						<Button type="button" size="custom" variant="danger" onClick={() => handleLogoSelect(null)}>
							<Icon icon={X} size="sm" /> Remove
						</Button>
					</div>
				) : null}
			</div>
		</>
	);
}
