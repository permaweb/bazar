import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, InfinityIcon, Info, Upload, X } from 'lucide-react';

import { waitForAssetState } from 'api/asset-marketplace';
import {
	AssetMintClient,
	CollectionMintClient,
	type CollectionMintEstimate,
	type CollectionMintPhase,
	type CollectionMintResult,
	CREATED_COLLECTION_ID,
	discardMintDraft,
	getMintDraft,
	isHighMintCost,
	type MintDraft,
	type MintedAsset,
	type MintEstimate,
	type MintPhase,
	UDL_LICENSE_ID,
	type UdlTerms,
} from 'api/asset-mint';

import { AudioArtwork } from 'components/AudioArtwork';
import { Button } from 'components/Button';
import { Loading } from 'components/Loading';
import { MintTransactionReceipt, type MintTransactionReceiptEntry } from 'components/MintTransactionReceipt';
import { SegmentedTabs } from 'components/SegmentedTabs';
import { isAudioContentType, normalizeAssetContentType } from 'helpers/asset-media';
import { type EmbeddedAudioMetadata, extractEmbeddedAudioMetadata, formatAudioDuration } from 'helpers/audio-metadata';
import { arweaveGatewayFromLocation } from 'helpers/config';
import { useWallet } from 'providers/WalletProvider';

import {
	formatBytes,
	MarketContext,
	MarketSelect,
	mintErrorMessage,
	useOperationActivity,
	winstonToAr,
} from '../app/App';

type UdlGrantValue = NonNullable<UdlTerms['derivation'] | UdlTerms['commercialUse'] | UdlTerms['dataModelTraining']>;

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
			<div className={needsValue ? 'udl-field-control with-value' : 'udl-field-control'}>
				<MarketSelect
					label={label}
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
						<span>{value.grant === 'revenue-share' ? 'Percent' : 'Amount'}</span>
						<input
							aria-label={`${label} ${value.grant === 'revenue-share' ? 'percentage' : 'fee amount'}`}
							inputMode="decimal"
							min="0.000000000001"
							max={value.grant === 'revenue-share' ? '100' : undefined}
							step="any"
							type="number"
							value={value.value ?? '1'}
							onChange={(event) => onChange({ ...value, value: event.target.value || '1' })}
						/>
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
	const metadataRequest = React.useRef(0);
	const artworkRevision = React.useRef(0);
	const [mode, setMode] = React.useState<'asset' | 'collection'>('asset');
	const [name, setName] = React.useState('');
	const [description, setDescription] = React.useState('');
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
	const [udlTerms, setUdlTerms] = React.useState<UdlTerms>({});
	const [phase, setPhase] = React.useState<MintPhase | null>(null);
	const [collectionPhase, setCollectionPhase] = React.useState<CollectionMintPhase | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [result, setResult] = React.useState<MintedAsset | null>(null);
	const [resultReady, setResultReady] = React.useState(false);
	const [collectionResult, setCollectionResult] = React.useState<CollectionMintResult | null>(null);
	const [draft, setDraft] = React.useState<MintDraft | null>(() =>
		wallet.address ? getMintDraft(wallet.address) : null
	);
	const activeUdl = udlEnabled ? udlTerms : undefined;
	const selectedContentType = file ? normalizeAssetContentType(file.type, file.name) : null;
	const audioSelected = isAudioContentType(selectedContentType ?? undefined);
	const hasUdlPayment = Boolean(
		activeUdl?.accessFee ||
			['revenue-share', 'one-time', 'monthly'].includes(activeUdl?.derivation?.grant ?? '') ||
			['revenue-share', 'one-time', 'monthly'].includes(activeUdl?.commercialUse?.grant ?? '') ||
			['one-time', 'monthly'].includes(activeUdl?.dataModelTraining?.grant ?? '')
	);

	React.useEffect(() => {
		setDraft(wallet.address ? getMintDraft(wallet.address) : null);
	}, [wallet.address]);
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
		setError(null);
		setResult(null);
		setCollectionResult(null);
		const uploadId = `upload:${wallet.address}:${Date.now()}`;
		beginUpload({
			id: uploadId,
			owner: wallet.address,
			kind: mode,
			name: name.trim(),
			status: 'Preparing secure wallet approvals…',
		});
		try {
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
			setError(message);
			failUpload(uploadId, message);
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
	const working = phase !== null || collectionPhase !== null;
	const phaseLabel = collectionPhase
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
						: 'Mint a group of one-of-one assets and submit a carrier process pointing to their permanent manifest.'}
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
									<img src={artworkPreview} alt={`${name || file?.name || 'Audio'} album artwork`} />
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
						<label htmlFor="mint-name">{mode === 'asset' ? 'Name' : 'Collection name'}</label>
						<input
							id="mint-name"
							maxLength={80}
							placeholder={mode === 'asset' ? 'Name your asset' : 'Name your collection'}
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
						<span>{name.length} / 80</span>
					</div>
					<div className="create-field">
						<label htmlFor="mint-description">
							{mode === 'asset' ? 'Description' : 'Collection description'} <small>Optional</small>
						</label>
						<textarea
							id="mint-description"
							maxLength={600}
							placeholder={
								mode === 'asset' ? 'Tell collectors about this work' : 'Describe this collection'
							}
							rows={5}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
						/>
						<span>{description.length} / 600</span>
					</div>

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
									Free access is the default. Rights not granted below remain reserved.{' '}
									<a
										href={`${arweaveGatewayFromLocation()}/${UDL_LICENSE_ID}`}
										target="_blank"
										rel="noreferrer"
									>
										Read UDL 0.2 <ArrowUpRight className="ui-icon ui-icon--sm" aria-hidden="true" />
									</a>
								</p>
								<div className="udl-grid">
									<div className="udl-field">
										<div
											className={
												udlTerms.accessFee
													? 'udl-field-control with-value'
													: 'udl-field-control'
											}
										>
											<MarketSelect<'free' | 'one-time'>
												label="Access"
												value={udlTerms.accessFee ? 'one-time' : 'free'}
												options={[
													{ value: 'free', label: 'Free' },
													{ value: 'one-time', label: 'One-time fee' },
												]}
												onChange={(value) =>
													setUdlTerms((current) => ({
														...current,
														accessFee: value === 'one-time' ? '1' : undefined,
													}))
												}
											/>
											{udlTerms.accessFee ? (
												<label className="udl-value">
													<span>Amount</span>
													<input
														aria-label="Access fee amount"
														inputMode="decimal"
														min="0.000000000001"
														step="any"
														type="number"
														value={udlTerms.accessFee}
														onChange={(event) =>
															setUdlTerms((current) => ({
																...current,
																accessFee: event.target.value || '1',
															}))
														}
													/>
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
											setUdlTerms((current) => ({
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
											setUdlTerms((current) => ({
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
											setUdlTerms((current) => ({
												...current,
												dataModelTraining: value as UdlTerms['dataModelTraining'],
											}))
										}
									/>
								</div>

								{hasUdlPayment ? (
									<div className="udl-payment">
										<div className="udl-field">
											<div className="udl-field-control">
												<MarketSelect<'U' | 'AR'>
													label="Payment currency"
													value={udlTerms.currency ?? 'U'}
													options={[
														{ value: 'U', label: '$U (UDL default)' },
														{ value: 'AR', label: 'AR' },
													]}
													onChange={(value) =>
														setUdlTerms((current) => ({
															...current,
															currency: value === 'AR' ? 'AR' : undefined,
														}))
													}
												/>
											</div>
										</div>
										<div className="udl-field udl-address">
											<label htmlFor="udl-payment-address">Payment address</label>
											<div className="udl-field-control">
												<input
													id="udl-payment-address"
													maxLength={43}
													placeholder={wallet.address || 'Uploader wallet by default'}
													value={udlTerms.paymentAddress ?? ''}
													onChange={(event) =>
														setUdlTerms((current) => ({
															...current,
															paymentAddress: event.target.value.trim() || undefined,
														}))
													}
												/>
											</div>
										</div>
										{udlTerms.paymentAddress && udlTerms.paymentAddress !== wallet.address ? (
											<p className="udl-payment-warning">
												License payments will go to this address, not the connected wallet.
											</p>
										) : null}
									</div>
								) : null}

								<details className="udl-advanced">
									<summary>Advanced terms</summary>
									<div className="udl-grid">
										<div className="udl-field">
											<div className="udl-field-control">
												<MarketSelect<'included' | 'excluded'>
													label="Unknown usage rights"
													value={udlTerms.unknownUsageRights ?? 'included'}
													options={[
														{ value: 'included', label: 'Included when legally available' },
														{ value: 'excluded', label: 'Excluded' },
													]}
													onChange={(value) =>
														setUdlTerms((current) => ({
															...current,
															unknownUsageRights:
																value === 'excluded' ? 'excluded' : undefined,
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
														setUdlTerms((current) => ({
															...current,
															expiry: event.target.value || undefined,
														}))
													}
												/>
												<span>years</span>
											</div>
										</div>
										{hasUdlPayment ? (
											<div className="udl-field">
												<div className="udl-field-control">
													<MarketSelect<'direct' | 'random' | 'global'>
														label="Payment mode"
														value={udlTerms.paymentMode ?? 'direct'}
														options={[
															{ value: 'direct', label: 'Direct to payment address' },
															{ value: 'random', label: 'Random PST distribution' },
															{ value: 'global', label: 'Global PST distribution' },
														]}
														onChange={(value) =>
															setUdlTerms((current) => ({
																...current,
																paymentMode:
																	value === 'random' || value === 'global'
																		? value
																		: undefined,
															}))
														}
													/>
												</div>
											</div>
										) : null}
									</div>
								</details>
							</div>
						) : (
							<p className="udl-none">
								No license metadata will be written. Copyright defaults still apply.
							</p>
						)}
					</section>

					<div className="mint-summary">
						<div>
							<span>{mode === 'asset' ? 'Edition' : 'Assets'}</span>
							<strong>{mode === 'asset' ? '1 of 1' : collectionFiles.length || '—'}</strong>
						</div>
						<div>
							<span>{mode === 'asset' ? 'Storage target' : 'Transactions'}</span>
							<strong>
								{mode === 'asset'
									? '1 atomic asset'
									: collectionEstimate
									? collectionEstimate.transactionCount
									: '—'}
							</strong>
						</div>
						<div>
							<span>Estimated network cost</span>
							<strong>
								{estimating
									? 'Checking…'
									: activeEstimate
									? `${winstonToAr(activeEstimate.total.toString())} AR`
									: '—'}
							</strong>
						</div>
					</div>

					{activeEstimate && isHighMintCost(activeEstimate.total) ? (
						<section className="mint-cost-note" aria-label="Estimated storage cost">
							<Info className="ui-icon" aria-hidden="true" />
							<div>
								<strong>
									{winstonToAr(activeEstimate.total.toString())} AR estimated storage cost
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
								)
							}
						>
							{working
								? phaseLabel
								: wallet.address
								? mode === 'asset'
									? 'Upload and mint'
									: 'Mint collection'
								: 'Connect wallet to create'}
							{!working ? <ArrowRight className="ui-icon" aria-hidden="true" /> : null}
						</Button>
					)}
					<p className="mint-permanence">
						Confirmed Arweave uploads are permanent and cannot be edited. Review every image, name, and
						description before signing.
					</p>
				</form>
			</div>
		</section>
	);
}
