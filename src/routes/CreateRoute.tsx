import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
	ArrowRight,
	ArrowUpRight,
	Check,
	InfinityIcon,
	Info,
	Upload,
	X,
} from 'lucide-react';
import type { Consensus, ObserverView } from 'weave-wrangler';

import { waitForAssetState } from 'api/asset-marketplace';
import {
	AssetMintClient,
	CollectionMintClient,
	type CollectionMintEstimate,
	type CollectionMintPhase,
	type CollectionMintResult,
	CREATED_COLLECTION_ID,
	discardMintDraft,
	type FungibleMintEstimate,
	type FungibleMintInput,
	type FungibleMintPhase,
	type FungibleMintResult,
	getMintDraft,
	isHighMintCost,
	MAX_FUNGIBLE_DENOMINATION,
	MAX_FUNGIBLE_TICKER_LENGTH,
	type MintDraft,
	type MintedAsset,
	type MintEstimate,
	type MintPhase,
	UDL_LICENSE_ID,
	type UdlPreset,
	type UdlTerms,
	udlTermsForPreset,
	validateFungibleLogo,
	validateFungibleMintInput,
} from 'api/asset-mint';
import { confirmTransactionId } from 'api/asset-transactions';
import { FUNGIBLE_TOKEN_COLLECTION_ID } from 'api/collections';

import { ArCurrencyLabel, ArCurrencyText } from 'components/ArCurrencyLabel';
import { AudioArtwork } from 'components/AudioArtwork';
import { Button } from 'components/Button';
import { Loading } from 'components/Loading';
import { MintTransactionReceipt, type MintTransactionReceiptEntry } from 'components/MintTransactionReceipt';
import { OperationOutcome, OperationOutcomeAnnouncement } from 'components/OperationOutcomeAnnouncement';
import { SegmentedTabs } from 'components/SegmentedTabs';
import { TokenArtwork } from 'components/TokenArtwork';
import {
	prepareTransactionDialogHide,
	TRANSACTION_DIALOG_HIDE_DURATION_MS,
	TransactionDialogControl,
	type TransactionDialogPhase,
} from 'components/TransactionDialogControl';
import { isAudioContentType, normalizeAssetContentType } from 'helpers/asset-media';
import { type EmbeddedAudioMetadata, extractEmbeddedAudioMetadata, formatAudioDuration } from 'helpers/audio-metadata';
import { arweaveGatewayFromLocation } from 'helpers/config';
import { useWallet } from 'providers/WalletProvider';

import udlLogo from '../assets/udl.svg';

import {
	formatBytes,
	MarketContext,
	MarketSelect,
	mintErrorMessage,
	useOperationActivity,
	winstonToAr,
} from '../app/App';
import { useDialogFocus } from '../app/useDialogFocus';

const ArweaveTransactionSync = React.lazy(async () => {
	const module = await import('components/ArweaveTransactionSync');
	return { default: module.ArweaveTransactionSync };
});

type UdlGrantValue = NonNullable<UdlTerms['derivation'] | UdlTerms['commercialUse'] | UdlTerms['dataModelTraining']>;

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
		<svg
			aria-hidden="true"
			className="ui-icon ui-icon--sm udl-payment-icon"
			fill="none"
			viewBox="0 0 24 24"
		>
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
		<svg
			aria-hidden="true"
			className="ui-icon ui-icon--sm udl-credit-icon"
			fill="none"
			viewBox="0 0 24 24"
		>
			<g className="udl-credit-icon__badge" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5">
				<polygon points="12,3.5 13.88,5 16.25,4.64 17.13,6.87 19.36,7.75 19,10.12 20.5,12 19,13.88 19.36,16.25 17.13,17.13 16.25,19.36 13.88,19 12,20.5 10.12,19 7.75,19.36 6.87,17.13 4.64,16.25 5,13.88 3.5,12 5,10.12 4.64,7.75 6.87,6.87 7.75,4.64 10.12,5" />
			</g>
			<path className="udl-credit-icon__check" d="m8.5 11.7 2.2 2.2 4.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
			<g className="udl-credit-icon__particles" fill="currentColor">
				<circle className="udl-credit-icon__particle" cx="5" cy="5" r="1" />
				<circle className="udl-credit-icon__particle" cx="19" cy="5.5" r="0.9" />
				<circle className="udl-credit-icon__particle" cx="4" cy="18" r="0.8" />
				<circle className="udl-credit-icon__particle" cx="20" cy="18" r="1" />
			</g>
		</svg>
	);
}

type FungibleMintDialogProps = {
	error: string | null;
	logoPreview: string;
	name: string;
	onClearError: () => void;
	onNavigate: (path: string) => void;
	onVisibleChange: (visible: boolean) => void;
	phase: FungibleMintPhase | null;
	phaseLabel: string;
	progressButton: React.RefObject<HTMLButtonElement>;
	ready: boolean;
	result: FungibleMintResult | null;
	ticker: string;
	visible: boolean;
	views: ObserverView[];
	consensus: Consensus | null;
	confirmations: number;
};

export function FungibleMintDialog({
	error,
	logoPreview,
	name,
	onClearError,
	onNavigate,
	onVisibleChange,
	phase,
	phaseLabel,
	progressButton,
	ready,
	result,
	ticker,
	visible,
	views,
	consensus,
	confirmations,
}: FungibleMintDialogProps) {
	const [hiding, setHiding] = React.useState(false);
	const hideTimerRef = React.useRef<number | null>(null);
	const dialogPhase: TransactionDialogPhase = error ? 'error' : ready ? 'done' : 'working';
	const closeOrHide = React.useCallback(() => {
		if (dialogPhase !== 'working') {
			onVisibleChange(false);
			return;
		}
		if (hiding) return;
		if (dialogRef.current) prepareTransactionDialogHide(dialogRef.current, progressButton.current);
		setHiding(true);
		hideTimerRef.current = window.setTimeout(() => {
			hideTimerRef.current = null;
			onVisibleChange(false);
		}, TRANSACTION_DIALOG_HIDE_DURATION_MS);
	}, [dialogPhase, hiding, onVisibleChange, progressButton]);
	const dialogRef = useDialogFocus<HTMLDivElement>(visible, closeOrHide, () => progressButton.current, dialogPhase);

	React.useEffect(() => {
		if (visible) setHiding(false);
	}, [visible]);
	React.useEffect(
		() => () => {
			if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
		},
		[]
	);

	if (!visible && dialogPhase !== 'working') return null;
	const tokenName = result?.name || name.trim() || 'Fungible token';
	const tokenTicker = result?.ticker || ticker.trim() || 'TKN';
	const receiptEntries: MintTransactionReceiptEntry[] = result
		? [
				...(result.logo ? [{ label: 'Token logo transaction', transactionId: result.logo }] : []),
				{ label: 'Token process transaction', transactionId: result.processId },
		  ]
		: [];

	return (
		<div
			className={`dialog-backdrop operation-panel-backdrop${hiding ? ' dialog-backdrop-hiding' : ''}`}
			hidden={!visible}
			onMouseDown={(event) => event.target === event.currentTarget && closeOrHide()}
			role="presentation"
		>
			<div
				aria-hidden={visible ? undefined : true}
				aria-labelledby={visible ? 'fungible-mint-operation fungible-mint-title' : undefined}
				aria-modal={visible ? true : undefined}
				className="dialog operation-side-panel fungible-dialog fungible-mint-dialog"
				ref={dialogRef}
				role={visible ? 'dialog' : undefined}
				tabIndex={-1}
			>
				<div className="dialog-heading">
					<div className="dialog-asset-heading">
						{logoPreview ? (
							<img alt="" className="dialog-asset-artwork" src={logoPreview} />
						) : (
							<TokenArtwork className="dialog-asset-artwork" ticker={tokenTicker} />
						)}
						<div className="dialog-asset-heading-copy">
							<p className="eyebrow" id="fungible-mint-operation">
								Create token
							</p>
							<h2 id="fungible-mint-title">{tokenName}</h2>
						</div>
					</div>
					<TransactionDialogControl hiding={hiding} phase={dialogPhase} onClick={closeOrHide} />
				</div>
				<OperationOutcomeAnnouncement
					active={dialogPhase === 'done'}
					detail={`All ${result?.wholeSupply ?? ''} ${
						result?.ticker ?? ''
					} are in your wallet and ready to dispatch.`}
					title="Token live on Bazar"
				/>
				{dialogPhase === 'working' && !result ? (
					<div className="operation-preparing">
						<Loading label={phaseLabel || 'Preparing token transactions…'} />
						<p>
							{phase
								? 'Keep this wallet request open while Bazar prepares and submits the permanent token transactions.'
								: 'Checking the connected wallet, network cost, and token details before requesting approval.'}
						</p>
					</div>
				) : null}
				{dialogPhase === 'working' && result ? (
					<div className="operation-working">
						<p className="sr-only" aria-live="polite" role="status">
							Token submitted. Watching independently addressed Arweave nodes and waiting for the token
							process state.
						</p>
						<p className="scheduler-wait">
							All {result.wholeSupply} {result.ticker} are minted to your wallet. Bazar is waiting for the
							scheduler to make the process readable.
						</p>
						<React.Suspense fallback={<Loading label="Loading transaction progress…" />}>
							<ArweaveTransactionSync
								active={visible}
								activeStep="mint"
								pendingAfterConfirmation="Waiting for token process state"
								steps={[
									{
										key: 'mint',
										label: 'Mint token',
										target: 5,
										confirmations,
										transaction: {
											id: result.processId,
											views,
											...(consensus ? { consensus } : {}),
										},
									},
								]}
								subject={tokenTicker}
							/>
						</React.Suspense>
						<MintTransactionReceipt entries={receiptEntries} />
					</div>
				) : null}
				{dialogPhase === 'done' && result ? (
					<div className="result success">
						<OperationOutcome
							detail={`All ${result.wholeSupply} ${result.ticker} are in your wallet and ready to dispatch.`}
							title="Token live on Bazar"
						/>
						<MintTransactionReceipt entries={receiptEntries} />
						<Button
							className="with-icon"
							data-dialog-initial
							onClick={() => onNavigate(`/asset/${FUNGIBLE_TOKEN_COLLECTION_ID}/${result.processId}`)}
							size="custom"
							variant="primary"
						>
							View token <ArrowRight className="ui-icon ui-icon--sm" aria-hidden="true" />
						</Button>
						<Button
							className="with-icon"
							onClick={() => onNavigate(`/dispatch/${result.processId}`)}
							size="custom"
						>
							Dispatch to holders <ArrowRight className="ui-icon ui-icon--sm" aria-hidden="true" />
						</Button>
					</div>
				) : null}
				{dialogPhase === 'error' ? (
					<div className="result error">
						<div className="result-alert" role="alert">
							<h3>Could not create this token</h3>
							<p>{error}</p>
						</div>
						<Button
							data-dialog-initial
							onClick={() => {
								onClearError();
								onVisibleChange(false);
							}}
							size="custom"
						>
							Return to token details
						</Button>
					</div>
				) : null}
			</div>
		</div>
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

function udlTermsMatchPreset(terms: UdlTerms, preset: UdlPreset): boolean {
	const expected = udlTermsForPreset(preset);
	const grantKeys = ['derivation', 'commercialUse', 'dataModelTraining'] as const;
	const baseTermsMatch =
		terms.accessFee === expected.accessFee &&
		terms.unknownUsageRights === expected.unknownUsageRights &&
		terms.expiry === expected.expiry;
	const grantsMatch = grantKeys.every((key) => terms[key]?.grant === expected[key]?.grant);
	if (preset === 'share-with-payment') {
		const feeValues = grantKeys.map((key) => terms[key]?.value ?? '');
		return baseTermsMatch && grantsMatch && feeValues.every((value) => value === feeValues[0]);
	}
	return (
		baseTermsMatch &&
		grantsMatch &&
		grantKeys.every(
			(key) => terms[key]?.value === expected[key]?.value
		)
	);
}

function UdlGrantField({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value?: UdlGrantValue;
	options: Array<[string, string]>;
	onChange: (value: UdlGrantValue | undefined) => void;
}) {
	const needsValue = value && ['revenue-share', 'one-time', 'monthly'].includes(value.grant);
	return (
		<div className={needsValue ? 'udl-field udl-grant-field has-value' : 'udl-field udl-grant-field'}>
			<label>{label}</label>
			<div className={needsValue ? 'udl-field-control with-value' : 'udl-field-control'}>
				<MarketSelect
					label={label}
					showLabel={false}
					value={value?.grant ?? ''}
					options={[
						{ value: '', label: 'Not granted' },
						...options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel })),
					]}
					onChange={(grant) => {
						if (!grant) return onChange(undefined);
						onChange({
							grant: grant as UdlGrantValue['grant'],
							...(['one-time', 'monthly'].includes(grant)
								? { value: '1' }
								: grant === 'revenue-share'
								? { value: '10' }
								: {}),
						});
					}}
				/>
				{needsValue ? (
					<label className="udl-value">
						<span className="udl-value-label">
							{value.grant === 'revenue-share' ? 'Percent' : 'Amount'}
						</span>
						<input
							aria-label={`${label} ${value.grant === 'revenue-share' ? 'percentage' : 'fee amount'}`}
							className={value.grant === 'revenue-share' ? undefined : 'has-currency-suffix'}
							inputMode="decimal"
							min="0.000000000001"
							max={value.grant === 'revenue-share' ? '100' : undefined}
							step="any"
							type="number"
							value={value.value ?? '1'}
							onChange={(event) => onChange({ ...value, value: event.target.value || '1' })}
						/>
						{value.grant !== 'revenue-share' ? (
							<span className="udl-value-suffix">
								<ArCurrencyLabel />
							</span>
						) : null}
					</label>
				) : null}
			</div>
		</div>
	);
}

function mintPhaseStatus(phase: MintPhase) {
	return {
		'signing-asset': 'Waiting for approval of the atomic asset in your wallet…',
		'uploading-asset': 'Uploading the atomic asset to Arweave…',
		'signing-artwork': 'Waiting for approval of the album artwork in your wallet…',
		'uploading-artwork': 'Uploading album artwork to Arweave…',
	}[phase];
}

function collectionMintPhaseLabel(phase: CollectionMintPhase) {
	if (phase.kind === 'asset') {
		return `Asset ${phase.index + 1} of ${phase.total}: ${mintPhaseStatus(phase.phase)}`;
	}
	return `${phase.kind === 'manifest' ? 'Collection manifest' : 'Collection process'}: ${phase.phase}…`;
}

export default function CreateRoute() {
	const market = React.useContext(MarketContext);
	const wallet = useWallet();
	const navigate = useNavigate();
	const { beginUpload, failUpload, finishUpload, recordUploadTransaction, updateUpload } = useOperationActivity();
	const fileInput = React.useRef<HTMLInputElement>(null);
	const artworkInput = React.useRef<HTMLInputElement>(null);
	const logoInput = React.useRef<HTMLInputElement>(null);
	const fungibleProgressButton = React.useRef<HTMLButtonElement>(null);
	const metadataRequest = React.useRef(0);
	const artworkRevision = React.useRef(0);
	const [mode, setMode] = React.useState<'asset' | 'collection' | 'fungible'>('asset');
	const [name, setName] = React.useState('');
	const [description, setDescription] = React.useState('');
	const [ticker, setTicker] = React.useState('');
	const [wholeSupply, setWholeSupply] = React.useState('');
	const [denomination, setDenomination] = React.useState('12');
	const [logo, setLogo] = React.useState<File | null>(null);
	const [logoTxId, setLogoTxId] = React.useState('');
	const [logoPreview, setLogoPreview] = React.useState('');
	const [fungibleEstimate, setFungibleEstimate] = React.useState<FungibleMintEstimate | null>(null);
	const [fungiblePhase, setFungiblePhase] = React.useState<FungibleMintPhase | null>(null);
	const [fungibleResult, setFungibleResult] = React.useState<FungibleMintResult | null>(null);
	const [fungibleResultReady, setFungibleResultReady] = React.useState(false);
	const [fungibleSubmitting, setFungibleSubmitting] = React.useState(false);
	const [fungibleDialogVisible, setFungibleDialogVisible] = React.useState(false);
	const [fungibleOperationError, setFungibleOperationError] = React.useState<string | null>(null);
	const [mintViews, setMintViews] = React.useState<ObserverView[]>([]);
	const [mintConsensus, setMintConsensus] = React.useState<Consensus | null>(null);
	const [mintConfirmations, setMintConfirmations] = React.useState(0);
	const [file, setFile] = React.useState<File | null>(null);
	const [artwork, setArtwork] = React.useState<File | null>(null);
	const [audioMetadata, setAudioMetadata] = React.useState<EmbeddedAudioMetadata>({});
	const [readingAudioMetadata, setReadingAudioMetadata] = React.useState(false);
	const [collectionFiles, setCollectionFiles] = React.useState<File[]>([]);
	const [preview, setPreview] = React.useState('');
	const [artworkPreview, setArtworkPreview] = React.useState('');
	const [collectionPreviews, setCollectionPreviews] = React.useState<string[]>([]);
	const [estimate, setEstimate] = React.useState<MintEstimate | null>(null);
	const [collectionEstimate, setCollectionEstimate] = React.useState<CollectionMintEstimate | null>(null);
	const [estimating, setEstimating] = React.useState(false);
	const [udlEnabled, setUdlEnabled] = React.useState(true);
	const [udlTerms, setUdlTerms] = React.useState<UdlTerms>(() => udlTermsForPreset('share-with-credit'));
	const udlPreset = UDL_PRESET_OPTIONS.find(({ value }) => udlTermsMatchPreset(udlTerms, value))?.value ?? null;
	const [phase, setPhase] = React.useState<MintPhase | null>(null);
	const [collectionPhase, setCollectionPhase] = React.useState<CollectionMintPhase | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [result, setResult] = React.useState<MintedAsset | null>(null);
	const [resultReady, setResultReady] = React.useState(false);
	const [collectionResult, setCollectionResult] = React.useState<CollectionMintResult | null>(null);
	const [draft, setDraft] = React.useState<MintDraft | null>(() =>
		wallet.address ? getMintDraft(wallet.address) : null
	);
	const applyUdlPreset = (preset: UdlPreset) => {
		setUdlTerms(udlTermsForPreset(preset));
		setError(null);
	};
	const customizeUdlTerms = (next: React.SetStateAction<UdlTerms>) => {
		setUdlTerms(next);
	};
	const setShareWithPaymentAmount = (value: string) => {
		setUdlTerms((current) => ({
			...current,
			derivation: { grant: 'one-time', value },
			commercialUse: { grant: 'one-time', value },
			dataModelTraining: { grant: 'one-time', value },
		}));
	};
	const activeUdl = udlEnabled ? udlTerms : undefined;
	const selectedContentType = file ? normalizeAssetContentType(file.type, file.name) : null;
	const audioSelected = isAudioContentType(selectedContentType ?? undefined);
	const fungibleInput: FungibleMintInput = {
		name,
		description,
		ticker,
		wholeSupply,
		denomination,
		...(logoTxId.trim() ? { logo: logoTxId.trim() } : {}),
	};
	const fungibleReady =
		mode === 'fungible' &&
		(() => {
			try {
				validateFungibleMintInput(fungibleInput);
				if (logo) validateFungibleLogo(logo);
				return true;
			} catch {
				return false;
			}
		})();

	React.useEffect(() => {
		setDraft(wallet.address ? getMintDraft(wallet.address) : null);
	}, [wallet.address]);
	React.useEffect(() => {
		if (!logo) {
			setLogoPreview('');
			return;
		}
		const url = URL.createObjectURL(logo);
		setLogoPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [logo]);
	React.useEffect(() => {
		if (!file) {
			setPreview('');
			return;
		}
		const url = URL.createObjectURL(file);
		setPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);
	React.useEffect(() => {
		if (!artwork) {
			setArtworkPreview('');
			return;
		}
		const url = URL.createObjectURL(artwork);
		setArtworkPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [artwork]);
	React.useEffect(() => {
		const urls = collectionFiles.map((item) => URL.createObjectURL(item));
		setCollectionPreviews(urls);
		return () => urls.forEach((url) => URL.revokeObjectURL(url));
	}, [collectionFiles]);
	React.useEffect(() => {
		setResultReady(false);
		if (!result) return;
		const controller = new AbortController();
		void waitForAssetState(result.id, () => true, {
			signal: controller.signal,
			interval: 4000,
			timeout: 0,
		}).then(
			() => {
				if (!controller.signal.aborted) setResultReady(true);
			},
			() => undefined
		);
		return () => controller.abort();
	}, [result]);
	React.useEffect(() => {
		if (!result) return;
		const markLive = (event: Event) => {
			if ((event as CustomEvent<{ asset?: { id?: string } }>).detail?.asset?.id === result.id) {
				setResultReady(true);
			}
		};
		window.addEventListener('bazar:mint-live', markLive);
		return () => window.removeEventListener('bazar:mint-live', markLive);
	}, [result]);
	React.useEffect(() => {
		setFungibleResultReady(false);
		if (!fungibleResult) return;
		const controller = new AbortController();
		void waitForAssetState(fungibleResult.processId, () => true, {
			signal: controller.signal,
			interval: 4000,
			timeout: 0,
		}).then(
			() => {
				if (!controller.signal.aborted) setFungibleResultReady(true);
			},
			() => undefined
		);
		return () => controller.abort();
	}, [fungibleResult]);
	React.useEffect(() => {
		setMintViews([]);
		setMintConsensus(null);
		setMintConfirmations(0);
		if (!fungibleResult) return;
		const controller = new AbortController();
		void confirmTransactionId(fungibleResult.processId, {
			signal: controller.signal,
			target: 5,
			onViews: setMintViews,
			onConsensus: setMintConsensus,
			onProgress: (progress) => setMintConfirmations(progress.confirmations),
		})
			.then(() => {
				if (!controller.signal.aborted) setMintConfirmations(5);
			})
			.catch(() => undefined);
		return () => controller.abort();
	}, [fungibleResult]);
	React.useEffect(() => {
		if (mode !== 'asset' || !file || !name.trim()) {
			setEstimate(null);
			return;
		}
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			setEstimating(true);
			setError(null);
			void new AssetMintClient()
				.estimate(
					{
						file,
						artwork: artwork ?? undefined,
						name,
						description,
						artist: audioMetadata.artist,
						album: audioMetadata.album,
						duration: audioMetadata.duration,
						udl: activeUdl,
					},
					controller.signal
				)
				.then(
					(nextEstimate) => {
						if (!controller.signal.aborted) setEstimate(nextEstimate);
					},
					(cause) => {
						if (!controller.signal.aborted) setError(mintErrorMessage(cause));
					}
				)
				.finally(() => {
					if (!controller.signal.aborted) setEstimating(false);
				});
		}, 250);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [activeUdl, artwork, audioMetadata, description, file, mode, name]);
	React.useEffect(() => {
		if (mode !== 'collection' || !collectionFiles.length || !name.trim()) {
			setCollectionEstimate(null);
			return;
		}
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			setEstimating(true);
			setError(null);
			void new CollectionMintClient()
				.estimate({ files: collectionFiles, name, description, udl: activeUdl }, controller.signal)
				.then(
					(nextEstimate) => {
						if (!controller.signal.aborted) setCollectionEstimate(nextEstimate);
					},
					(cause) => {
						if (!controller.signal.aborted) setError(mintErrorMessage(cause));
					}
				)
				.finally(() => {
					if (!controller.signal.aborted) setEstimating(false);
				});
		}, 250);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [activeUdl, collectionFiles, description, mode, name]);
	React.useEffect(() => {
		if (mode !== 'fungible' || !fungibleReady) {
			setFungibleEstimate(null);
			return;
		}
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			setEstimating(true);
			setError(null);
			void new AssetMintClient()
				.estimateFungible(fungibleInput, logo ?? undefined, controller.signal)
				.then(
					(nextEstimate) => {
						if (!controller.signal.aborted) setFungibleEstimate(nextEstimate);
					},
					(cause) => {
						if (!controller.signal.aborted) setError(mintErrorMessage(cause));
					}
				)
				.finally(() => {
					if (!controller.signal.aborted) setEstimating(false);
				});
		}, 250);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode, fungibleReady, name, description, ticker, wholeSupply, denomination, logo, logoTxId]);

	const selectFile = (next: File | null) => {
		const request = ++metadataRequest.current;
		const artworkVersion = ++artworkRevision.current;
		setFile(next);
		setArtwork(null);
		setAudioMetadata({});
		setReadingAudioMetadata(false);
		setEstimate(null);
		setError(null);
		setResult(null);
		if (next) {
			const fallbackName = next.name.replace(/\.[^.]+$/, '').slice(0, 80);
			if (!name.trim()) setName(fallbackName);
			if (isAudioContentType(normalizeAssetContentType(next.type, next.name) ?? undefined)) {
				setReadingAudioMetadata(true);
				void extractEmbeddedAudioMetadata(next).then(
					(metadata) => {
						if (metadataRequest.current !== request) return;
						const safeMetadata = {
							...metadata,
							...(metadata.artist ? { artist: metadata.artist.slice(0, 160) } : {}),
							...(metadata.album ? { album: metadata.album.slice(0, 160) } : {}),
							...(metadata.artwork && metadata.artwork.size <= 10 * 1024 * 1024
								? { artwork: metadata.artwork }
								: { artwork: undefined }),
						};
						setAudioMetadata(safeMetadata);
						setName((current) =>
							metadata.title && (!current.trim() || current === fallbackName)
								? metadata.title.slice(0, 80)
								: current
						);
						if (safeMetadata.artwork && artworkRevision.current === artworkVersion)
							setArtwork(safeMetadata.artwork);
						setReadingAudioMetadata(false);
					},
					() => {
						if (metadataRequest.current === request) setReadingAudioMetadata(false);
					}
				);
			}
		}
	};
	const selectCollectionFiles = (next: File[]) => {
		setCollectionFiles(next.slice(0, 10));
		setCollectionEstimate(null);
		setError(next.length > 10 ? 'Collections support up to 10 images at a time.' : null);
		setCollectionResult(null);
	};
	const selectLogo = (next: File | null) => {
		if (next) {
			try {
				validateFungibleLogo(next);
			} catch (cause) {
				setLogo(null);
				setLogoTxId('');
				setFungibleEstimate(null);
				setError(mintErrorMessage(cause));
				if (logoInput.current) logoInput.current.value = '';
				return;
			}
		}
		setLogo(next);
		setLogoTxId('');
		setFungibleEstimate(null);
		setError(null);
	};
	const completeMint = (asset: MintedAsset, uploadId: string) => {
		market.addCreatedAsset(asset);
		setResult(asset);
		setDraft(null);
		setPhase(null);
		finishUpload(uploadId, {
			assetId: asset.id,
			collectionId: CREATED_COLLECTION_ID,
			transactionIds: [asset.artworkId, asset.id].filter((id): id is string => Boolean(id)),
		});
	};
	const mint = async () => {
		if (!wallet.address) {
			wallet.openConnectDialog();
			return;
		}
		if (mode === 'asset' && !file) return setError('Choose an image, MP3, or WAV file to continue.');
		if (mode === 'collection' && !collectionFiles.length) return setError('Choose at least one collection image.');
		if (mode === 'fungible' && !fungibleReady) {
			return setError('Complete the token name, ticker, total supply, and decimal places to continue.');
		}
		setError(null);
		setResult(null);
		setCollectionResult(null);
		const uploadId = `upload:${wallet.address}:${Date.now()}`;
		if (mode !== 'fungible') {
			beginUpload({
				id: uploadId,
				owner: wallet.address,
				kind: mode,
				name: name.trim(),
				status: 'Preparing secure wallet approvals…',
			});
		}
		setFungibleResult(null);
		try {
			if (mode === 'fungible') {
				setFungibleSubmitting(true);
				setFungibleOperationError(null);
				setFungibleDialogVisible(true);
				const minted = await new AssetMintClient().mintFungible(fungibleInput, wallet.address, {
					logo: logo ?? undefined,
					onLogoUploaded: setLogoTxId,
					onPhase: setFungiblePhase,
				});
				setFungibleResult(minted);
				setFungiblePhase(null);
				setFungibleSubmitting(false);
				return;
			}
			if (mode === 'collection') {
				const minted = await new CollectionMintClient().mint(
					{ files: collectionFiles, name, description, udl: activeUdl },
					wallet.address,
					{
						allowHighCost: true,
						onTransaction: (transaction) => recordUploadTransaction(uploadId, transaction),
						onPhase: (nextPhase) => {
							setCollectionPhase(nextPhase);
							updateUpload(uploadId, collectionMintPhaseLabel(nextPhase));
						},
					}
				);
				market.addCollection(minted.collection);
				setCollectionResult(minted);
				setCollectionPhase(null);
				finishUpload(uploadId, {
					collectionId: minted.collection.id,
					assetIds: minted.collection.assets.map((asset) => asset.id),
					transactionIds: [minted.manifestId, minted.processId],
				});
				return;
			}
			if (!file) return;
			const minted = await new AssetMintClient().mint(
				{
					file,
					artwork: artwork ?? undefined,
					name,
					description,
					artist: audioMetadata.artist,
					album: audioMetadata.album,
					duration: audioMetadata.duration,
					udl: activeUdl,
				},
				wallet.address,
				{
					allowHighCost: true,
					onTransaction: (transaction) => recordUploadTransaction(uploadId, transaction),
					onPhase: (nextPhase) => {
						setPhase(nextPhase);
						updateUpload(uploadId, mintPhaseStatus(nextPhase));
					},
				}
			);
			completeMint(minted.asset, uploadId);
		} catch (cause) {
			const message = mintErrorMessage(cause);
			setDraft(getMintDraft(wallet.address));
			setPhase(null);
			setCollectionPhase(null);
			setFungiblePhase(null);
			setFungibleSubmitting(false);
			if (mode === 'fungible') setFungibleOperationError(message);
			else {
				setError(message);
				failUpload(uploadId, message);
			}
		}
	};
	const resume = async () => {
		if (!wallet.address || !draft) return;
		setError(null);
		const uploadId = `upload:${wallet.address}:${Date.now()}`;
		beginUpload({
			id: uploadId,
			owner: wallet.address,
			kind: 'asset',
			name: draft.name,
			status: 'Recovering the saved asset upload…',
		});
		try {
			const minted = await new AssetMintClient().resume(draft, wallet.address, {
				onTransaction: (transaction) => recordUploadTransaction(uploadId, transaction),
				onPhase: (nextPhase) => {
					setPhase(nextPhase);
					updateUpload(uploadId, mintPhaseStatus(nextPhase));
				},
			});
			completeMint(minted.asset, uploadId);
		} catch (cause) {
			const message = mintErrorMessage(cause);
			setPhase(null);
			setError(message);
			failUpload(uploadId, message);
		}
	};
	const working = phase !== null || collectionPhase !== null || fungibleSubmitting;
	const phaseLabel = fungiblePhase
		? {
				'signing-logo': 'Approve the token logo in your wallet…',
				'uploading-logo': 'Uploading the token logo to Arweave…',
				signing: 'Approve the token process in your wallet…',
				uploading: 'Submitting the token process to Arweave…',
		  }[fungiblePhase]
		: collectionPhase
		? collectionPhase.kind === 'asset'
			? `Asset ${collectionPhase.index + 1} of ${collectionPhase.total}: ${
					{
						'signing-asset': 'approve atomic asset',
						'uploading-asset': 'uploading atomic asset',
						'signing-artwork': 'approve artwork upload',
						'uploading-artwork': 'uploading artwork',
					}[collectionPhase.phase]
			  }…`
			: `${collectionPhase.kind === 'manifest' ? 'Collection manifest' : 'Collection process'}: ${
					collectionPhase.phase
			  }…`
		: phase
		? {
				'signing-asset': 'Approve the atomic asset in your wallet…',
				'uploading-asset': 'Uploading the atomic asset to Arweave…',
				'signing-artwork': 'Approve the album artwork in your wallet…',
				'uploading-artwork': 'Uploading album artwork to Arweave…',
		  }[phase]
		: '';
	const activeEstimate = mode === 'asset' ? estimate : collectionEstimate;
	const activeUploadBytes = mode === 'asset' && estimate ? estimate.assetBytes + estimate.artworkBytes : null;
	const receiptEntries: MintTransactionReceiptEntry[] = collectionResult
		? [
				{ label: 'View collection manifest', transactionId: collectionResult.manifestId },
				{ label: 'View collection process', transactionId: collectionResult.processId },
		  ]
		: result
		? [
				...(result.artworkId ? [{ label: 'Artwork transaction', transactionId: result.artworkId }] : []),
				{ label: 'Asset transaction', transactionId: result.id },
		  ]
		: [];

	return (
		<section className="create-page">
			<div className="create-heading">
				<div>
					<p className="eyebrow">Create on Arweave</p>
					<h1>Upload and mint</h1>
				</div>
				<p>
					{mode === 'asset'
						? 'Your media, metadata, and one-of-one marketplace process are stored together under one Arweave transaction ID.'
						: mode === 'collection'
						? 'Mint a group of atomic one-of-one assets and submit a carrier whose value is their permanent manifest.'
						: 'Publish one atomic fungible-token process. The whole supply is minted to your connected wallet; dispatch it to holders afterwards.'}
				</p>
			</div>

			<SegmentedTabs
				active={mode}
				ariaLabel="Create type"
				className="create-mode"
				idPrefix="create-mode"
				onChange={(nextMode) => {
					setMode(nextMode);
					setError(null);
				}}
				tabs={[
					{ value: 'asset', label: 'Single asset' },
					{ value: 'collection', label: 'Collection' },
					{ value: 'fungible', label: 'Fungible token' },
				]}
			/>

			{mode === 'asset' && draft ? (
				<div className="mint-recovery" role="status">
					<div>
						<strong>Finish your previous mint</strong>
						<span>
							The earlier media upload for “{draft.name}” was accepted. Bazar can reuse its bytes to
							finish a self-contained atomic asset.
						</span>
					</div>
					<div>
						<Button type="button" onClick={() => void resume()} disabled={working} size="custom">
							Finish mint
						</Button>
						<Button
							type="button"
							onClick={() => {
								discardMintDraft(draft.owner);
								setDraft(null);
							}}
							disabled={working}
							size="custom"
						>
							Dismiss
						</Button>
					</div>
				</div>
			) : null}

			<div className="create-layout">
				<div className="create-preview-column">
					{mode === 'fungible' ? (
						<div className="fungible-token-preview">
							<div className="fungible-token-preview-mark" aria-hidden="true">
								{logoPreview ? (
									<img src={logoPreview} alt="" />
								) : (
									<TokenArtwork ticker={ticker.trim() || 'TKN'} />
								)}
							</div>
							<span>
								<strong>{name.trim() || 'Unnamed token'}</strong>
								<small className="fungible-token-preview-ticker">
									{ticker.trim() || 'Set a ticker'}
								</small>
								<small>
									{wholeSupply && /^[1-9]\d*$/.test(wholeSupply)
										? `${wholeSupply} ${ticker.trim() || 'tokens'} total · ${
												denomination || '0'
										  } decimal places`
										: 'Set the whole-token supply'}
								</small>
							</span>
						</div>
					) : (
						<Button
							className={`mint-dropzone${mode === 'asset' && preview ? ' has-file' : ''}${
								mode === 'collection' && collectionPreviews.length ? ' has-file collection-files' : ''
							}`}
							type="button"
							size="custom"
							onClick={() => fileInput.current?.click()}
							onDragOver={(event) => event.preventDefault()}
							onDrop={(event) => {
								event.preventDefault();
								if (mode === 'collection')
									selectCollectionFiles(Array.from(event.dataTransfer.files ?? []));
								else selectFile(event.dataTransfer.files?.[0] ?? null);
							}}
						>
							{mode === 'collection' && collectionPreviews.length ? (
								<span className="collection-preview-grid">
									{collectionPreviews.slice(0, 6).map((url, index) => (
										<span key={`${collectionFiles[index]?.name}-${index}`}>
											<img src={url} alt="" />
											<small>{index + 1}</small>
										</span>
									))}
									{collectionPreviews.length > 6 ? (
										<strong>+{collectionPreviews.length - 6}</strong>
									) : null}
								</span>
							) : mode === 'asset' && preview ? (
								audioSelected ? (
									artworkPreview ? (
										<img
											src={artworkPreview}
											alt={`${name || file?.name || 'Audio'} album artwork`}
										/>
									) : (
										<AudioArtwork
											contentType={selectedContentType ?? undefined}
											name={file?.name ?? name}
										/>
									)
								) : (
									<img src={preview} alt="Asset preview" />
								)
							) : (
								<span>
									<Upload aria-hidden="true" />
									<strong>{mode === 'asset' ? 'Choose media' : 'Choose collection images'}</strong>
									<small>
										{mode === 'asset'
											? 'Images up to 10 MB · MP3 or WAV up to 100 MB'
											: 'PNG, JPG, WebP, or GIF · up to 10 MB each · 10 images maximum'}
									</small>
								</span>
							)}
						</Button>
					)}
					<input
						ref={fileInput}
						className="mint-file-input"
						type="file"
						multiple={mode === 'collection'}
						accept={
							mode === 'collection'
								? 'image/png,image/jpeg,image/webp,image/gif'
								: 'image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/wav,.mp3,.wav'
						}
						onChange={(event) => {
							if (mode === 'collection') selectCollectionFiles(Array.from(event.target.files ?? []));
							else selectFile(event.target.files?.[0] ?? null);
						}}
					/>
					{mode === 'asset' && file ? (
						<div className="mint-file-meta">
							<span>{file.name}</span>
							<strong>{formatBytes(file.size)}</strong>
						</div>
					) : null}
					{mode === 'asset' && audioSelected ? (
						<div className="mint-audio-metadata" aria-live="polite">
							<strong>{readingAudioMetadata ? 'Reading embedded metadata…' : 'Audio metadata'}</strong>
							{!readingAudioMetadata ? (
								<dl>
									<div>
										<dt>Title</dt>
										<dd>{audioMetadata.title || 'Not embedded'}</dd>
									</div>
									<div>
										<dt>Artist</dt>
										<dd>{audioMetadata.artist || 'Not embedded'}</dd>
									</div>
									<div>
										<dt>Album</dt>
										<dd>{audioMetadata.album || 'Not embedded'}</dd>
									</div>
									<div>
										<dt>Duration</dt>
										<dd>{formatAudioDuration(audioMetadata.duration) || 'Unavailable'}</dd>
									</div>
								</dl>
							) : null}
						</div>
					) : null}
					{mode === 'asset' && audioSelected ? (
						<div className="mint-artwork-field">
							<div>
								<span>
									<strong>Album artwork</strong>
									<small>
										{audioMetadata.artwork && artwork === audioMetadata.artwork
											? 'Embedded artwork found · replace it if needed'
											: 'Optional · PNG, JPG, WebP, or GIF · up to 10 MB'}
									</small>
								</span>
								{artworkPreview ? <img src={artworkPreview} alt="Album artwork preview" /> : null}
							</div>
							<div>
								<Button type="button" onClick={() => artworkInput.current?.click()} size="custom">
									<Upload className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
									{artwork ? 'Replace artwork' : 'Add artwork'}
								</Button>
								{artwork ? (
									<Button
										type="button"
										size="custom"
										variant="danger"
										onClick={() => {
											artworkRevision.current += 1;
											setArtwork(null);
											if (artworkInput.current) artworkInput.current.value = '';
										}}
									>
										<X className="ui-icon ui-icon--sm" aria-hidden="true" /> Remove
									</Button>
								) : null}
							</div>
							<input
								ref={artworkInput}
								className="mint-file-input"
								type="file"
								accept="image/png,image/jpeg,image/webp,image/gif"
								onChange={(event) => {
									artworkRevision.current += 1;
									setArtwork(event.target.files?.[0] ?? null);
									setEstimate(null);
									setError(null);
								}}
							/>
						</div>
					) : null}
					{mode === 'collection' && collectionFiles.length ? (
						<div className="collection-file-list">
							{collectionFiles.map((item, index) => (
								<div key={`${item.name}-${item.size}-${index}`}>
									<span>
										<strong>{index + 1}</strong>
										{item.name.replace(/\.[^.]+$/, '')}
									</span>
									<Button
										type="button"
										size="icon"
										aria-label={`Remove ${item.name}`}
										onClick={() =>
											selectCollectionFiles(
												collectionFiles.filter((_, heldIndex) => heldIndex !== index)
											)
										}
										variant="danger"
									>
										<X className="ui-icon ui-icon--sm" aria-hidden="true" />
									</Button>
								</div>
							))}
							<Button type="button" onClick={() => fileInput.current?.click()} size="custom">
								<Upload className="ui-icon ui-icon--sm" aria-hidden="true" /> Add images
							</Button>
						</div>
					) : null}
				</div>

				<form
					className="create-form"
					onSubmit={(event) => {
						event.preventDefault();
						void mint();
					}}
				>
					<div className="create-field">
						<label htmlFor="mint-name">
							{mode === 'asset' ? 'Name' : mode === 'collection' ? 'Collection name' : 'Token name'}
						</label>
						<input
							id="mint-name"
							maxLength={80}
							placeholder={
								mode === 'asset'
									? 'Name your asset'
									: mode === 'collection'
									? 'Name your collection'
									: 'Name your token'
							}
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
						<span>{name.length} / 80</span>
					</div>
					<div className="create-field">
						<label htmlFor="mint-description">
							{mode === 'asset'
								? 'Description'
								: mode === 'collection'
								? 'Collection description'
								: 'Token description'}{' '}
							<small>Optional</small>
						</label>
						<textarea
							id="mint-description"
							maxLength={600}
							placeholder={
								mode === 'asset'
									? 'Tell collectors about this work'
									: mode === 'collection'
									? 'Describe this collection'
									: 'Describe this token'
							}
							rows={5}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
						/>
						<span>{description.length} / 600</span>
					</div>

					{mode === 'fungible' ? (
						<>
							<div className="create-field">
								<label htmlFor="mint-ticker">Ticker</label>
								<input
									id="mint-ticker"
									maxLength={MAX_FUNGIBLE_TICKER_LENGTH}
									placeholder="WEAVE"
									value={ticker}
									onChange={(event) => setTicker(event.target.value)}
								/>
								<span>
									{ticker.length} / {MAX_FUNGIBLE_TICKER_LENGTH}
								</span>
							</div>
							<div className="create-field">
								<label htmlFor="mint-supply">Total supply</label>
								<input
									id="mint-supply"
									inputMode="numeric"
									placeholder="1000000"
									value={wholeSupply}
									onChange={(event) => setWholeSupply(event.target.value.trim())}
								/>
							</div>
							<div className="create-field">
								<label htmlFor="mint-denomination">Decimal places</label>
								<input
									id="mint-denomination"
									inputMode="numeric"
									min="0"
									max={MAX_FUNGIBLE_DENOMINATION}
									step="1"
									type="number"
									value={denomination}
									onChange={(event) => setDenomination(event.target.value.trim())}
								/>
							</div>
							<div className="create-field fungible-logo-field">
								<label htmlFor="mint-logo">
									Token logo <small>Optional</small>
								</label>
								<Button
									className={`fungible-logo-dropzone${logoPreview ? ' has-file' : ''}`}
									type="button"
									size="custom"
									onClick={() => logoInput.current?.click()}
									onDragOver={(event) => event.preventDefault()}
									onDrop={(event) => {
										event.preventDefault();
										selectLogo(event.dataTransfer.files?.[0] ?? null);
									}}
								>
									{logoPreview && logo ? (
										<>
											<img
												src={logoPreview}
												alt={`${name.trim() || ticker.trim() || 'Token'} logo preview`}
											/>
											<span>
												<strong>{logo.name}</strong>
												<small>{formatBytes(logo.size)} · click or drop to replace</small>
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
								<input
									ref={logoInput}
									className="mint-file-input"
									id="mint-logo"
									type="file"
									accept="image/png,image/jpeg,image/webp,image/gif"
									onChange={(event) => selectLogo(event.target.files?.[0] ?? null)}
								/>
								{logo ? (
									<div className="fungible-logo-meta">
										<span>
											{logoTxId ? (
												<>
													Transaction ID <code>{logoTxId}</code>
												</>
											) : (
												'The transaction ID will appear here after the logo upload.'
											)}
										</span>
										<Button
											type="button"
											size="custom"
											variant="danger"
											onClick={() => selectLogo(null)}
										>
											<X className="ui-icon ui-icon--sm" aria-hidden="true" /> Remove
										</Button>
									</div>
								) : null}
							</div>
						</>
					) : null}

					{mode !== 'fungible' ? (
						<section className="create-license" aria-labelledby="mint-license-heading">
							<div className="create-license-heading">
								<div>
									<strong id="mint-license-heading">Usage rights</strong>
									<span>
										Attach machine-readable terms stored with{' '}
										{mode === 'asset' ? 'this asset' : 'every asset'} on Arweave.
									</span>
								</div>
								<MarketSelect<'udl' | 'none'>
									label="License"
									value={udlEnabled ? 'udl' : 'none'}
									options={[
										{ value: 'udl', label: 'Universal Data License 0.2' },
										{ value: 'none', label: 'No license tags' },
									]}
									onChange={(value) => {
										setUdlEnabled(value === 'udl');
										setEstimate(null);
										setCollectionEstimate(null);
										setError(null);
									}}
									showLabel={false}
								/>
							</div>

							{udlEnabled ? (
								<div className="udl-options">
									<p>
										<a
											href={`${arweaveGatewayFromLocation()}/${UDL_LICENSE_ID}`}
											target="_blank"
											rel="noreferrer"
										>
											Read UDL 0.2{' '}
											<ArrowUpRight className="ui-icon ui-icon--sm" aria-hidden="true" />
										</a>
									</p>
									<img alt="Universal Data License" className="udl-options-logo" src={udlLogo} />
									<div aria-label="UDL presets" className="udl-presets" role="group">
										{UDL_PRESET_OPTIONS.map((preset) => (
											<button
												aria-pressed={udlPreset === preset.value}
												className={`udl-preset udl-preset--${preset.value}`}
												key={preset.value}
												onClick={() => applyUdlPreset(preset.value)}
												type="button"
											>
												<div className="udl-preset-title">
													{preset.icon}
													<strong>{preset.label}</strong>
												</div>
												<span>{preset.description}</span>
											</button>
										))}
									</div>
									{udlPreset === 'share-with-payment' ? (
										<div className="udl-preset-payment">
											<div className="udl-preset-payment-copy">
												<strong>One-time fee</strong>
												<span>
													Applied to derivatives, commercial use, and AI model training.
												</span>
											</div>
											<label className="udl-value udl-preset-payment-value">
												<span className="udl-value-label">Amount</span>
												<input
													aria-label="Share with payment one-time fee amount"
													className="has-currency-suffix"
													inputMode="decimal"
													min="0.000000000001"
													step="any"
													type="number"
													value={udlTerms.derivation?.value ?? '1'}
													onBlur={(event) => {
														if (!event.target.value) setShareWithPaymentAmount('1');
													}}
													onChange={(event) => setShareWithPaymentAmount(event.target.value)}
												/>
												<span className="udl-value-suffix">
													<ArCurrencyLabel />
												</span>
											</label>
										</div>
									) : null}

									<details className="udl-advanced">
										<summary>{udlPreset ? 'Advanced terms' : 'Advanced terms · Custom'}</summary>
										<div className="udl-advanced-content">
											<section
												className="udl-term-section"
												aria-labelledby="udl-payment-terms-heading"
											>
												<div className="udl-term-section-heading">
													<strong id="udl-payment-terms-heading">Usage and payment</strong>
													<span>
														Choose access and usage permissions, including any required
														fees.
													</span>
												</div>
								<div className="udl-grid udl-payment-terms-grid">
									<div className="udl-field">
										<label>Access</label>
										<div
															className={
																udlTerms.accessFee
																	? 'udl-field-control with-value'
																	: 'udl-field-control'
															}
														>
											<MarketSelect<'free' | 'one-time'>
												label="Access"
												showLabel={false}
																value={udlTerms.accessFee ? 'one-time' : 'free'}
																options={[
																	{ value: 'free', label: 'Free' },
																	{ value: 'one-time', label: 'One-time fee' },
																]}
																onChange={(value) =>
																	customizeUdlTerms((current) => ({
																		...current,
																		accessFee:
																			value === 'one-time' ? '1' : undefined,
																	}))
																}
															/>
											{udlTerms.accessFee ? (
												<label className="udl-value">
													<span className="udl-value-label">Amount</span>
													<input
														aria-label="Access fee amount"
														className="has-currency-suffix"
																		inputMode="decimal"
																		min="0.000000000001"
																		step="any"
																		type="number"
																		value={udlTerms.accessFee}
																		onChange={(event) =>
																			customizeUdlTerms((current) => ({
																				...current,
																				accessFee: event.target.value || '1',
																			}))
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
														value={udlTerms.derivation}
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
															customizeUdlTerms((current) => ({
																...current,
																derivation: value as UdlTerms['derivation'],
															}))
														}
													/>
													<UdlGrantField
														label="Commercial use"
														value={udlTerms.commercialUse}
														options={[
															['allowed', 'Allowed'],
															['credit', 'Allowed with credit'],
															['revenue-share', 'Allowed with revenue share'],
															['one-time', 'Allowed with one-time fee'],
															['monthly', 'Allowed with monthly fee'],
														]}
														onChange={(value) =>
															customizeUdlTerms((current) => ({
																...current,
																commercialUse: value as UdlTerms['commercialUse'],
															}))
														}
													/>
													<UdlGrantField
														label="AI model training"
														value={udlTerms.dataModelTraining}
														options={[
															['allowed', 'Allowed'],
															['one-time', 'Allowed with one-time fee'],
															['monthly', 'Allowed with monthly fee'],
														]}
														onChange={(value) =>
															customizeUdlTerms((current) => ({
																...current,
																dataModelTraining:
																	value as UdlTerms['dataModelTraining'],
															}))
														}
													/>
												</div>
											</section>

											<section
												className="udl-term-section"
												aria-labelledby="udl-other-terms-heading"
											>
												<div className="udl-term-section-heading">
													<strong id="udl-other-terms-heading">Other terms</strong>
													<span>Set the fallback rights and duration for this license.</span>
												</div>

												<div className="udl-grid udl-other-terms-grid">
													<div className="udl-field">
														<div className="udl-field-control">
															<MarketSelect<'included' | 'excluded'>
																label="Unknown usage rights"
																value={udlTerms.unknownUsageRights ?? 'included'}
																options={[
																	{
																		value: 'included',
																		label: 'Included when legally available',
																	},
																	{ value: 'excluded', label: 'Excluded' },
																]}
																onChange={(value) =>
																	customizeUdlTerms((current) => ({
																		...current,
																		unknownUsageRights:
																			value === 'excluded'
																				? 'excluded'
																				: undefined,
																	}))
																}
															/>
														</div>
													</div>
													<div className="udl-field">
														<label htmlFor="udl-expiry">License term</label>
														<div className="udl-field-control with-suffix">
															<input
																id="udl-expiry"
																inputMode="numeric"
																min="1"
																placeholder="Unlimited"
																step="1"
																type="number"
																value={udlTerms.expiry ?? ''}
																onChange={(event) =>
																	customizeUdlTerms((current) => ({
																		...current,
																		expiry: event.target.value || undefined,
																	}))
																}
															/>
															<span>years</span>
														</div>
													</div>
												</div>
											</section>
										</div>
									</details>
								</div>
							) : (
								<p className="udl-none">
									No license metadata will be written. Copyright defaults still apply.
								</p>
							)}
						</section>
					) : null}

					<div className="mint-summary">
						<div>
							<span>{mode === 'asset' ? 'Edition' : mode === 'collection' ? 'Assets' : 'Supply'}</span>
							<strong>
								{mode === 'asset'
									? '1 of 1'
									: mode === 'collection'
									? collectionFiles.length || '—'
									: wholeSupply && /^[1-9]\d*$/.test(wholeSupply)
									? `${wholeSupply} ${ticker.trim() || 'tokens'}`
									: '—'}
							</strong>
						</div>
						<div>
							<span>
								{mode === 'asset'
									? 'Storage target'
									: mode === 'collection'
									? 'Transactions'
									: 'Ticker'}
							</span>
							<strong>
								{mode === 'asset'
									? '1 atomic asset'
									: mode === 'collection'
									? collectionEstimate
										? collectionEstimate.transactionCount
										: '—'
									: ticker.trim() || '—'}
							</strong>
						</div>
						<div>
							<span>Estimated network cost</span>
							<strong>
								{estimating ? (
									'Checking…'
								) : activeEstimate ? (
									<ArCurrencyText>{`${winstonToAr(
										activeEstimate.total.toString()
									)} AR`}</ArCurrencyText>
								) : (
									'—'
								)}
							</strong>
						</div>
					</div>

					{activeEstimate && isHighMintCost(activeEstimate.total) ? (
						<section className="mint-cost-note" aria-label="Estimated storage cost">
							<Info className="ui-icon" aria-hidden="true" />
							<div>
								<strong>
									<ArCurrencyText>
										{`${winstonToAr(activeEstimate.total.toString())} AR estimated storage cost`}
									</ArCurrencyText>
								</strong>
								<span>
									Based on{' '}
									{activeUploadBytes
										? `${formatBytes(activeUploadBytes)} of permanent media`
										: 'the selected assets'}{' '}
									and current network pricing.
								</span>
							</div>
						</section>
					) : null}
					<div className="mint-notice">
						<Info className="ui-icon" aria-hidden="true" />
						<span>
							{mode === 'asset'
								? artwork
									? 'Your wallet will request two signatures: one for the optional album artwork and one atomic transaction containing the audio, metadata, and tradeable process.'
									: 'Your wallet will request one signature for an atomic transaction containing the media, metadata, and tradeable process.'
								: mode === 'fungible'
								? `${
										logo && !logoTxId
											? 'Your wallet will request two signatures: one for the logo and one for the atomic token process.'
											: 'Your wallet will request one signature for the atomic token process.'
								  } The whole supply is minted to your connected wallet; the token becomes readable and dispatchable once the scheduler sequences it (~20 minutes).`
								: collectionEstimate
								? `Your wallet will request ${collectionEstimate.transactionCount} signatures: one atomic transaction per asset, then the collection manifest and carrier process.`
								: 'Each image becomes one self-contained atomic transaction. Bazar then submits a collection manifest and carrier process to Arweave.'}
						</span>
					</div>
					{error ? (
						<div className="inline-error">
							<span>{error}</span>
						</div>
					) : null}
					{result || collectionResult ? (
						<div className={`mint-success${result && !resultReady ? ' propagating' : ''}`}>
							<span>
								{result && !resultReady ? (
									<InfinityIcon aria-hidden="true" />
								) : (
									<Check aria-hidden="true" />
								)}
							</span>
							<div>
								<strong>{result && resultReady ? 'Live on Bazar' : 'Submitted to Arweave'}</strong>
								<p>
									{collectionResult
										? 'The collection receipt is ready to verify.'
										: resultReady
										? 'The asset is available through the selected gateway.'
										: 'Submitted and accepted by Arweave. It is safe to leave this page; Bazar will keep watching in Activity.'}
								</p>
								<MintTransactionReceipt entries={receiptEntries} />
							</div>
							<div className="mint-success-actions">
								{result && !resultReady ? (
									<Button type="button" size="custom" onClick={() => navigate('/')}>
										Continue browsing{' '}
										<ArrowRight className="ui-icon ui-icon--sm" aria-hidden="true" />
									</Button>
								) : null}
								<Button
									type="button"
									size="custom"
									disabled={Boolean(result && !resultReady)}
									onClick={() =>
										navigate(
											collectionResult
												? `/collection/${collectionResult.collection.id}`
												: `/asset/${CREATED_COLLECTION_ID}/${result!.id}`
										)
									}
								>
									View {collectionResult ? 'collection' : resultReady ? 'asset' : 'when available'}{' '}
									{result && !resultReady ? (
										<InfinityIcon className="ui-icon ui-icon--sm" aria-hidden="true" />
									) : (
										<ArrowRight className="ui-icon ui-icon--sm" aria-hidden="true" />
									)}
								</Button>
							</div>
						</div>
					) : mode === 'fungible' && (fungibleSubmitting || fungibleResult || fungibleOperationError) ? (
						<Button
							className="mint-submit"
							ref={fungibleProgressButton}
							type="button"
							size="custom"
							onClick={() => setFungibleDialogVisible(true)}
						>
							{fungibleOperationError
								? 'Review mint error'
								: fungibleResultReady
								? 'View mint result'
								: 'View mint progress'}
							{fungibleOperationError || fungibleResultReady ? (
								<ArrowRight className="ui-icon" aria-hidden="true" />
							) : (
								<InfinityIcon className="ui-icon" aria-hidden="true" />
							)}
						</Button>
					) : (
						<Button
							className="mint-submit"
							type="submit"
							size="custom"
							disabled={
								working ||
								Boolean(wallet.address && readingAudioMetadata) ||
								Boolean(wallet.address && mode === 'asset' && file && name.trim() && !estimate) ||
								Boolean(
									wallet.address &&
										mode === 'collection' &&
										collectionFiles.length &&
										name.trim() &&
										!collectionEstimate
								) ||
								Boolean(wallet.address && mode === 'fungible' && fungibleReady && !fungibleEstimate)
							}
						>
							{working
								? phaseLabel
								: wallet.address
								? mode === 'asset'
									? 'Upload and mint'
									: mode === 'collection'
									? 'Mint collection'
									: 'Mint token'
								: 'Connect wallet to create'}
							{!working ? <ArrowRight className="ui-icon" aria-hidden="true" /> : null}
						</Button>
					)}
				</form>
			</div>
			{fungibleSubmitting || fungibleResult || fungibleOperationError || fungibleDialogVisible ? (
				<FungibleMintDialog
					confirmations={mintConfirmations}
					consensus={mintConsensus}
					error={fungibleOperationError}
					logoPreview={logoPreview}
					name={name}
					onClearError={() => setFungibleOperationError(null)}
					onNavigate={navigate}
					onVisibleChange={setFungibleDialogVisible}
					phase={fungiblePhase}
					phaseLabel={phaseLabel}
					progressButton={fungibleProgressButton}
					ready={fungibleResultReady}
					result={fungibleResult}
					ticker={ticker}
					views={mintViews}
					visible={fungibleDialogVisible}
				/>
			) : null}
		</section>
	);
}
