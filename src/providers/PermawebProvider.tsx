import React from 'react';
import PermawebLibs from '@permaweb/libs';

import Arweave from 'arweave';

import { Loader } from 'components/atoms/Loader';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { connect, createSigner } from 'helpers/aoconnect';
import { HB, STORAGE, TOKEN_REGISTRY } from 'helpers/config';
import { clearTokenStatusCache } from 'helpers/tokenValidation';

import { useArweaveProvider } from './ArweaveProvider';
import { useLanguageProvider } from './LanguageProvider';

interface PermawebContextState {
	libs: any;
	deps: any;
	profile: any;
	showProfileManager: boolean;
	setShowProfileManager: (toggle: boolean) => void;
	tokenBalances: {
		[address: string]: { profileBalance: string | number | null; walletBalance: string | number | null };
	} | null;
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
		[address: string]: { profileBalance: string | null; walletBalance: string | null };
	} | null>({});
	const [toggleTokenBalanceUpdate, setToggleTokenBalanceUpdate] = React.useState<boolean>(false);
	const [allTokensLoaded, setAllTokensLoaded] = React.useState<boolean>(false);

	// const isInitialMount = React.useRef(true);

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
			if (arProvider.walletAddress && libs) {
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
				const resolvedProfile = await resolveProfile();
				// Only update profile if we got a valid result, otherwise keep cached profile
				if (resolvedProfile) {
					setProfile(resolvedProfile);
				} else if (!cachedProfile) {
					// Only set to null if we have no cached profile and resolution failed
					setProfile(null);
				}
			}
		})();
	}, [arProvider.walletAddress, libs]);

	React.useEffect(() => {
		(async function () {
			if (arProvider.walletAddress && profilePending && libs) {
				const cachedProfile = getCachedProfile(arProvider.walletAddress);

				if (cachedProfile?.id) {
					try {
						const fetchedProfile = await libs.getProfileById(cachedProfile.id);

						if (fetchedProfile) {
							setProfile(fetchedProfile);
							cacheProfile(arProvider.walletAddress, fetchedProfile);
						}
					} catch (e: any) {
						if (process.env.NODE_ENV === 'development') {
							console.error('Error fetching profile:', e);
						}
					}

					setProfilePending(false);
				}
			}
		})();
	}, [arProvider.walletAddress, profilePending, libs]);

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
							return '0';
						}
						const result = BigInt(balanceValue).toString();
						return result;
					}

					// Otherwise, treat the response itself as the balance
					if (balanceResponse === '0' || balanceResponse === 0) {
						return '0';
					}
					const result = BigInt(balanceResponse).toString();
					return result;
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
						const normalized = normalizeBalance(resp);
						setTokenField(processId, field, normalized);
					} catch (err) {
						console.error('Balance fetch failed:', { processId, recipient, err });
						setTokenField(processId, field, '0');
					}
				};

				const setTokenField = (
					tokenId: string,
					field: 'walletBalance' | 'profileBalance',
					value?: string | null,
					_error?: unknown
				) => {
					setTokenBalances((prev) => {
						const existingToken: any = prev?.[tokenId] || {};
						const newToken: any = {
							walletBalance: existingToken.walletBalance ?? null,
							profileBalance: existingToken.profileBalance ?? null,
							[field]: value,
						};

						// If wallet balance just loaded and there's no profile, set profile balance to '0'
						if (field === 'walletBalance' && value !== null && value !== undefined && !profile?.id) {
							if (newToken.profileBalance === null || newToken.profileBalance === undefined) {
								newToken.profileBalance = '0';
							}
						}

						return {
							...prev,
							[tokenId]: newToken,
						};
					});
				};

				// Get all tokens sorted by priority
				const allTokens = Object.entries(TOKEN_REGISTRY).sort(([, a], [, b]) => a.priority - b.priority);

				// Only load top 3 initially, or all if allTokensLoaded is true
				const tokensToLoad = allTokensLoaded ? allTokens : allTokens.slice(0, 3);

				for (const [token] of tokensToLoad) {
					// Check if this token already has balance data loaded (not null and not undefined)
					const hasWalletBalance =
						tokenBalances?.[token]?.walletBalance !== undefined && tokenBalances?.[token]?.walletBalance !== null;
					const hasProfileBalance =
						tokenBalances?.[token]?.profileBalance !== undefined && tokenBalances?.[token]?.profileBalance !== null;

					// Handle wallet balance
					if (arProvider.walletAddress) {
						if (!hasWalletBalance) {
							setTokenField(token, 'walletBalance', null);
						}
						fetchBalance(token, arProvider.walletAddress, 'walletBalance');
					}

					// Handle profile balance
					if (profile?.id) {
						if (!hasProfileBalance) {
							setTokenField(token, 'profileBalance', null);
						}
						fetchBalance(token, profile.id, 'profileBalance');
					}
				}
			} catch (e) {
				if (process.env.NODE_ENV === 'development') {
					console.error('Error fetching token balances:', e);
				}
			}
		};

		fetchBalances();
	}, [arProvider.walletAddress, profile?.id, toggleTokenBalanceUpdate, allTokensLoaded]);

	async function resolveProfile(opts?: { hydrate?: boolean }) {
		try {
			// Ensure libs is initialized before trying to resolve profile
			if (!libs) {
				console.warn('PermawebProvider: libs not initialized, cannot resolve profile');
				return null;
			}

			let fetchedProfile: any;

			const cachedProfile = getCachedProfile(arProvider.walletAddress);

			let isLegacyProfile = false;

			if (cachedProfile?.id && !cachedProfile.isLegacyProfile) {
				fetchedProfile = await libs.getProfileById(cachedProfile.id, opts);
			} else {
				fetchedProfile = await libs.getProfileByWalletAddress(arProvider.walletAddress);
			}

			let profileToUse = { ...fetchedProfile, isLegacyProfile };

			// If we couldn't fetch a profile but have a cached one, use the cached one
			// This handles the case where the profile isn't hydrated yet on app-1
			if (!fetchedProfile?.id && cachedProfile) {
				profileToUse = cachedProfile;
			}

			// Only cache if we got a valid profile with an ID
			if (profileToUse?.id) {
				cacheProfile(arProvider.walletAddress, profileToUse);
			}

			return profileToUse;
		} catch (e: any) {
			if (process.env.NODE_ENV === 'development') {
				console.error('Error in resolveProfile:', e);
			}
			// Return cached profile if available, otherwise null
			const cachedProfile = getCachedProfile(arProvider.walletAddress);
			return cachedProfile || null;
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

		const setTokenField = (tokenId: string, field: 'walletBalance' | 'profileBalance', value?: number | null) => {
			setTokenBalances((prev) => ({
				...prev,
				[tokenId]: {
					...prev?.[tokenId],
					[field]: value,
				},
			}));
		};

		// Set loading state before fetching
		setTokenField(tokenId, 'walletBalance', null);
		setTokenField(tokenId, 'profileBalance', null);

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
