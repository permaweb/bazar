import React from 'react';
import { useSelector } from 'react-redux';
import { connect as othentConnect } from '@othent/kms';
import * as Othent from '@othent/kms';
import { useWallet as useAOsyncWallet } from '@vela-ventures/aosync-sdk-react';

import AOProfile, { ProfileType } from '@permaweb/aoprofile';

import { Modal } from 'components/molecules/Modal';
import { connect } from 'helpers/aoconnect';
import { AR_WALLETS, REDIRECTS, WALLET_PERMISSIONS } from 'helpers/config';
import { getARBalanceEndpoint } from 'helpers/endpoints';
import { WalletEnum } from 'helpers/types';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { useWayfinderProvider } from 'providers/WayfinderProvider';
import { RootState } from 'store';

import * as S from './styles';

interface ArweaveContextState {
	wallets: { type: WalletEnum; logo: string }[];
	wallet: any;
	walletAddress: string | null;
	walletType: WalletEnum | null;
	arBalance: number | null;
	// tokenBalances: { [address: string]: { profileBalance: number; walletBalance: number } } | null;
	// toggleTokenBalanceUpdate: boolean;
	// setToggleTokenBalanceUpdate: (toggleUpdate: boolean) => void;
	handleConnect: any;
	handleDisconnect: () => void;
	walletModalVisible: boolean;
	setWalletModalVisible: (open: boolean) => void;
	profile: ProfileType;
	toggleProfileUpdate: boolean;
	setToggleProfileUpdate: (toggleUpdate: boolean) => void;
	// vouch: VouchType;
}

interface ArweaveProviderProps {
	children: React.ReactNode;
}

const DEFAULT_CONTEXT = {
	wallets: [],
	wallet: null,
	walletAddress: null,
	walletType: null,
	arBalance: null,
	// tokenBalances: null,
	// toggleTokenBalanceUpdate: false,
	// setToggleTokenBalanceUpdate(_toggleUpdate: boolean) {},
	handleConnect() {},
	handleDisconnect() {},
	walletModalVisible: false,
	setWalletModalVisible(_open: boolean) {},
	profile: null,
	toggleProfileUpdate: false,
	setToggleProfileUpdate(_toggleUpdate: boolean) {},
	// vouch: null,
};

const ARContext = React.createContext<ArweaveContextState>(DEFAULT_CONTEXT);

export function useArweaveProvider(): ArweaveContextState {
	return React.useContext(ARContext);
}

function WalletList(props: { handleConnect: any }) {
	return (
		<S.WalletListContainer>
			{AR_WALLETS.map((wallet: any, index: number) => (
				<S.WalletListItem
					key={index}
					onClick={() => props.handleConnect(wallet.type)}
					className={'border-wrapper-alt2'}
				>
					<S.WalletItemImageWrapper>{wallet.logo && <img src={`${wallet.logo}`} alt={''} />}</S.WalletItemImageWrapper>
					<span>{wallet.type.charAt(0).toUpperCase() + wallet.type.slice(1)}</span>
				</S.WalletListItem>
			))}
			<S.WalletLink>
				<span>
					Don't have an Arweave Wallet? You can create one{' '}
					<a href={REDIRECTS.arconnect} target={'_blank'}>
						here.
					</a>
				</span>
			</S.WalletLink>
		</S.WalletListContainer>
	);
}

export function ArweaveProvider(props: ArweaveProviderProps) {
	const { getProfileByWalletAddress } = AOProfile.init({ ao: connect({ MODE: 'legacy' }) });
	const { isInitialized: wayfinderInitialized } = useWayfinderProvider();

	const profilesReducer = useSelector((state: RootState) => state.profilesReducer);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [wallet, setWallet] = React.useState<any>(null);
	const [walletType, setWalletType] = React.useState<WalletEnum | null>(null);
	const [walletModalVisible, setWalletModalVisible] = React.useState<boolean>(false);
	const [walletAddress, setWalletAddress] = React.useState<string | null>(null);
	// const [vouch, setVouch] = React.useState<VouchType | null>(null);

	const [arBalance, setArBalance] = React.useState<number | null>(null);
	// const [tokenBalances, setTokenBalances] = React.useState<{
	// 	[address: string]: { profileBalance: number; walletBalance: number };
	// } | null>({
	// 	[AO.defaultToken]: { profileBalance: null, walletBalance: null },
	// 	[AO.pixl]: { profileBalance: null, walletBalance: null },
	// });
	// const [toggleTokenBalanceUpdate, setToggleTokenBalanceUpdate] = React.useState<boolean>(false);

	const [profile, setProfile] = React.useState<ProfileType | null>(null);
	const [toggleProfileUpdate, setToggleProfileUpdate] = React.useState<boolean>(false);
	const {
		isConnected: isAOsyncConnected,
		connect: connectAOsync,
		getAddress: aosyncGetAddress,
		isSessionActive: aoSyncSessionActive,
	} = useAOsyncWallet();

	React.useEffect(() => {
		handleWallet();

		function handleWalletSwitch() {
			setProfile(null);
			handleWallet();
		}

		window.addEventListener('arweaveWalletLoaded', handleWallet);
		window.addEventListener('walletSwitch', handleWalletSwitch);

		return () => {
			window.removeEventListener('arweaveWalletLoaded', handleWallet);
			window.removeEventListener('walletSwitch', handleWalletSwitch);
		};
	}, []);

	React.useEffect(() => {
		(async function () {
			if (walletAddress) {
				try {
					// Use sync version for immediate response
					const balance = await getARBalance(walletAddress);
					setArBalance(balance);
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [walletAddress]);

	React.useEffect(() => {
		(async function () {
			if (wallet && walletAddress) {
				try {
					if (profilesReducer?.userProfiles?.[walletAddress]) {
						setProfile(profilesReducer.userProfiles[walletAddress]);
					} else {
						setProfile(await getProfileByWalletAddress({ address: walletAddress }));
					}
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [wallet, walletAddress, walletType, profilesReducer?.userProfiles]);

	React.useEffect(() => {
		(async function () {
			if (wallet && walletAddress) {
				const fetchProfileUntilChange = async () => {
					let changeDetected = false;
					let tries = 0;
					const maxTries = 10;

					while (!changeDetected && tries < maxTries) {
						try {
							const existingProfile = profile;
							const newProfile = await getProfileByWalletAddress({ address: walletAddress });

							if (JSON.stringify(existingProfile) !== JSON.stringify(newProfile)) {
								setProfile(newProfile);
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
	}, [toggleProfileUpdate]);

	// React.useEffect(() => {
	// 	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	// 	const fetchBalances = async () => {
	// 		if (!walletAddress || !profile?.id) return;

	// 		try {
	// 			const defaultTokenWalletBalance = await readHandler({
	// 				processId: AO.defaultToken,
	// 				action: 'Balance',
	// 				tags: [{ name: 'Recipient', value: walletAddress }],
	// 			});
	// 			await sleep(500);

	// 			const pixlTokenWalletBalance = await readHandler({
	// 				processId: AO.pixl,
	// 				action: 'Balance',
	// 				tags: [{ name: 'Recipient', value: walletAddress }],
	// 			});
	// 			await sleep(500);

	// 			const defaultTokenProfileBalance = await readHandler({
	// 				processId: AO.defaultToken,
	// 				action: 'Balance',
	// 				tags: [{ name: 'Recipient', value: profile.id }],
	// 			});
	// 			await sleep(500);

	// 			const pixlTokenProfileBalance = await readHandler({
	// 				processId: AO.pixl,
	// 				action: 'Balance',
	// 				tags: [{ name: 'Recipient', value: profile.id }],
	// 			});

	// 			setTokenBalances((prevBalances) => ({
	// 				...prevBalances,
	// 				[AO.defaultToken]: {
	// 					...prevBalances[AO.defaultToken],
	// 					walletBalance: defaultTokenWalletBalance ?? null,
	// 					profileBalance: defaultTokenProfileBalance ?? null,
	// 				},
	// 				[AO.pixl]: {
	// 					...prevBalances[AO.pixl],
	// 					walletBalance: pixlTokenWalletBalance ?? null,
	// 					profileBalance: pixlTokenProfileBalance ?? null,
	// 				},
	// 			}));
	// 		} catch (e) {
	// 			console.error(e);
	// 		}
	// 	};

	// 	fetchBalances();
	// }, [walletAddress, profile, toggleTokenBalanceUpdate]);

	// React.useEffect(() => {
	// 	if (walletAddress && profile && profile.id) {
	// 		const fetchVouch = async () => {
	// 			try {
	// 				const vouch = await getVouch({ wallet, address: walletAddress });
	// 				setVouch(vouch);
	// 			} catch (e) {
	// 				console.error(e);
	// 			}
	// 		};

	// 		fetchVouch();
	// 	}
	// }, [walletAddress, profile]);

	async function handleWallet() {
		if (localStorage.getItem('walletType')) {
			try {
				await handleConnect(localStorage.getItem('walletType') as any);
			} catch (e: any) {
				console.error(e);
			}
		}
	}

	async function handleConnect(walletType: WalletEnum.wander | WalletEnum.othent | WalletEnum.beacon) {
		let walletObj: any = null;
		switch (walletType) {
			case WalletEnum.wander:
				handleArConnect();
				break;
			case WalletEnum.othent:
				handleOthent();
				break;
			case WalletEnum.beacon:
				handleAOsyncConnect();
				break;
			default:
				if (window.arweaveWallet || walletType === WalletEnum.wander) {
					handleArConnect();
					break;
				}
		}
		setWalletModalVisible(false);
		return walletObj;
	}

	React.useEffect(() => {
		(async function () {
			await checkAOsyncConnection();
		})();
	}, [isAOsyncConnected]);

	async function checkAOsyncConnection() {
		if (localStorage.getItem('walletType') === WalletEnum.beacon && !isAOsyncConnected) {
			try {
				setWallet(null);
				setWalletAddress(null);
				setProfile(null);
				if (localStorage.getItem('walletType')) localStorage.removeItem('walletType');
			} catch (error) {}
		}
	}

	async function handleAOsyncConnect() {
		if (!walletAddress) {
			try {
				const localItem = localStorage.getItem('walletType');
				if (localItem !== WalletEnum.beacon) {
					await connectAOsync();
				}

				if (aoSyncSessionActive || localItem !== WalletEnum.beacon) {
					const walletAddress = await aosyncGetAddress();
					setWalletAddress(walletAddress);
					setWalletType(WalletEnum.beacon);
					setWalletModalVisible(false);
					localStorage.setItem('walletType', WalletEnum.beacon);
					setWallet(window.arweaveWallet);
				}
			} catch (e: any) {
				console.error(e);
			}
		}
	}

	async function handleArConnect() {
		if (!walletAddress) {
			if (window.arweaveWallet) {
				try {
					await global.window?.arweaveWallet?.connect(WALLET_PERMISSIONS as any);
					setWalletAddress(await global.window.arweaveWallet.getActiveAddress());
					setWallet(window.arweaveWallet);
					setWalletType(WalletEnum.wander);
					setWalletModalVisible(false);
					localStorage.setItem('walletType', WalletEnum.wander);
				} catch (e: any) {
					console.error(e);
				}
			}
		}
	}

	async function handleOthent() {
		try {
			const othentConnection = await othentConnect();
			const address = othentConnection.walletAddress;
			setWallet(Othent);
			setWalletAddress(address);
			setWalletType(WalletEnum.othent);
			localStorage.setItem('walletType', WalletEnum.othent);
		} catch (e: any) {
			console.error(e);
		}
	}

	async function handleDisconnect() {
		if (localStorage.getItem('walletType')) localStorage.removeItem('walletType');
		await global.window?.arweaveWallet?.disconnect();
		setWallet(null);
		setWalletAddress(null);
		setProfile(null);
	}

	async function getARBalance(walletAddress: string) {
		const rawBalance = await fetch(getARBalanceEndpoint(walletAddress));
		const jsonBalance = await rawBalance.json();
		const balance = jsonBalance / 1e12;
		return Number(balance.toFixed(12));
	}

	return (
		<>
			{walletModalVisible && (
				<Modal header={language.connectWallet} handleClose={() => setWalletModalVisible(false)}>
					<WalletList
						handleConnect={(walletType: WalletEnum.wander | WalletEnum.othent) => handleConnect(walletType)}
					/>
				</Modal>
			)}
			<ARContext.Provider
				value={{
					wallet,
					walletAddress,
					walletType,
					arBalance,
					// tokenBalances,
					// toggleTokenBalanceUpdate,
					// setToggleTokenBalanceUpdate,
					handleConnect,
					handleDisconnect,
					wallets: AR_WALLETS,
					walletModalVisible,
					setWalletModalVisible,
					profile,
					toggleProfileUpdate,
					setToggleProfileUpdate,
					// vouch,
				}}
			>
				{props.children}
			</ARContext.Provider>
		</>
	);
}
