import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { loadFungibleAssetView } from 'features/AssetDetail';
import { OperationActivityHost } from 'features/Operations';
import { registerFungibleAssetViewLoader } from 'helpers/asset-page-preload';
import { Header } from 'navigation/Header';
import { WalletConnectionDialog } from 'navigation/WalletConnectionDialog';
import { MarketProvider } from 'providers/MarketProvider';
import { OperationActivityProvider } from 'providers/OperationActivityProvider';
import { Asset } from 'views/Asset';
import { Collection } from 'views/Collection';
import { CollectionActivity } from 'views/CollectionActivity';
import { Create } from 'views/Create';
import { Dispatch } from 'views/Dispatch';
import { Home } from 'views/Home';
import { HomeRedirect } from 'views/HomeRedirect';
import { PendingAsset } from 'views/PendingAsset';
import { Profile } from 'views/Profile';

import { RouteFocus } from './RouteFocus';

registerFungibleAssetViewLoader(loadFungibleAssetView);

function handleSkipToContent(event: React.MouseEvent<HTMLAnchorElement>) {
	event.preventDefault();
	const main = document.getElementById('main-content');
	main?.focus();
	main?.scrollIntoView({ block: 'start' });
}

export function App() {
	return (
		<MarketProvider>
			<HashRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
				<OperationActivityProvider>
					<RouteFocus />
					<a className="skip-link" href="#main-content" onClick={handleSkipToContent}>
						Skip to marketplace content
					</a>
					<Header />
					<main aria-label="Marketplace content" className="max-view-wrapper" id="main-content" tabIndex={-1}>
						<Routes>
							<Route path="/" element={<HomeRedirect />} />
							<Route path="/discover" element={<Home />} />
							<Route path="/collections" element={<Home />} />
							<Route path="/activity" element={<Home />} />
							<Route path="/create" element={<Create />} />
							<Route path="/dispatch/:processId" element={<Dispatch />} />
							<Route path="/profile/:address" element={<Profile />} />
							<Route path="/collection/:collectionId" element={<Collection />} />
							<Route path="/collection/:collectionId/activity" element={<CollectionActivity />} />
							<Route path="/asset/:collectionId/:assetId/pending" element={<PendingAsset />} />
							<Route path="/asset/:collectionId/:assetId" element={<Asset />} />
							<Route path="*" element={<Navigate to="/" replace />} />
						</Routes>
					</main>
					<OperationActivityHost />
					<WalletConnectionDialog />
				</OperationActivityProvider>
			</HashRouter>
		</MarketProvider>
	);
}
