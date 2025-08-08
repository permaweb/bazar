import React from 'react';
import PermawebLibs from '@permaweb/libs';

import Arweave from 'arweave';
import { connect, createSigner } from '@permaweb/aoconnect';
import AOProfile from '@permaweb/aoprofile';

import { Loader } from 'components/atoms/Loader';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { getArNSDataForAddress } from 'helpers/arns';
import { AO, STORAGE } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';

import { useArweaveProvider } from './ArweaveProvider';
import { useLanguageProvider } from './LanguageProvider';

interface PermawebContextState {
	libs: any;
	deps: any;
	profile: any;
	showProfileManager: boolean;
	setShowProfileManager: (toggle: boolean) => void;
	tokenBalances: { [address: string]: { profileBalance: number; walletBalance: number } } | null;
	toggleTokenBalanceUpdate: boolean;
	setToggleTokenBalanceUpdate: (toggleUpdate: boolean) => void;
	handleInitialProfileCache: (address: string, profileId: string) => void;
	refreshProfile: () => void;
	arnsPrimaryName?: string | null;
	arnsAvatarUrl?: string | null;
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
	const [arnsPrimaryName, setArnsPrimaryName] = React.useState<string | null>(null);
	const [arnsAvatarUrl, setArnsAvatarUrl] = React.useState<string | null>(null);

	const [tokenBalances, setTokenBalances] = React.useState<{
		[address: string]: { profileBalance: number; walletBalance: number };
	} | null>({
		[AO.defaultToken]: { profileBalance: null, walletBalance: null },
		[AO.pixl]: { profileBalance: null, walletBalance: null },
	});
	const [toggleTokenBalanceUpdate, setToggleTokenBalanceUpdate] = React.useState<boolean>(false);

	React.useEffect(() => {
		const deps = {
			ao: connect({ MODE: 'legacy' }),
			arweave: Arweave.init({}),
			signer: arProvider.wallet ? createSigner(arProvider.wallet) : null,
		};

		setLibs(PermawebLibs.init(deps));
		setDeps(deps);
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

	React.useEffect(() => {
		(async function () {
			if (arProvider.wallet && arProvider.walletAddress) {
				const fetchProfileUntilChange = async () => {
					let changeDetected = false;
					let tries = 0;
					const maxTries = 10;

					while (!changeDetected && tries < maxTries) {
						try {
							const existingProfile = profile;
							const newProfile = await resolveProfile();
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

				await fetchProfileUntilChange();
			}
		})();
	}, [arProvider.wallet, arProvider.walletAddress, refreshProfileTrigger]);

	React.useEffect(() => {
		const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

		const fetchBalances = async () => {
			if (!arProvider.walletAddress || !profile?.id) return;

			try {
				const defaultTokenWalletBalance = await libs.readProcess({
					processId: AO.defaultToken,
					action: 'Balance',
					tags: [{ name: 'Recipient', value: arProvider.walletAddress }],
				});
				await sleep(500);

				const pixlTokenWalletBalance = await libs.readProcess({
					processId: AO.pixl,
					action: 'Balance',
					tags: [{ name: 'Recipient', value: arProvider.walletAddress }],
				});
				await sleep(500);

				const defaultTokenProfileBalance = await libs.readProcess({
					processId: AO.defaultToken,
					action: 'Balance',
					tags: [{ name: 'Recipient', value: profile.id }],
				});
				await sleep(500);

				const pixlTokenProfileBalance = await libs.readProcess({
					processId: AO.pixl,
					action: 'Balance',
					tags: [{ name: 'Recipient', value: profile.id }],
				});

				setTokenBalances((prevBalances) => ({
					...prevBalances,
					[AO.defaultToken]: {
						...prevBalances[AO.defaultToken],
						walletBalance: defaultTokenWalletBalance ?? null,
						profileBalance: defaultTokenProfileBalance ?? null,
					},
					[AO.pixl]: {
						...prevBalances[AO.pixl],
						walletBalance: pixlTokenWalletBalance ?? null,
						profileBalance: pixlTokenProfileBalance ?? null,
					},
				}));
			} catch (e) {
				if (process.env.NODE_ENV === 'development') {
					console.error('Error fetching token balances:', e);
				}
			}
		};

		fetchBalances();
	}, [arProvider.walletAddress, profile, toggleTokenBalanceUpdate]);

	React.useEffect(() => {
		if (!arProvider.walletAddress) {
			setArnsPrimaryName(null);
			setArnsAvatarUrl(null);
			return;
		}

		(async function () {
			try {
				const arnsData = await getArNSDataForAddress(arProvider.walletAddress);

				console.log('PermawebProvider - ArNS data:', arnsData);

				setArnsPrimaryName(arnsData.primaryName);
				const avatarUrl = arnsData.logo ? getTxEndpoint(arnsData.logo) : null;
				console.log('PermawebProvider - Setting avatar URL:', avatarUrl);
				setArnsAvatarUrl(avatarUrl);
			} catch (err) {
				console.error('PermawebProvider - ArNS error:', err);
				setArnsPrimaryName(null);
				setArnsAvatarUrl(null);
			}
		})();
	}, [arProvider.walletAddress]);

	async function resolveProfile() {
		try {
			let fetchedProfile: any;

			const cachedProfile = getCachedProfile(arProvider.walletAddress);

			let isLegacyProfile = false;

			if (cachedProfile?.id && !cachedProfile.isLegacyProfile)
				fetchedProfile = await libs.getProfileById(cachedProfile.id);
			else {
				fetchedProfile = await libs.getProfileByWalletAddress(arProvider.walletAddress);

				if (!fetchedProfile?.id) {
					if (process.env.NODE_ENV === 'development') {
						console.log('Fetching legacy profile...');
					}
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
			return cached ? JSON.parse(cached) : null;
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
