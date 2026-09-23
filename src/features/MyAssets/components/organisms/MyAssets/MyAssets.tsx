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
import { formatMessage } from 'helpers/i18n';
import { useAppErrorMessage } from 'hooks/useAppErrorMessage';
import { useMessages, usePlural } from 'providers/LanguageProvider';
import { useMarketProvider } from 'providers/MarketProvider';
import { useWallet } from 'providers/WalletProvider';

import { useWalletAssetDiscovery } from '../../../hooks/useWalletAssetDiscovery';
import { MY_ASSETS_MESSAGES } from '../../../messages';
import { type WalletAssetView, walletGroupResults } from '../../../model/wallet-assets';
import { walletResolutionIsWorking } from '../../../model/wallet-resolution';
import { WalletAssetGroup } from '../WalletAssetGroup';

export default function MyAssets(
	props: {
		address?: string;
		embedded?: boolean;
	} = {}
) {
	const language = useMessages(MY_ASSETS_MESSAGES);
	const errorMessage = useAppErrorMessage();
	const plural = usePlural();
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
				<Eyebrow>{language.myAssetsWalletEyebrow}</Eyebrow>
				<h1>{language.myAssetsTitle}</h1>
				<EmptyState title={language.myAssetsConnectTitle} action={<ConnectWalletButton />}>
					{language.myAssetsConnectDetail}
				</EmptyState>
			</section>
		);
	}
	if (market.loading && !market.collections.length) {
		if (props.embedded ?? false) {
			return (
				<section className={pageClassName}>
					<Loading label={language.myAssetsCollectionsLoading} />
				</section>
			);
		}
		return (
			<RouteState
				title={language.myAssetsTitle}
				backLabel={language.myAssetsBackAllCollections}
				eyebrow={language.myAssetsRouteEyebrow}
			>
				<Loading label={language.myAssetsCollectionsRouteLoading} />
			</RouteState>
		);
	}
	if (market.error) {
		return (
			<section className={pageClassName}>
				{!(props.embedded ?? false) ? (
					<>
						<Eyebrow>{language.myAssetsInventoryEyebrow}</Eyebrow>
						<h1>{language.myAssetsTitle}</h1>
					</>
				) : null}
				<ErrorPanel
					heading={language.myAssetsErrorHeading}
					message={market.error}
					retryAction={{ label: language.myAssetsRetry, onClick: market.retry }}
				/>
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
						<Eyebrow>{language.myAssetsInventoryEyebrow}</Eyebrow>
						<h1>{language.myAssetsTitle}</h1>
						<p>{language.myAssetsSubtitle}</p>
						<span className="gateway-pill">
							<Icon icon={Server} size="xs" /> {language.myAssetsGateway}{' '}
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
						{plural(language.myAssetsCandidatesUnavailable, status.failures, {
							failureMessage: discovery.failureMessage,
							failures: status.failures.toLocaleString(),
						})}
					</span>
					<Button className="with-icon" type="button" onClick={discovery.retryUnavailable} size="custom">
						<Icon icon={RefreshCw} size="sm" /> {language.myAssetsRetry}
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
			{status.error ? (
				<RetryNotice onRetry={discovery.retryDiscovery} retryLabel={language.myAssetsRetry}>
					{errorMessage(status.error)}
				</RetryNotice>
			) : null}
			{!working || discovery.results.length ? (
				<>
					<WalletAssetGroup
						title={language.myAssetsGroupTokens}
						results={tokenResults}
						address={walletAddress}
						kind="tokens"
						onViewChange={setTokenView}
						settled={status.phase === 'done'}
						view={tokenView}
					/>
					<WalletAssetGroup
						title={language.myAssetsGroupUniques}
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
					title={status.failures ? language.myAssetsEmptyUncheckedTitle : language.myAssetsEmptyTitle}
					action={
						status.failures ? (
							<Button
								className="with-icon retry-notice-action"
								type="button"
								onClick={discovery.retryUnavailable}
								size="custom"
							>
								<Icon icon={RefreshCw} size="sm" /> {language.myAssetsRetry}
							</Button>
						) : null
					}
				>
					{status.failures
						? formatMessage(language.myAssetsEmptyUncheckedDetail, {
								failureMessage: discovery.failureMessage,
								failures: status.failures,
								total: status.total,
						  })
						: language.myAssetsEmptyDetail}
				</EmptyState>
			) : null}
		</section>
	);
}
