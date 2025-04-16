import React from 'react';
import PermawebLibs, { ProfileType } from '@permaweb/libs';

import Arweave from 'arweave';
import { connect, createSigner } from '@permaweb/aoconnect';
import AOProfile from '@permaweb/aoprofile';

import { Loader } from 'components/atoms/Loader';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { AO, STORAGE } from 'helpers/config';

import { useArweaveProvider } from './ArweaveProvider';
import { useLanguageProvider } from './LanguageProvider';

interface PermawebContextState {
	libs: any;
	profile: ProfileType;
	showProfileManager: boolean;
	setShowProfileManager: (toggle: boolean) => void;
	tokenBalances: { [address: string]: { profileBalance: number; walletBalance: number } } | null;
	toggleTokenBalanceUpdate: boolean;
	setToggleTokenBalanceUpdate: (toggleUpdate: boolean) => void;
	handleInitialProfileCache: (address: string, profileId: string) => void;
	refreshProfile: () => void;
}

const DEFAULT_CONTEXT = {
	libs: null,
	profile: null,
	showProfileManager: false,
	setShowProfileManager(_toggle: boolean) {},
	tokenBalances: null,
	toggleTokenBalanceUpdate: false,
	setToggleTokenBalanceUpdate(_toggleUpdate: boolean) {},
	handleInitialProfileCache(_address: string, _profileId: string) {},
	refreshProfile() {},
};

const PermawebContext = React.createContext<PermawebContextState>(DEFAULT_CONTEXT);

export function usePermawebProvider(): PermawebContextState {
	return React.useContext(PermawebContext);
}

// TODO: Reset profile on arProvider.wallet change / disconnect
export function PermawebProvider(props: { children: React.ReactNode }) {
	const arProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [libs, setLibs] = React.useState<any>(null);
	const [profile, setProfile] = React.useState<ProfileType | null>(null);
	const [showProfileManager, setShowProfileManager] = React.useState<boolean>(false);
	const [refreshProfileTrigger, setRefreshProfileTrigger] = React.useState<boolean>(false);
	const [profilePending, setProfilePending] = React.useState<boolean>(false);

	const [tokenBalances, setTokenBalances] = React.useState<{
		[address: string]: { profileBalance: number; walletBalance: number };
	} | null>({
		[AO.defaultToken]: { profileBalance: null, walletBalance: null },
		[AO.pixl]: { profileBalance: null, walletBalance: null },
	});
	const [toggleTokenBalanceUpdate, setToggleTokenBalanceUpdate] = React.useState<boolean>(false);

	React.useEffect(() => {
		setLibs(
			PermawebLibs.init({
				ao: connect({ MODE: 'legacy' }),
				arweave: Arweave.init({}),
				signer: arProvider.wallet ? createSigner(arProvider.wallet) : null,
			})
		);
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
						console.error(e);
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
							} else {
								await new Promise((resolve) => setTimeout(resolve, 1000));
								tries++;
							}
						} catch (error) {
							console.error(error);
							break;
						}
					}

					if (!changeDetected) {
						console.warn(`No changes detected after ${maxTries} attempts`);
					}
				};

				await fetchProfileUntilChange();
			}
		})();
	}, [refreshProfileTrigger]);

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
				console.error(e);
			}
		};

		fetchBalances();
	}, [arProvider.walletAddress, profile, toggleTokenBalanceUpdate]);

	async function resolveProfile() {
		try {
			let fetchedProfile: any;

			const cachedProfile = getCachedProfile(arProvider.walletAddress);

			let isLegacyProfile = false;

			if (cachedProfile?.id) fetchedProfile = await libs.getProfileById(cachedProfile.id);
			else {
				fetchedProfile = await libs.getProfileByWalletAddress(arProvider.walletAddress);

				if (!fetchedProfile?.id) {
					await new Promise((r) => setTimeout(r, 1000));
					console.log('Fetching legacy profile...');
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
			console.error(e);
		}
	}

	function getCachedProfile(address: string) {
		const cached = localStorage.getItem(STORAGE.profile(address));
		return cached ? JSON.parse(cached) : null;
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
				profile: profile,
				showProfileManager,
				setShowProfileManager,
				tokenBalances,
				toggleTokenBalanceUpdate,
				setToggleTokenBalanceUpdate,
				handleInitialProfileCache: (address: string, profileId: string) =>
					handleInitialProfileCache(address, profileId),
				refreshProfile: () => setRefreshProfileTrigger((prev) => !prev),
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
