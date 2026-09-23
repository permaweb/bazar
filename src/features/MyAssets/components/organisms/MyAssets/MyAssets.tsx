import React from 'react';
import { RefreshCw, Server } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Eyebrow } from 'components/atoms/Eyebrow';
import { Icon } from 'components/atoms/Icon';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { Tooltip } from 'components/atoms/Tooltip';
import { EmptyState } from 'components/molecules/EmptyState';
import { ErrorPanel } from 'components/molecules/ErrorPanel';
import { RetryNotice } from 'components/molecules/RetryNotice';
import { RouteState } from 'components/molecules/RouteState';
import { ConnectWalletButton } from 'components/organisms/ConnectWalletButton';
import { useMarketProvider } from 'providers/MarketProvider';
import { useWallet } from 'providers/WalletProvider';

import { useWalletAssetDiscovery } from '../../../hooks/useWalletAssetDiscovery';
import { type WalletAssetView, walletGroupResults } from '../../../model/wallet-assets';
import { walletResolutionIsWorking } from '../../../model/wallet-resolution';
import { WalletAssetGroup } from '../WalletAssetGroup';

export default function MyAssets(
	props: {
		address?: string;
		embedded?: boolean;
	} = {}
) {
	const market = useMarketProvider();
	const wallet = useWallet();
	const walletAddress = props.address ?? wallet.address ?? '';
	const pageClassName = `my-assets-page${props.embedded ?? false ? ' profile-assets' : ''}`;
	const [tokenView, setTokenView] = React.useState<WalletAssetView>('all');
	const [uniqueView, setUniqueView] = React.useState<WalletAssetView>('all');
	const discovery = useWalletAssetDiscovery(walletAddress);
	const status = discovery.status;

	if (!walletAddress) {
		return (
			<section className={pageClassName}>
				<Eyebrow>Your wallet</Eyebrow>
				<h1>My assets</h1>
				<EmptyState title="Connect a wallet to resolve its assets" action={<ConnectWalletButton />}>
					No signature is requested. Candidate history and live state are read-only.
				</EmptyState>
			</section>
		);
	}
	if (market.loading && !market.collections.length) {
		if (props.embedded ?? false) {
			return (
				<section className={pageClassName}>
					<Loading label="Reading supported asset collections from Arweave…" />
				</section>
			);
		}
		return (
			<RouteState title="My assets">
				<Loading label="Reading the supported asset collections from Arweave…" />
			</RouteState>
		);
	}
	if (market.error) {
		return (
			<section className={pageClassName}>
				{!(props.embedded ?? false) ? (
					<>
						<Eyebrow>Live wallet inventory</Eyebrow>
						<h1>My assets</h1>
					</>
				) : null}
				<ErrorPanel message={market.error} onRetry={market.retry} />
			</section>
		);
	}
	const tokenResults = walletGroupResults(discovery.results, walletAddress, 'tokens', tokenView);
	const uniqueResults = walletGroupResults(discovery.results, walletAddress, 'uniques', uniqueView);
	const working = walletResolutionIsWorking(status);
	return (
		<section className={pageClassName}>
			{!(props.embedded ?? false) ? (
				<div className="my-assets-heading">
					<div>
						<Eyebrow>Live wallet inventory</Eyebrow>
						<h1>My assets</h1>
						<p>Your assets, read from live Arweave state.</p>
						<span className="gateway-pill">
							<Icon icon={Server} size="xs" /> Gateway{' '}
							<Tooltip content={new URL(discovery.gateway).host}>
								{(tooltipId) => (
									<span aria-describedby={tooltipId} className="gateway-pill-host">
										{new URL(discovery.gateway).host}
									</span>
								)}
							</Tooltip>
						</span>
					</div>
				</div>
			) : null}
			{!status.error && status.phase === 'done' && status.failures && status.failures < status.total ? (
				<div className="my-assets-heading-status retry-notice">
					<span role="status">
						Compute hasn’t completed yet. Please try again. {status.failures.toLocaleString()}{' '}
						{status.failures === 1 ? 'candidate remains' : 'candidates remain'} unavailable. Resolved assets
						remain visible.
					</span>
					<Button className="with-icon" type="button" onClick={discovery.retryUnavailable} size="custom">
						<Icon icon={RefreshCw} size="sm" /> Retry
					</Button>
				</div>
			) : null}
			<LiveRegion as="p">{discovery.resolutionCopy.announcement}</LiveRegion>
			{working ? (
				<div className="my-assets-resolution-status" aria-busy="true">
					<div>
						<Loading label={discovery.resolutionCopy.heading} />
						<p>{discovery.resolutionCopy.announcement}</p>
					</div>
				</div>
			) : null}
			{status.error ? <RetryNotice onRetry={discovery.retryDiscovery} /> : null}
			{!working || discovery.results.length ? (
				<>
					<WalletAssetGroup
						title="Tokens"
						results={tokenResults}
						address={walletAddress}
						kind="tokens"
						onViewChange={setTokenView}
						settled={status.phase === 'done'}
						view={tokenView}
					/>
					<WalletAssetGroup
						title="Uniques"
						results={uniqueResults}
						address={walletAddress}
						kind="uniques"
						onViewChange={setUniqueView}
						settled={status.phase === 'done'}
						view={uniqueView}
					/>
				</>
			) : null}
			{status.phase === 'done' && !discovery.results.length ? (
				<EmptyState
					title={
						status.failures
							? 'Ownership could not be checked'
							: 'No indexed candidates currently resolve to this address'
					}
					action={
						status.failures ? (
							<Button
								className="with-icon retry-notice-action"
								type="button"
								onClick={discovery.retryUnavailable}
								size="custom"
							>
								<Icon icon={RefreshCw} size="sm" /> Retry
							</Button>
						) : null
					}
				>
					{status.failures
						? `Compute hasn’t completed yet. Please try again. ${status.failures} of ${status.total} candidates still need to be checked.`
						: 'Arweave GraphQL discovers candidates and can lag behind new transactions. Newly indexed candidates appear the next time this profile opens; live state remains authoritative for every candidate found.'}
				</EmptyState>
			) : null}
		</section>
	);
}
