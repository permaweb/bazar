import React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, InfinityIcon } from 'lucide-react';

import { loadMintActivities, loadMintedAssets, type MintActivity } from 'api/mint';

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
import { useOperationActivity } from 'providers/OperationActivityProvider';

import { isFungiblePendingMint } from '../../../model/asset-detail';

export default function PendingAssetDetail() {
	const { collectionId = '', assetId = '' } = useParams();
	const navigate = useNavigate();
	const { mintActivities } = useOperationActivity();
	const activity =
		mintActivities.find((candidate) => candidate.asset.id === assetId) ??
		loadMintActivities(localStorage).find((candidate) => candidate.asset.id === assetId);
	const finalPath = `/asset/${activity?.collectionId ?? collectionId}/${assetId}`;
	const asset = activity?.asset ?? loadMintedAssets().find((candidate) => candidate.id === assetId);

	React.useEffect(() => {
		const showLiveAsset = (event: Event) => {
			if ((event as CustomEvent<MintActivity>).detail?.asset?.id === assetId)
				navigate(finalPath, { replace: true });
		};
		window.addEventListener('bazar:mint-live', showLiveAsset);
		return () => window.removeEventListener('bazar:mint-live', showLiveAsset);
	}, [assetId, finalPath, navigate]);

	if (!asset) {
		return (
			<RouteState title="Upload not found" backTo="/create" backLabel="Back to create">
				<p>This browser does not have a saved upload for that transaction.</p>
			</RouteState>
		);
	}
	if (!activity) return <Navigate to={finalPath} replace />;
	const fungible = isFungiblePendingMint(asset, activity.collectionId ?? collectionId);

	const phases: Array<[MintActivity['phase'], string]> = [
		['accepted', 'Accepted by Arweave'],
		['mined', 'Mined'],
		['applied', 'Applied to process state'],
		['complete', 'Live on Bazar'],
	];
	const currentPhase = phases.findIndex(([phase]) => phase === activity.phase);
	const pinnedGateway =
		activity.arweaveGateway !== arweaveGatewayFromLocation() || activity.computeGateway !== gatewayFromLocation();

	return (
		<section className="mint-pending-page">
			<Link className="back" to="/">
				<Icon icon={ArrowLeft} size="sm" /> Continue browsing
			</Link>
			<div className="mint-pending-layout">
				<div className="mint-pending-artwork">
					{asset.image ? (
						<ArtworkImage src={asset.image} alt={`${asset.name} artwork`} />
					) : fungible ? (
						<TokenArtwork ticker={asset.ticker || asset.name} />
					) : isAudioContentType(asset.contentType) ? (
						<AudioArtwork contentType={asset.contentType} name={asset.name} />
					) : (
						<span className="mint-pending-artwork-fallback" aria-hidden="true">
							{asset.name.slice(0, 1)}
						</span>
					)}
				</div>
				<div className="mint-pending-copy">
					<Eyebrow>Submitted · safe to leave</Eyebrow>
					<h1>{asset.name}</h1>
					<p>{activity.status}</p>
					<ol className="mint-pending-phases">
						{phases.map(([phase, label], index) => (
							<li className={index <= currentPhase ? 'reached' : undefined} key={phase}>
								<span>{index < currentPhase ? <Check aria-hidden="true" /> : index + 1}</span>
								{label}
							</li>
						))}
					</ol>
					<p className="mint-pending-gateway">
						Tracking is pinned to the gateways that accepted this operation
						{pinnedGateway
							? '. Your current gateway selection is different; Bazar will not restart the upload'
							: ''}
						.
					</p>
					<div className="mint-pending-actions">
						<a href={transactionExplorerUrl(asset.id)} target="_blank" rel="noreferrer">
							View transaction <Icon icon={ArrowUpRight} size="sm" />
						</a>
						<Button type="button" size="custom" disabled>
							View when available <Icon icon={InfinityIcon} size="sm" />
						</Button>
					</div>
					<MintTransactionReceipt
						entries={activity.transactionIds.map((transactionId, index) => ({
							label: fungible
								? index === activity.transactionIds.length - 1
									? 'Token process transaction'
									: 'Token logo transaction'
								: index === activity.transactionIds.length - 1
								? 'Asset transaction'
								: 'Artwork transaction',
							transactionId,
						}))}
					/>
				</div>
			</div>
		</section>
	);
}
