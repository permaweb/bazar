import React from 'react';
import PermawebLibs from '@permaweb/libs';

import Arweave from 'arweave';
import AOProfile from '@permaweb/aoprofile';

import { Loader } from 'components/atoms/Loader';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { connect, createSigner } from 'helpers/aoconnect';
import { AO, HB, STORAGE, TOKEN_REGISTRY } from 'helpers/config';
import { clearTokenStatusCache } from 'helpers/tokenValidation';

import { useArweaveProvider } from './ArweaveProvider';
import { useLanguageProvider } from './LanguageProvider';

interface PermawebContextState {
	libs: any;
	deps: any;
	profile: any;
	showProfileManager: boolean;
	setShowProfileManager: (toggle: boolean) => void;
	tokenBalances: { [address: string]: { profileBalance: string | number; walletBalance: string | number } } | null;
	toggleTokenBalanceUpdate: boolean;
	setToggleTokenBalanceUpdate: (toggleUpdate: boolean) => void;
	handleInitialProfileCache: (address: string, profileId: string) => void;
	refreshProfile: () => void;
	arnsPrimaryName?: string | null;
	arnsAvatarUrl?: string | null;
	loadAllTokens: () => void;
	allTokensLoaded: boolean;
	fetchTokenBalance: (tokenId: string) => Promise<void>;
}

const DEFAULT_CONTEXT = {
	libs: null,
	deps: null,
	profile: null,
	showProfileManager: false,
	setShowProfileManager(_toggle: boolean) {},
	tokenBalances: null,
	toggleTokenBalanceUpdate: false,
	setToggleTokenBalanceUpdate(_toggleUpdate: boolean) {},
	handleInitialProfileCache(_address: string, _profileId: string) {},
	refreshProfile() {},
	arnsPrimaryName: null,
	arnsAvatarUrl: null,
	loadAllTokens() {},
	allTokensLoaded: false,
	async fetchTokenBalance(_tokenId: string) {},
};

const PermawebContext = React.createContext<PermawebContextState>(DEFAULT_CONTEXT);

export function usePermawebProvider(): PermawebContextState {
	return React.useContext(PermawebContext);
}

export function PermawebProvider(props: { children: React.ReactNode }) {
	const arProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [libs, setLibs] = React.useState<any>(null);
	const [deps, setDeps] = React.useState<any>(null);
	const [profile, setProfile] = React.useState<any | null>(null);
	const [showProfileManager, setShowProfileManager] = React.useState<boolean>(false);
	const [refreshProfileTrigger, setRefreshProfileTrigger] = React.useState<boolean>(false);
	const [profilePending, setProfilePending] = React.useState<boolean>(false);
	const [arnsPrimaryName, _setArnsPrimaryName] = React.useState<string | null>(null);
	const [arnsAvatarUrl, _setArnsAvatarUrl] = React.useState<string | null>(null);

	const [tokenBalances, setTokenBalances] = React.useState<{
		[address: string]: { profileBalance: number; walletBalance: number };
	} | null>({});
	const [toggleTokenBalanceUpdate, setToggleTokenBalanceUpdate] = React.useState<boolean>(false);
	const [allTokensLoaded, setAllTokensLoaded] = React.useState<boolean>(false);

	const isInitialMount = React.useRef(true);

	React.useEffect(() => {
		const deps: any = {
			ao: connect({ MODE: 'legacy' }),
			arweave: Arweave.init({}),
			signer: arProvider.wallet ? createSigner(arProvider.wallet) : null,
			node: { url: HB.defaultNode },
		};

		setLibs(PermawebLibs.init(deps));
		setDeps(deps);

		// Clear token status cache to ensure fresh data
		clearTokenStatusCache();

		// Force refresh token balances
		setToggleTokenBalanceUpdate((prev) => !prev);
	}, [arProvider.wallet]);

	React.useEffect(() => {
		(async function () {
			if (arProvider.walletAddress) {
				const cachedProfile = getCachedProfile(arProvider.walletAddress);

				if (cachedProfile) {
					if (cachedProfile.status && cachedProfile.status === 'pending') {
						setProfilePending(true);
						setProfile(cachedProfile);
						return;
					}

					setProfile(cachedProfile);
				}
				await new Promise((r) => setTimeout(r, 2000));
				setProfile(await resolveProfile());
			}
		})();
	}, [arProvider.walletAddress]);

	React.useEffect(() => {
		(async function () {
			if (arProvider.walletAddress && profilePending) {
				const cachedProfile = getCachedProfile(arProvider.walletAddress);

				if (cachedProfile?.id) {
					try {
						const fetchedProfile = await libs.getProfileById(cachedProfile.id);

						setProfile(fetchedProfile);
						cacheProfile(arProvider.walletAddress, fetchedProfile);
					} catch (e: any) {
						if (process.env.NODE_ENV === 'development') {
							console.error('Error fetching profile:', e);
						}
					}

					setProfilePending(false);
				}
			}
		})();
	}, [arProvider.walletAddress, profilePending]);

	const fetchProfileUntilChange = async () => {
		if (!arProvider.wallet || !arProvider.walletAddress) return;

		let changeDetected = false;
		let tries = 0;
		const maxTries = 10;

		while (!changeDetected && tries < maxTries) {
			try {
				const existingProfile = profile;
				const newProfile = await resolveProfile({ hydrate: true });
				if (JSON.stringify(existingProfile) !== JSON.stringify(newProfile)) {
					setProfile(newProfile);
					cacheProfile(arProvider.walletAddress, newProfile);
					changeDetected = true;
				}
			} catch (e: any) {
				if (process.env.NODE_ENV === 'development') {
					console.error('Error in fetchProfileUntilChange:', e);
				}
			}

			tries++;
			await new Promise((r) => setTimeout(r, 2000));
		}
	};

	React.useEffect(() => {
		if (refreshProfileTrigger) {
			fetchProfileUntilChange();
		}
	}, [refreshProfileTrigger]);

	React.useEffect(() => {
		const fetchBalances = async () => {
			if (!arProvider.walletAddress || !profile?.id) return;

			try {
				// Helper function to normalize balance response
				const normalizeBalance = (balanceResponse: any) => {
					if (balanceResponse === null || balanceResponse === undefined) {
						return null;
					}

					// If response has Balance property, use that
					if (typeof balanceResponse === 'object' && balanceResponse.Balance !== undefined) {
						const balanceValue = balanceResponse.Balance;
						if (balanceValue === '0' || balanceValue === 0) {
							return 0;
						}
						return Number(balanceValue) || null;
					}

					// Otherwise, treat the response itself as the balance
					if (balanceResponse === '0' || balanceResponse === 0) {
						return 0;
					}
					return Number(balanceResponse) || null;
				};

				const fetchBalance = async (
					processId: string,
					recipient: string,
					field: 'walletBalance' | 'profileBalance'
				) => {
					try {
						const resp = await libs.readProcess({
							processId,
							action: 'Balance',
							tags: [{ name: 'Recipient', value: recipient }],
						});
						setTokenField(processId, field, normalizeBalance(resp));
					} catch (err) {
						console;
						console.error('Balance fetch failed:', { processId, recipient, err });
						setTokenField(processId, field, 0);
					}
				};

				const setTokenField = (
					tokenId: string,
					field: 'walletBalance' | 'profileBalance',
					value?: number,
					_error?: unknown
				) => {
					setTokenBalances((prev) => ({
						...prev,
						[tokenId]: {
							...prev[tokenId],
							[field]: value,
						},
					}));
				};

				// Get all tokens sorted by priority
				const allTokens = Object.entries(TOKEN_REGISTRY).sort(([, a], [, b]) => a.priority - b.priority);

				// Only load top 3 initially, or all if allTokensLoaded is true
				const tokensToLoad = allTokensLoaded ? allTokens : allTokens.slice(0, 3);

				for (const [token] of tokensToLoad) {
					fetchBalance(token, arProvider.walletAddress, 'walletBalance');
					fetchBalance(token, profile.id, 'profileBalance');
					await new Promise((r) => setTimeout(r, 200));
				}
			} catch (e) {
				if (process.env.NODE_ENV === 'development') {
					console.error('Error fetching token balances:', e);
				}
			}
		};

		fetchBalances();
	}, [arProvider.walletAddress, profile, toggleTokenBalanceUpdate, allTokensLoaded]);

	// React.useEffect(() => {
	// 	if (!arProvider.walletAddress) {
	// 		setArnsPrimaryName(null);
	// 		setArnsAvatarUrl(null);
	// 		return;
	// 	}

	// 	(async function () {
	// 		try {
	// 			const arnsData = await getArNSDataForAddress(arProvider.walletAddress);

	// 			setArnsPrimaryName(arnsData.primaryName);
	// 			const avatarUrl = arnsData.logo ? getTxEndpoint(arnsData.logo) : null;
	// 			setArnsAvatarUrl(avatarUrl);
	// 		} catch (err) {
	// 			console.error('PermawebProvider - ArNS error:', err);
	// 			setArnsPrimaryName(null);
	// 			setArnsAvatarUrl(null);
	// 		}
	// 	})();
	// }, [arProvider.walletAddress]);

	async function resolveProfile(opts?: { hydrate?: boolean }) {
		try {
			let fetchedProfile: any;

			const cachedProfile = getCachedProfile(arProvider.walletAddress);

			let isLegacyProfile = false;

			if (cachedProfile?.id && !cachedProfile.isLegacyProfile)
				fetchedProfile = await libs.getProfileById(cachedProfile.id, opts);
			else {
				fetchedProfile = await libs.getProfileByWalletAddress(arProvider.walletAddress);

				if (!fetchedProfile?.id) {
					isLegacyProfile = true;
					const aoProfile = AOProfile.init({ ao: connect({ MODE: 'legacy' }) });
					fetchedProfile = await aoProfile.getProfileByWalletAddress({ address: arProvider.walletAddress });
				}
			}

			let profileToUse = { ...fetchedProfile, isLegacyProfile };

			if (!fetchedProfile?.id && cachedProfile) profileToUse = cachedProfile;

			cacheProfile(arProvider.walletAddress, profileToUse);

			return profileToUse;
		} catch (e: any) {
			if (process.env.NODE_ENV === 'development') {
				console.error('Error in getProfile:', e);
			}
		}
	}

	function getCachedProfile(address: string) {
		try {
			const cached = localStorage.getItem(STORAGE.profile(address));
			try {
				return cached ? JSON.parse(cached) : null;
			} catch (error) {
				console.warn('Error parsing cached profile:', error);
				// Clear the corrupted cache
				localStorage.removeItem(STORAGE.profile(address));
				return null;
			}
		} catch (error) {
			console.warn('Error parsing cached profile:', error);
			// Clear the corrupted cache
			localStorage.removeItem(STORAGE.profile(address));
			return null;
		}
	}

	function cacheProfile(address: string, profileData: any) {
		localStorage.setItem(STORAGE.profile(address), JSON.stringify(profileData));
	}

	function handleInitialProfileCache(address: string, profileId: string) {
		cacheProfile(address, { id: profileId, status: 'pending' });
		setProfilePending(true);
	}

	function loadAllTokens() {
		setAllTokensLoaded(true);
	}

	async function fetchTokenBalance(tokenId: string) {
		if (!arProvider.walletAddress || !profile?.id || !libs) return;
		if (tokenBalances && tokenBalances[tokenId]) return; // Already loaded

		// Helper function to normalize balance response
		const normalizeBalance = (balanceResponse: any) => {
			if (balanceResponse === null || balanceResponse === undefined) {
				return null;
			}

			// If response has Balance property, use that
			if (typeof balanceResponse === 'object' && balanceResponse.Balance !== undefined) {
				const balanceValue = balanceResponse.Balance;
				if (balanceValue === '0' || balanceValue === 0) {
					return 0;
				}
				return Number(balanceValue) || null;
			}

			// Otherwise, treat the response itself as the balance
			if (balanceResponse === '0' || balanceResponse === 0) {
				return 0;
			}
			return Number(balanceResponse) || null;
		};

		const fetchBalance = async (processId: string, recipient: string, field: 'walletBalance' | 'profileBalance') => {
			try {
				const resp = await libs.readProcess({
					processId,
					action: 'Balance',
					tags: [{ name: 'Recipient', value: recipient }],
				});
				setTokenField(processId, field, normalizeBalance(resp));
			} catch (err) {
				console.error('Balance fetch failed:', { processId, recipient, err });
				setTokenField(processId, field, 0);
			}
		};

		const setTokenField = (tokenId: string, field: 'walletBalance' | 'profileBalance', value?: number) => {
			setTokenBalances((prev) => ({
				...prev,
				[tokenId]: {
					...prev?.[tokenId],
					profileBalance: null,
					[field]: value,
				},
			}));
		};

		// Fetch balance for the specific token
		await fetchBalance(tokenId, arProvider.walletAddress, 'walletBalance');
		await fetchBalance(tokenId, profile.id, 'profileBalance');
	}

	return (
		<PermawebContext.Provider
			value={{
				libs: libs,
				deps: deps,
				profile: profile,
				showProfileManager,
				setShowProfileManager,
				tokenBalances,
				toggleTokenBalanceUpdate,
				setToggleTokenBalanceUpdate,
				handleInitialProfileCache: (address: string, profileId: string) =>
					handleInitialProfileCache(address, profileId),
				refreshProfile: () => setRefreshProfileTrigger((prev) => !prev),
				arnsPrimaryName,
				arnsAvatarUrl,
				loadAllTokens,
				allTokensLoaded,
				fetchTokenBalance,
			}}
		>
			{props.children}
			{showProfileManager && (
				<Panel
					open={showProfileManager}
					header={profile && profile.id ? language.editProfile : `${language.createProfile}!`}
					handleClose={() => setShowProfileManager(false)}
					width={575}
					closeHandlerDisabled
				>
					<ProfileManage
						profile={profile && profile.id ? profile : null}
						handleClose={() => setShowProfileManager(false)}
						handleUpdate={null}
					/>
				</Panel>
			)}
			{profilePending && <Loader message={`${language.waitingForProfile}...`} />}
		</PermawebContext.Provider>
	);
}
