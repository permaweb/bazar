import React from 'react';
import { useSelector } from 'react-redux';
import { ANT, ARIO, getANTProcessesOwnedByWallet } from '@ar.io/sdk/web';

import ARNSMetadata from 'components/atoms/ARNSMetadata';
import { Button } from 'components/atoms/Button';
import { Loader } from 'components/atoms/Loader';
import { Panel } from 'components/molecules/Panel';
import { Tabs } from 'components/molecules/Tabs';
import { ANTInfo } from 'helpers/arnsFetch';
import { ASSETS } from 'helpers/config';
import { useARNSHydration } from 'hooks/useARNSHydration';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import * as S from './styles';

interface TabProps {
	label: string;
	icon: string;
}

interface LoadingState {
	[key: string]: boolean;
}

const BATCH_SIZE = 5;
const HYPERBEAM_NODES = [
	'https://router-1.forward.computer',
	'https://arweave.nyc', // Added fallback node
];
const HYPERBEAM_COOLDOWN = 60 * 1000; // Reduced to 1 minute
const MAX_RETRIES = 1; // Reduced to 1 retry
const INITIAL_RETRY_DELAY = 500; // Reduced to 500ms

// Cache for ANT info to avoid refetching
const antInfoCache = new Map<string, ANTInfo>();
const hyperbeamFailureCache = new Map<string, number>();
const processInitCache = new Map<string, number>();

// Simple cache load/save
const loadCache = () => {
	try {
		const cached = localStorage.getItem('arns_cache');
		if (cached) {
			const data = JSON.parse(cached);
			Object.entries(data).forEach(([key, value]) => {
				antInfoCache.set(key, value as ANTInfo);
			});
		}
	} catch (e) {
		console.warn('Cache load failed:', e);
	}
};

const saveCache = () => {
	try {
		const data = Object.fromEntries(antInfoCache.entries());
		localStorage.setItem('arns_cache', JSON.stringify(data));
	} catch (e) {
		console.warn('Cache save failed:', e);
	}
};

// Load cache on module init
loadCache();

// Helper function to calculate exponential backoff delay
const getBackoffDelay = (retryCount: number): number => {
	return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), 5000); // Reduced max delay
};

// Helper function to initialize process
const initializeProcess = async (processId: string, node: string, retryCount = 0): Promise<boolean> => {
	try {
		const lastInit = processInitCache.get(processId);
		if (lastInit && Date.now() - lastInit < 30 * 60 * 1000) {
			return true;
		}

		const initUrl = `${node}/${processId}~process@1.0/init`;
		console.log(`[HyperBEAM] Starting process initialization for ${processId} (attempt ${retryCount + 1})`);

		const message = {
			device: '~process@1.0',
			function: 'init',
			Scheduler_Device: '~scheduler@1.0',
			Execution_Device: 'stack@1.0',
			Execution_Stack: ['~scheduler@1.0', '~wasm64@1.0', '~json@1.0', '~relay@1.0'],
			Cache_Frequency: 60,
			Cache_Keys: ['state', 'results'],
		};

		const response = await fetch(initUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'CU-URL': node.includes('arweave.nyc') ? 'https://cu.arweave.nyc' : 'https://cu.forward.computer',
			},
			body: JSON.stringify(message),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.warn(`[HyperBEAM] Init failed for ${processId}:`, {
				status: response.status,
				statusText: response.statusText,
				error: errorText,
			});

			if (retryCount < MAX_RETRIES) {
				const delay = getBackoffDelay(retryCount);
				console.log(`[HyperBEAM] Retrying initialization in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				return initializeProcess(processId, node, retryCount + 1);
			}

			return false;
		}

		// Cache successful initialization
		processInitCache.set(processId, Date.now());
		return true;
	} catch (e) {
		console.error(`[HyperBEAM] Error during process initialization for ${processId}:`, e);

		if (retryCount < MAX_RETRIES) {
			const delay = getBackoffDelay(retryCount);
			console.log(`[HyperBEAM] Retrying initialization in ${delay}ms...`);
			await new Promise((resolve) => setTimeout(resolve, delay));
			return initializeProcess(processId, node, retryCount + 1);
		}

		return false;
	}
};

// Helper function to ensure tables are patched
const ensureTablesPatched = async (processId: string, node: string, retryCount = 0): Promise<boolean> => {
	try {
		console.log(`[HyperBEAM] Starting table patching process for ${processId} (attempt ${retryCount + 1})`);

		// First initialize the process
		const initialized = await initializeProcess(processId, node);
		if (!initialized) {
			console.warn(`[HyperBEAM] Process initialization failed for ${processId}, skipping table patch`);
			return false;
		}

		const patchUrl = `${node}/${processId}~process@1.0/patch`;
		console.log(`[HyperBEAM] Patching tables for ${processId} at ${patchUrl}`);

		// Format the message according to process device documentation
		const message = {
			device: '~process@1.0',
			function: 'patch',
			tables: {
				state: {
					Name: '',
					Ticker: '',
					Description: '',
					Keywords: [],
					Denomination: '',
					Owner: '',
					Logo: '',
					'Total-Supply': '',
					Handlers: [],
					HandlerNames: [],
				},
			},
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'CU-URL': 'https://cu.forward.computer',
			},
		};

		console.log(`[HyperBEAM] Patch request payload:`, JSON.stringify(message, null, 2));

		const response = await fetch(patchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify(message),
		});

		console.log(`[HyperBEAM] Patch response status: ${response.status}`);
		console.log(`[HyperBEAM] Patch response headers:`, Object.fromEntries(response.headers.entries()));

		if (!response.ok) {
			const errorText = await response.text();
			console.warn(`[HyperBEAM] Patch failed for ${processId}:`, {
				status: response.status,
				statusText: response.statusText,
				error: errorText,
				headers: Object.fromEntries(response.headers.entries()),
			});

			if (retryCount < MAX_RETRIES) {
				const delay = getBackoffDelay(retryCount);
				console.log(`[HyperBEAM] Retrying patch in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				return ensureTablesPatched(processId, node, retryCount + 1);
			}

			return false;
		}

		const responseData = await response.json();
		console.log(`[HyperBEAM] Patch successful for ${processId}:`, responseData);

		// Wait for patch to be processed
		console.log(`[HyperBEAM] Waiting for patch to be processed...`);
		await new Promise((resolve) => setTimeout(resolve, 2000));

		console.log(`[HyperBEAM] Table patching completed for ${processId}`);
		return true;
	} catch (e) {
		console.error(`[HyperBEAM] Error during table patching for ${processId}:`, e);

		if (retryCount < MAX_RETRIES) {
			const delay = getBackoffDelay(retryCount);
			console.log(`[HyperBEAM] Retrying patch in ${delay}ms...`);
			await new Promise((resolve) => setTimeout(resolve, delay));
			return ensureTablesPatched(processId, node, retryCount + 1);
		}

		return false;
	}
};

// Fetch ANT info using HyperBEAM with parallel node attempts
const fetchANTInfoWithHyperbeam = async (
	processId: string,
	name?: string,
	setLoadingState?: (loading: boolean) => void
): Promise<ANTInfo | null> => {
	try {
		if (antInfoCache.has(processId)) {
			const cachedInfo = antInfoCache.get(processId)!;
			return name ? { ...cachedInfo, name } : cachedInfo;
		}

		setLoadingState?.(true);

		const nodePromises = HYPERBEAM_NODES.map(async (node) => {
			try {
				// First ensure process is initialized
				const initUrl = `${node}/${processId}~process@1.0/init`;
				const initResponse = await fetch(initUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					body: JSON.stringify({
						device: '~process@1.0',
						function: 'init',
						Scheduler_Device: '~scheduler@1.0',
						Execution_Device: 'stack@1.0',
						Execution_Stack: ['~scheduler@1.0', '~wasm64@1.0', '~json@1.0', '~relay@1.0'],
						Cache_Frequency: 60,
						Cache_Keys: ['state', 'results'],
					}),
				});

				if (!initResponse.ok) return null;

				// Then patch the state tables
				const patchUrl = `${node}/${processId}~process@1.0/patch`;
				const patchResponse = await fetch(patchUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					body: JSON.stringify({
						device: '~process@1.0',
						function: 'patch',
						tables: {
							state: {
								Name: '',
								Ticker: '',
								Description: '',
								Keywords: [],
								Denomination: '',
								Owner: '',
								Logo: '',
								'Total-Supply': '',
								Handlers: [],
								HandlerNames: [],
							},
						},
					}),
				});

				if (!patchResponse.ok) return null;

				// Finally fetch the current state
				const stateUrl = `${node}/${processId}~process@1.0/now`;
				const stateResponse = await fetch(stateUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					body: JSON.stringify({
						device: '~process@1.0',
						function: 'now',
						tables: true,
						keys: ['state', 'results'],
					}),
				});

				if (!stateResponse.ok) return null;

				const data = await stateResponse.json();
				return data && typeof data === 'object' ? { node, data } : null;
			} catch (e) {
				return null;
			}
		});

		const results = await Promise.all(nodePromises);
		const successfulResult = results.find((r) => r !== null);

		if (!successfulResult) {
			return fetchANTInfoWithDryRun(processId, name, setLoadingState);
		}

		const antInfo = {
			...successfulResult.data,
			processId,
			name,
		} as ANTInfo;

		antInfoCache.set(processId, antInfo);
		saveCache();

		return antInfo;
	} catch (e) {
		return fetchANTInfoWithDryRun(processId, name, setLoadingState);
	} finally {
		setLoadingState?.(false);
	}
};

// Fallback method using dry-run
const fetchANTInfoWithDryRun = async (
	processId: string,
	name?: string,
	setLoadingState?: (loading: boolean) => void
): Promise<ANTInfo | null> => {
	try {
		console.log(`Fetching ANT info for ${processId} via dry-run`);
		setLoadingState?.(true);

		// Check cache first
		if (antInfoCache.has(processId)) {
			console.log(`Using cached ANT info for ${processId}`);
			const cachedInfo = antInfoCache.get(processId)!;
			return name ? { ...cachedInfo, name } : cachedInfo;
		}

		const ant = ANT.init({ processId });
		const info = await ant.getInfo();
		console.log(`Successfully fetched ANT info via dry-run for ${processId}:`, info);

		const antInfo = { ...info, processId, name } as ANTInfo;

		// Cache the result
		antInfoCache.set(processId, antInfo);

		return antInfo;
	} catch (e: any) {
		console.error(`Error fetching ANT info via dry-run for ${processId}:`, e);
		return null;
	} finally {
		setLoadingState?.(false);
	}
};

// TabPanel component for Tabs children
const TabPanel: React.FC<{ label: string; icon: string; children: React.ReactNode }> = ({ children }) => (
	<>{children}</>
);

export default function ARNSMarketplace() {
	const arweaveProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];
	const { allArns, myArns, loadingAll, loadingMine } = useARNSHydration();

	const [currentTab, setCurrentTab] = React.useState('all');
	const [loadingStates, setLoadingStates] = React.useState<Record<string, boolean>>({});

	const MARKET_TABS = [
		{
			label: 'All ARNS',
			icon: ASSETS.market,
			key: 'all',
		},
		{
			label: 'My ARNS',
			icon: ASSETS.wallet,
			key: 'mine',
		},
	];

	function getAssetStatus(token: ANTInfo) {
		const profileProcessId = arweaveProvider.profile?.id;
		if (!profileProcessId) return 'Unknown';
		if (token.Owner === profileProcessId) return 'In Profile';
		if (token.listed) return 'Listed';
		return 'In Wallet';
	}

	async function handleTransferToProfile(token: ANTInfo) {
		// ... existing transfer logic ...
	}

	async function handleListForSale(token: ANTInfo) {
		console.log('[ARNS] List for Sale button clicked for', token.processId);
		alert('List for Sale functionality coming soon!');
		// TODO: Implement actual listing logic/modal
	}

	function getCurrentTab(tabKey: string) {
		if (tabKey === 'all') {
			if (loadingAll)
				return (
					<S.LoadingWrapper>
						<Loader />
					</S.LoadingWrapper>
				);
			if (allArns.length === 0)
				return (
					<S.EmptyWrapper>
						<p>{language.noARNSFound}</p>
					</S.EmptyWrapper>
				);
			return (
				<S.ListWrapper>
					{allArns.map((token, index) => (
						<S.TokenCard key={index} className="border-wrapper-alt1">
							{loadingStates[token.processId] ? (
								<S.LoadingWrapper>
									<Loader />
								</S.LoadingWrapper>
							) : (
								<>
									<ARNSMetadata metadata={token} compact />
									<div style={{ marginTop: 8, marginBottom: 8 }}>
										<span>
											Status: <b>{getAssetStatus(token)}</b>
										</span>
									</div>
									<S.ActionsWrapper>
										<Button
											type="primary"
											label={language.viewDetails}
											handlePress={() => (window.location.href = `/#/asset/${token.processId}`)}
										/>
									</S.ActionsWrapper>
								</>
							)}
						</S.TokenCard>
					))}
				</S.ListWrapper>
			);
		} else if (tabKey === 'mine') {
			if (loadingMine)
				return (
					<S.LoadingWrapper>
						<Loader />
					</S.LoadingWrapper>
				);
			if (myArns.length === 0)
				return (
					<S.EmptyWrapper>
						<p>{language.noARNSFound}</p>
					</S.EmptyWrapper>
				);
			return (
				<S.ListWrapper>
					{myArns.map((token, index) => {
						const status = getAssetStatus(token);
						return (
							<S.TokenCard key={index} className="border-wrapper-alt1">
								{loadingStates[token.processId] ? (
									<S.LoadingWrapper>
										<Loader />
									</S.LoadingWrapper>
								) : (
									<>
										<ARNSMetadata metadata={token} compact />
										<div style={{ marginTop: 8, marginBottom: 8 }}>
											<span>
												Status: <b>{status}</b>
											</span>
										</div>
										<S.ActionsWrapper>
											<Button
												type="primary"
												label={language.viewDetails}
												handlePress={() => (window.location.href = `/#/asset/${token.processId}`)}
											/>
											{status === 'In Wallet' && (
												<Button
													type="alt1"
													label="Transfer to Profile"
													handlePress={() => handleTransferToProfile(token)}
												/>
											)}
											{status === 'In Profile' &&
												(() => {
													console.log('[ARNS] List for Sale button shown for', token.processId);
													return (
														<Button type="alt1" label="List for Sale" handlePress={() => handleListForSale(token)} />
													);
												})()}
										</S.ActionsWrapper>
									</>
								)}
							</S.TokenCard>
						);
					})}
				</S.ListWrapper>
			);
		}
		return null;
	}

	return (
		<S.Wrapper>
			<S.Header>
				<Tabs type="primary" onTabPropClick={setCurrentTab}>
					<TabPanel label="All ARNS" icon={ASSETS.market}>
						{getCurrentTab('all')}
					</TabPanel>
					<TabPanel label="My ARNS" icon={ASSETS.wallet}>
						{getCurrentTab('mine')}
					</TabPanel>
				</Tabs>
			</S.Header>
		</S.Wrapper>
	);
}
