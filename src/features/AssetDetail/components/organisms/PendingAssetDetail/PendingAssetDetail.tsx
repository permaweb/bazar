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

import { usePendingAssetMint } from '../../../hooks/usePendingAssetMint';
import { PENDING_MINT_PHASES, type PendingMintTransactionRole, pendingMintView } from '../../../model/pending-asset';

const PHASE_LABELS: Record<(typeof PENDING_MINT_PHASES)[number], string> = {
	accepted: 'Accepted by Arweave',
	mined: 'Mined',
	applied: 'Applied to process state',
	complete: 'Live on Bazar',
};

const TRANSACTION_LABELS: Record<PendingMintTransactionRole, string> = {
	artwork: 'Artwork transaction',
	asset: 'Asset transaction',
	logo: 'Token logo transaction',
	token: 'Token process transaction',
};

export default function PendingAssetDetail() {
	const { collectionId = '', assetId = '' } = useParams();
	const mint = usePendingAssetMint(collectionId, assetId);

	if (!mint.asset) {
		return (
			<RouteState title="Upload not found" backTo="/create" backLabel="Back to create">
				<p>This browser does not have a saved upload for that transaction.</p>
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
				<Icon icon={ArrowLeft} size="sm" /> Continue browsing
			</Link>
			<div className="mint-pending-layout">
				<div className="mint-pending-artwork">
					{mint.asset.image ? (
						<ArtworkImage src={mint.asset.image} alt={`${mint.asset.name} artwork`} />
					) : view.fungible ? (
						<TokenArtwork ticker={mint.asset.ticker || mint.asset.name} />
					) : isAudioContentType(mint.asset.contentType) ? (
						<AudioArtwork contentType={mint.asset.contentType} name={mint.asset.name} />
					) : (
						<span className="mint-pending-artwork-fallback" aria-hidden="true">
							{mint.asset.name.slice(0, 1)}
						</span>
					)}
				</div>
				<div className="mint-pending-copy">
					<Eyebrow>Submitted · safe to leave</Eyebrow>
					<h1>{mint.asset.name}</h1>
					<p>{mint.activity.status}</p>
					<ol className="mint-pending-phases">
						{PENDING_MINT_PHASES.map((phase, index) => (
							<li className={index <= view.currentPhaseIndex ? 'reached' : undefined} key={phase}>
								<span>{index < view.currentPhaseIndex ? <Check aria-hidden="true" /> : index + 1}</span>
								{PHASE_LABELS[phase]}
							</li>
						))}
					</ol>
					<p className="mint-pending-gateway">
						Tracking is pinned to the gateways that accepted this operation
						{view.pinnedGateway
							? '. Your current gateway selection is different; Bazar will not restart the upload'
							: ''}
						.
					</p>
					<div className="mint-pending-actions">
						<a href={transactionExplorerUrl(mint.asset.id)} target="_blank" rel="noreferrer">
							View transaction <Icon icon={ArrowUpRight} size="sm" />
						</a>
						<Button type="button" size="custom" disabled>
							View when available <Icon icon={InfinityIcon} size="sm" />
						</Button>
					</div>
					<MintTransactionReceipt
						entries={view.transactions.map((transaction) => ({
							label: TRANSACTION_LABELS[transaction.role],
							transactionId: transaction.transactionId,
						}))}
					/>
				</div>
			</div>
		</section>
	);
}
