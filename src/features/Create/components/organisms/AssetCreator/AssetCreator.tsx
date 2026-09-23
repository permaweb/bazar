import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, InfinityIcon, Info } from 'lucide-react';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Eyebrow } from 'components/atoms/Eyebrow';
import { Icon } from 'components/atoms/Icon';
import { SegmentedTabs } from 'components/atoms/SegmentedTabs';
import { TextArea } from 'components/atoms/TextArea';
import { TextInput } from 'components/atoms/TextInput';
import { MintTransactionReceipt } from 'components/molecules/MintTransactionReceipt';
import { winstonToAr } from 'helpers/ar-units';
import { asyncData } from 'helpers/async-state';
import { formatBytes } from 'helpers/format';

import { useAssetCreator } from '../../../hooks/useAssetCreator';
import {
	fungibleMintError,
	fungibleMintPhase,
	fungibleMintResult,
	mintReceiptEntries,
	mintResultPath,
} from '../../../model/mint-flow';
import { type CreatorMode, isWholeTokenSupply } from '../../../model/mint-form';
import { FungibleTokenFields } from '../../molecules/FungibleTokenFields';
import { FungibleMintDialog } from '../FungibleMintDialog';
import { MintMediaPicker } from '../MintMediaPicker';
import { UdlLicenseEditor } from '../UdlLicenseEditor';

export default function AssetCreator() {
	const navigate = useNavigate();
	const creator = useAssetCreator();
	const fungibleProgressButton = React.useRef<HTMLButtonElement>(null);
	const mode = creator.mode;
	const fields = creator.fields;
	const flow = creator.flow;
	const collectionEstimate = asyncData(creator.estimates.collection);
	const cost = creator.cost;
	const fungibleResult = fungibleMintResult(flow);
	const fungibleError = fungibleMintError(flow);
	const fungibleSubmitting = flow.fungible.status === 'submitting';
	const resultPath = mintResultPath(flow);

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		void creator.mint();
	};

	return (
		<section className="create-page">
			<div className="create-heading">
				<div>
					<Eyebrow>Create on Arweave</Eyebrow>
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

			<SegmentedTabs<CreatorMode>
				active={mode}
				ariaLabel="Create type"
				className="create-mode"
				idPrefix="create-mode"
				onChange={creator.setMode}
				tabs={[
					{ value: 'asset', label: 'Unique 1/1' },
					{ value: 'collection', label: 'Collection' },
					{ value: 'fungible', label: 'Token' },
				]}
			/>

			{mode === 'asset' && flow.draft ? (
				<div className="mint-recovery" role="status">
					<div>
						<strong>Finish your previous mint</strong>
						<span>
							The earlier media upload for “{flow.draft.name}” was accepted. Bazar can reuse its bytes to
							finish a self-contained atomic asset.
						</span>
					</div>
					<div>
						<Button
							type="button"
							onClick={() => void creator.resume()}
							disabled={creator.working}
							size="custom"
						>
							Finish mint
						</Button>
						<Button type="button" onClick={creator.dismissDraft} disabled={creator.working} size="custom">
							Dismiss
						</Button>
					</div>
				</div>
			) : null}

			<div className="create-layout">
				<MintMediaPicker
					mode={mode}
					name={fields.name}
					ticker={fields.ticker}
					wholeSupply={fields.wholeSupply}
					denomination={fields.denomination}
					logoPreview={fields.logoPreview}
					file={fields.file}
					preview={fields.preview}
					selectedContentType={fields.selectedContentType}
					audioSelected={fields.audioSelected}
					artwork={fields.artwork}
					artworkPreview={fields.artworkPreview}
					audioMetadata={fields.audioMetadata}
					readingAudioMetadata={fields.readingAudioMetadata}
					collectionFiles={fields.collectionFiles}
					collectionPreviews={fields.collectionPreviews}
					onFileSelect={creator.selectFile}
					onCollectionFilesSelect={creator.selectCollectionFiles}
					onCollectionFileRemove={creator.removeCollectionFile}
					onArtworkSelect={creator.selectArtwork}
					onArtworkRemove={creator.removeArtwork}
				/>

				<form className="create-form" onSubmit={handleSubmit}>
					<div className="create-field">
						<label htmlFor="mint-name">
							{mode === 'asset' ? 'Name' : mode === 'collection' ? 'Collection name' : 'Token name'}
						</label>
						<TextInput
							id="mint-name"
							maxLength={80}
							placeholder={
								mode === 'asset'
									? 'Name your asset'
									: mode === 'collection'
									? 'Name your collection'
									: 'Name your token'
							}
							value={fields.name}
							onChange={(event) => creator.setName(event.target.value)}
						/>
						<span>{fields.name.length} / 80</span>
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
						<TextArea
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
							value={fields.description}
							onChange={(event) => creator.setDescription(event.target.value)}
						/>
						<span>{fields.description.length} / 600</span>
					</div>

					{mode === 'fungible' ? (
						<FungibleTokenFields
							name={fields.name}
							ticker={fields.ticker}
							wholeSupply={fields.wholeSupply}
							denomination={fields.denomination}
							logo={fields.logo}
							logoPreview={fields.logoPreview}
							logoTxId={fields.logoTxId}
							limits={creator.fungibleLimits}
							onTickerChange={creator.setTicker}
							onWholeSupplyChange={creator.setWholeSupply}
							onDenominationChange={creator.setDenomination}
							onLogoSelect={creator.selectLogo}
						/>
					) : null}

					{mode !== 'fungible' ? (
						<UdlLicenseEditor
							scope={mode}
							license={creator.license}
							onEnabledChange={creator.setLicenseEnabled}
							onPresetApply={creator.applyLicensePreset}
							onShareWithPaymentAmountChange={creator.setShareWithPaymentAmount}
							onTermsChange={creator.updateLicenseTerms}
							onConfigurationModeChange={creator.setLicenseConfigurationMode}
							onCustomLicenseIdChange={creator.setCustomLicenseId}
						/>
					) : null}

					<div className="mint-summary">
						<div>
							<span>{mode === 'asset' ? 'Edition' : mode === 'collection' ? 'Assets' : 'Supply'}</span>
							<strong>
								{mode === 'asset'
									? '1 of 1'
									: mode === 'collection'
									? fields.collectionFiles.length || '—'
									: isWholeTokenSupply(fields.wholeSupply)
									? `${fields.wholeSupply} ${fields.ticker.trim() || 'tokens'}`
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
									: fields.ticker.trim() || '—'}
							</strong>
						</div>
						<div>
							<span>Estimated network cost</span>
							<strong>
								{creator.estimates.estimating ? (
									'Checking…'
								) : cost.estimate ? (
									<ArCurrencyText>{`${winstonToAr(
										cost.estimate.total.toString()
									)} AR`}</ArCurrencyText>
								) : (
									'—'
								)}
							</strong>
						</div>
					</div>

					{cost.estimate && cost.highCost ? (
						<section className="mint-cost-note" aria-label="Estimated storage cost">
							<Icon icon={Info} />
							<div>
								<strong>
									<ArCurrencyText>
										{`${winstonToAr(cost.estimate.total.toString())} AR estimated storage cost`}
									</ArCurrencyText>
								</strong>
								<span>
									Based on{' '}
									{cost.uploadBytes
										? `${formatBytes(cost.uploadBytes)} of permanent media`
										: 'the selected assets'}{' '}
									and current network pricing.
								</span>
							</div>
						</section>
					) : null}
					<div className="mint-notice">
						<Icon icon={Info} />
						<span>
							{mode === 'asset'
								? fields.artwork
									? 'Your wallet will request two signatures: one for the optional album artwork and one atomic transaction containing the audio, metadata, and tradeable process.'
									: 'Your wallet will request one signature for an atomic transaction containing the media, metadata, and tradeable process.'
								: mode === 'fungible'
								? `${
										fields.logo && !fields.logoTxId
											? 'Your wallet will request two signatures: one for the logo and one for the atomic token process.'
											: 'Your wallet will request one signature for the atomic token process.'
								  } The whole supply is minted to your connected wallet; the token becomes readable and dispatchable once the scheduler sequences it (~20 minutes).`
								: collectionEstimate
								? `Your wallet will request ${collectionEstimate.transactionCount} signatures: one atomic transaction per asset, then the collection manifest and carrier process.`
								: 'Each image becomes one self-contained atomic transaction. Bazar then submits a collection manifest and carrier process to Arweave.'}
						</span>
					</div>
					{flow.error ? (
						<div className="inline-error">
							<span>{flow.error}</span>
						</div>
					) : null}
					{flow.assetResult || flow.collectionResult ? (
						<div
							className={`mint-success${
								flow.assetResult && !creator.assetResultLive ? ' propagating' : ''
							}`}
						>
							<span>
								{flow.assetResult && !creator.assetResultLive ? (
									<InfinityIcon aria-hidden="true" />
								) : (
									<Check aria-hidden="true" />
								)}
							</span>
							<div>
								<strong>
									{flow.assetResult && creator.assetResultLive
										? 'Live on Bazar'
										: 'Submitted to Arweave'}
								</strong>
								<p>
									{flow.collectionResult
										? 'The collection receipt is ready to verify.'
										: creator.assetResultLive
										? 'The asset is available through the selected gateway.'
										: 'Submitted and accepted by Arweave. It is safe to leave this page; Bazar will keep watching in Activity.'}
								</p>
								<MintTransactionReceipt entries={mintReceiptEntries(flow)} />
							</div>
							<div className="mint-success-actions">
								{flow.assetResult && !creator.assetResultLive ? (
									<Button type="button" size="custom" onClick={() => navigate('/')}>
										Continue browsing <Icon icon={ArrowRight} size="sm" />
									</Button>
								) : null}
								<Button
									type="button"
									size="custom"
									disabled={Boolean(flow.assetResult && !creator.assetResultLive)}
									onClick={() => {
										if (resultPath) navigate(resultPath);
									}}
								>
									View{' '}
									{flow.collectionResult
										? 'collection'
										: creator.assetResultLive
										? 'asset'
										: 'when available'}{' '}
									{flow.assetResult && !creator.assetResultLive ? (
										<Icon icon={InfinityIcon} size="sm" />
									) : (
										<Icon icon={ArrowRight} size="sm" />
									)}
								</Button>
							</div>
						</div>
					) : mode === 'fungible' && flow.fungible.status !== 'idle' ? (
						<Button
							className="mint-submit"
							ref={fungibleProgressButton}
							type="button"
							size="custom"
							onClick={() => creator.setFungibleDialogVisible(true)}
						>
							{fungibleError
								? 'Review mint error'
								: creator.fungibleResultLive
								? 'View mint result'
								: 'View mint progress'}
							{fungibleError || creator.fungibleResultLive ? (
								<Icon icon={ArrowRight} />
							) : (
								<Icon icon={InfinityIcon} />
							)}
						</Button>
					) : (
						<Button className="mint-submit" type="submit" size="custom" disabled={creator.submitDisabled}>
							{creator.working
								? creator.phaseLabel
								: creator.walletConnected
								? mode === 'asset'
									? 'Upload and mint'
									: mode === 'collection'
									? 'Mint collection'
									: 'Mint token'
								: 'Connect wallet to create'}
							{!creator.working ? <Icon icon={ArrowRight} /> : null}
						</Button>
					)}
				</form>
			</div>
			{fungibleSubmitting || fungibleResult || fungibleError || flow.fungibleDialogVisible ? (
				<FungibleMintDialog
					confirmations={creator.fungibleConfirmation.confirmations}
					consensus={creator.fungibleConfirmation.consensus}
					error={fungibleError}
					logoPreview={fields.logoPreview}
					name={fields.name}
					onClearError={creator.clearFungibleError}
					onNavigate={navigate}
					onVisibleChange={creator.setFungibleDialogVisible}
					phase={fungibleMintPhase(flow)}
					phaseLabel={creator.phaseLabel}
					progressButton={fungibleProgressButton}
					ready={creator.fungibleResultLive}
					result={fungibleResult}
					ticker={fields.ticker}
					views={creator.fungibleConfirmation.views}
					visible={flow.fungibleDialogVisible}
				/>
			) : null}
		</section>
	);
}
