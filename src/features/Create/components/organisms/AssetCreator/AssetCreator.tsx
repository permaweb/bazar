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
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { useAssetCreator } from '../../../hooks/useAssetCreator';
import { CREATE_MESSAGES } from '../../../messages';
import {
	fungibleMintError,
	fungibleMintPhase,
	fungibleMintResult,
	mintReceiptEntries,
	mintResultPath,
	mintTransactionAddressCopy,
} from '../../../model/mint-flow';
import { type CreatorMode, isWholeTokenSupply } from '../../../model/mint-form';
import { FungibleTokenFields } from '../../molecules/FungibleTokenFields';
import { FungibleMintDialog } from '../FungibleMintDialog';
import { MintMediaPicker } from '../MintMediaPicker';
import { UdlLicenseEditor } from '../UdlLicenseEditor';

import * as S from './styles';

/** Field limits the counters report; they must match the inputs' own `maxLength`. */
const NAME_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 600;

export default function AssetCreator() {
	const messages = useMessages(CREATE_MESSAGES);
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
		<S.Page className="create-page">
			<S.Heading className="create-heading">
				<div>
					<Eyebrow>{messages.createEyebrow}</Eyebrow>
					<h1>{messages.createTitle}</h1>
				</div>
				<p>
					{mode === 'asset'
						? messages.createIntroAsset
						: mode === 'collection'
						? messages.createIntroCollection
						: messages.createIntroFungible}
				</p>
			</S.Heading>

			<SegmentedTabs<CreatorMode>
				active={mode}
				ariaLabel={messages.createModeLabel}
				className="create-mode"
				idPrefix="create-mode"
				onChange={creator.setMode}
				tabs={[
					{ value: 'asset', label: messages.createModeAsset },
					{ value: 'collection', label: messages.createModeCollection },
					{ value: 'fungible', label: messages.createModeFungible },
				]}
			/>

			{mode === 'asset' && flow.draft ? (
				<S.Recovery className="mint-recovery" role="status">
					<div>
						<strong>{messages.createDraftTitle}</strong>
						<span>{formatMessage(messages.createDraftDetail, { name: flow.draft.name })}</span>
					</div>
					<div>
						<Button
							type="button"
							onClick={() => void creator.resume()}
							disabled={creator.working}
							size="custom"
						>
							{messages.createDraftFinish}
						</Button>
						<Button type="button" onClick={creator.dismissDraft} disabled={creator.working} size="custom">
							{messages.createDraftDismiss}
						</Button>
					</div>
				</S.Recovery>
			) : null}

			<S.Layout className="create-layout">
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

				<S.Form className="create-form" onSubmit={handleSubmit}>
					<S.Field className="create-field">
						<label htmlFor="mint-name">
							{mode === 'asset'
								? messages.createNameLabelAsset
								: mode === 'collection'
								? messages.createNameLabelCollection
								: messages.createNameLabelFungible}
						</label>
						<TextInput
							id="mint-name"
							maxLength={NAME_MAX_LENGTH}
							placeholder={
								mode === 'asset'
									? messages.createNamePlaceholderAsset
									: mode === 'collection'
									? messages.createNamePlaceholderCollection
									: messages.createNamePlaceholderFungible
							}
							value={fields.name}
							onChange={(event) => creator.setName(event.target.value)}
						/>
						<span>
							{formatMessage(messages.createFieldCounter, {
								length: fields.name.length,
								max: NAME_MAX_LENGTH,
							})}
						</span>
					</S.Field>
					<S.Field className="create-field">
						<label htmlFor="mint-description">
							{mode === 'asset'
								? messages.createDescriptionLabelAsset
								: mode === 'collection'
								? messages.createDescriptionLabelCollection
								: messages.createDescriptionLabelFungible}{' '}
							<small>{messages.createOptional}</small>
						</label>
						<TextArea
							id="mint-description"
							maxLength={DESCRIPTION_MAX_LENGTH}
							placeholder={
								mode === 'asset'
									? messages.createDescriptionPlaceholderAsset
									: mode === 'collection'
									? messages.createDescriptionPlaceholderCollection
									: messages.createDescriptionPlaceholderFungible
							}
							rows={5}
							value={fields.description}
							onChange={(event) => creator.setDescription(event.target.value)}
						/>
						<span>
							{formatMessage(messages.createFieldCounter, {
								length: fields.description.length,
								max: DESCRIPTION_MAX_LENGTH,
							})}
						</span>
					</S.Field>

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

					<S.Summary className="mint-summary">
						<div>
							<span>
								{mode === 'asset'
									? messages.createSummaryEdition
									: mode === 'collection'
									? messages.createSummaryAssets
									: messages.createSummarySupply}
							</span>
							<strong>
								{mode === 'asset'
									? messages.createSummaryOneOfOne
									: mode === 'collection'
									? fields.collectionFiles.length || '—'
									: isWholeTokenSupply(fields.wholeSupply)
									? formatMessage(messages.createSummaryTokenSupply, {
											supply: fields.wholeSupply,
											ticker: fields.ticker.trim() || messages.mintTokenSupplyFallbackTicker,
									  })
									: '—'}
							</strong>
						</div>
						<div>
							<span>
								{mode === 'asset'
									? messages.createSummaryStorageTarget
									: mode === 'collection'
									? messages.createSummaryTransactions
									: messages.createSummaryTicker}
							</span>
							<strong>
								{mode === 'asset'
									? messages.createSummaryAtomicAsset
									: mode === 'collection'
									? collectionEstimate
										? collectionEstimate.transactionCount
										: '—'
									: fields.ticker.trim() || '—'}
							</strong>
						</div>
						<div>
							<span>{messages.createSummaryEstimatedCost}</span>
							<strong>
								{creator.estimates.estimating ? (
									messages.createSummaryChecking
								) : cost.estimate ? (
									<ArCurrencyText>
										{formatMessage(messages.createCostAmount, {
											amount: winstonToAr(cost.estimate.total.toString()),
										})}
									</ArCurrencyText>
								) : (
									'—'
								)}
							</strong>
						</div>
					</S.Summary>

					{cost.estimate && cost.highCost ? (
						<S.CostNote className="mint-cost-note" aria-label={messages.createCostNoteLabel}>
							<Icon icon={Info} />
							<div>
								<strong>
									<ArCurrencyText>
										{formatMessage(messages.createCostNoteTitle, {
											amount: winstonToAr(cost.estimate.total.toString()),
										})}
									</ArCurrencyText>
								</strong>
								<span>
									{cost.uploadBytes
										? formatMessage(messages.createCostNoteWithBytes, {
												bytes: formatBytes(cost.uploadBytes),
										  })
										: messages.createCostNoteWithoutBytes}
								</span>
							</div>
						</S.CostNote>
					) : null}
					<S.Notice className="mint-notice">
						<Icon icon={Info} />
						<span>
							{mode === 'asset'
								? fields.artwork
									? messages.createNoticeAssetWithArtwork
									: messages.createNoticeAsset
								: mode === 'fungible'
								? fields.logo && !fields.logoTxId
									? messages.createNoticeFungibleWithLogo
									: messages.createNoticeFungible
								: collectionEstimate
								? formatMessage(messages.createNoticeCollectionEstimated, {
										count: collectionEstimate.transactionCount,
								  })
								: messages.createNoticeCollection}
						</span>
					</S.Notice>
					{flow.error ? (
						<div className="inline-error">
							<span>{flow.error}</span>
						</div>
					) : null}
					{flow.assetResult || flow.collectionResult ? (
						<S.Success
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
										? messages.createResultLive
										: messages.createResultSubmitted}
								</strong>
								<p>
									{flow.collectionResult
										? messages.createResultCollectionDetail
										: creator.assetResultLive
										? messages.createResultAssetLiveDetail
										: messages.createResultPendingDetail}
								</p>
								<MintTransactionReceipt
									addressLabels={mintTransactionAddressCopy(messages)}
									ariaLabel={messages.mintReceiptsLabel}
									entries={mintReceiptEntries(flow, messages)}
								/>
							</div>
							<S.SuccessActions className="mint-success-actions">
								{flow.assetResult && !creator.assetResultLive ? (
									<Button type="button" size="custom" onClick={() => navigate('/')}>
										{messages.createContinueBrowsing} <Icon icon={ArrowRight} size="sm" />
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
									{flow.collectionResult
										? messages.createViewCollection
										: creator.assetResultLive
										? messages.createViewAsset
										: messages.createViewWhenAvailable}{' '}
									{flow.assetResult && !creator.assetResultLive ? (
										<Icon icon={InfinityIcon} size="sm" />
									) : (
										<Icon icon={ArrowRight} size="sm" />
									)}
								</Button>
							</S.SuccessActions>
						</S.Success>
					) : mode === 'fungible' && flow.fungible.status !== 'idle' ? (
						<S.SubmitButton
							className="mint-submit"
							ref={fungibleProgressButton}
							type="button"
							size="custom"
							onClick={() => creator.setFungibleDialogVisible(true)}
						>
							{fungibleError
								? messages.createFungibleReviewError
								: creator.fungibleResultLive
								? messages.createFungibleViewResult
								: messages.createFungibleViewProgress}
							{fungibleError || creator.fungibleResultLive ? (
								<Icon icon={ArrowRight} />
							) : (
								<Icon icon={InfinityIcon} />
							)}
						</S.SubmitButton>
					) : (
						<S.SubmitButton
							className="mint-submit"
							type="submit"
							size="custom"
							disabled={creator.submitDisabled}
						>
							{creator.working
								? creator.phaseLabel
								: creator.walletConnected
								? mode === 'asset'
									? messages.createSubmitAsset
									: mode === 'collection'
									? messages.createSubmitCollection
									: messages.createSubmitFungible
								: messages.createSubmitConnectWallet}
							{!creator.working ? <Icon icon={ArrowRight} /> : null}
						</S.SubmitButton>
					)}
				</S.Form>
			</S.Layout>
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
		</S.Page>
	);
}
