import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, InfinityIcon } from 'lucide-react';

import { ArtworkImage } from 'components/atoms/ArtworkImage';
import { AudioArtwork } from 'components/atoms/AudioArtwork';
import { Button } from 'components/atoms/Button';
import { Eyebrow } from 'components/atoms/Eyebrow';
import { Icon } from 'components/atoms/Icon';
import { TokenArtwork } from 'components/atoms/TokenArtwork';
import { MintTransactionReceipt } from 'components/molecules/MintTransactionReceipt';
import { RouteState } from 'components/molecules/RouteState';
import { isAudioContentType } from 'helpers/asset-media';
import { arweaveGatewayFromLocation, gatewayFromLocation } from 'helpers/config';
import { transactionExplorerUrl } from 'helpers/explorer';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { usePendingAssetMint } from '../../../hooks/usePendingAssetMint';
import { ASSET_DETAIL_MESSAGES, type AssetDetailMessages } from '../../../messages';
import { audioArtworkLabel, transactionAddressCopy } from '../../../model/asset-detail';
import { PENDING_MINT_PHASES, type PendingMintTransactionRole, pendingMintView } from '../../../model/pending-asset';

const PHASE_LABEL_KEYS: Record<(typeof PENDING_MINT_PHASES)[number], keyof AssetDetailMessages> = {
	accepted: 'pendingPhaseAccepted',
	mined: 'pendingPhaseMined',
	applied: 'pendingPhaseApplied',
	complete: 'pendingPhaseComplete',
};

const PHASE_STATUS_KEYS: Record<(typeof PENDING_MINT_PHASES)[number], keyof AssetDetailMessages> = {
	accepted: 'pendingStatusAccepted',
	mined: 'pendingStatusMined',
	applied: 'pendingStatusApplied',
	complete: 'pendingStatusComplete',
};

const TRANSACTION_LABEL_KEYS: Record<PendingMintTransactionRole, keyof AssetDetailMessages> = {
	artwork: 'pendingTransactionArtwork',
	asset: 'pendingTransactionAsset',
	logo: 'pendingTransactionLogo',
	token: 'pendingTransactionToken',
};

export default function PendingAssetDetail() {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const { collectionId = '', assetId = '' } = useParams();
	const mint = usePendingAssetMint(collectionId, assetId);
	const transactionAddressLabels = transactionAddressCopy(messages);

	if (!mint.asset) {
		return (
			<RouteState
				title={messages.pendingUploadNotFound}
				backTo="/create"
				backLabel={messages.pendingBackToCreate}
				eyebrow={messages.assetDetailRouteEyebrow}
			>
				<p>{messages.pendingUploadNotFoundDetail}</p>
			</RouteState>
		);
	}
	if (!mint.activity) return <Navigate to={mint.finalPath} replace />;
	const view = pendingMintView({
		activity: mint.activity,
		asset: mint.asset,
		collectionId,
		arweaveGateway: arweaveGatewayFromLocation(),
		computeGateway: gatewayFromLocation(),
	});

	return (
		<section className="mint-pending-page">
			<Link className="back" to="/">
				<Icon icon={ArrowLeft} size="sm" /> {messages.pendingContinueBrowsing}
			</Link>
			<div className="mint-pending-layout">
				<div className="mint-pending-artwork">
					{mint.asset.image ? (
						<ArtworkImage
							src={mint.asset.image}
							alt={formatMessage(messages.pendingArtworkAlt, { name: mint.asset.name })}
							unavailableLabel={messages.assetDetailArtworkUnavailable}
						/>
					) : view.fungible ? (
						<TokenArtwork
							subtitle={messages.assetDetailTokenArtworkSubtitle}
							ticker={mint.asset.ticker || mint.asset.name}
						/>
					) : isAudioContentType(mint.asset.contentType) ? (
						<AudioArtwork
							contentType={mint.asset.contentType}
							label={audioArtworkLabel(mint.asset, messages)}
							typeLabel={messages.assetDetailAudioArtworkType}
						/>
					) : (
						<span className="mint-pending-artwork-fallback" aria-hidden="true">
							{mint.asset.name.slice(0, 1)}
						</span>
					)}
				</div>
				<div className="mint-pending-copy">
					<Eyebrow>{messages.pendingEyebrow}</Eyebrow>
					<h1>{mint.asset.name}</h1>
					<p>{messages[PHASE_STATUS_KEYS[mint.activity.phase]] as string}</p>
					<ol className="mint-pending-phases">
						{PENDING_MINT_PHASES.map((phase, index) => (
							<li className={index <= view.currentPhaseIndex ? 'reached' : undefined} key={phase}>
								<span>{index < view.currentPhaseIndex ? <Check aria-hidden="true" /> : index + 1}</span>
								{messages[PHASE_LABEL_KEYS[phase]] as string}
							</li>
						))}
					</ol>
					<p className="mint-pending-gateway">
						{view.pinnedGateway ? messages.pendingGatewayNotePinned : messages.pendingGatewayNote}
					</p>
					<div className="mint-pending-actions">
						<a href={transactionExplorerUrl(mint.asset.id)} target="_blank" rel="noreferrer">
							{messages.pendingViewTransaction} <Icon icon={ArrowUpRight} size="sm" />
						</a>
						<Button type="button" size="custom" disabled>
							{messages.pendingViewWhenAvailable} <Icon icon={InfinityIcon} size="sm" />
						</Button>
					</div>
					<MintTransactionReceipt
						addressLabels={transactionAddressLabels}
						ariaLabel={messages.assetDetailReceiptsLabel}
						entries={view.transactions.map((transaction) => {
							const label = messages[TRANSACTION_LABEL_KEYS[transaction.role]] as string;
							return {
								label,
								linkLabel: formatMessage(messages.assetDetailReceiptEntryLabel, {
									label,
									transaction: transaction.transactionId,
								}),
								transactionId: transaction.transactionId,
							};
						})}
					/>
				</div>
			</div>
		</section>
	);
}
