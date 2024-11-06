import React from 'react';
import { connect } from '@othent/kms';
import * as Othent from '@othent/kms';

import { getProfileByWalletAddress, getVouch, readHandler } from 'api';

import { Modal } from 'components/molecules/Modal';
import { AO, AR_WALLETS, REDIRECTS, WALLET_PERMISSIONS } from 'helpers/config';
import { getARBalanceEndpoint } from 'helpers/endpoints';
import { ProfileHeaderType, VouchType, WalletEnum } from 'helpers/types';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

interface ArweaveContextState {
	wallets: { type: WalletEnum; logo: string }[];
	wallet: any;
	walletAddress: string | null;
	walletType: WalletEnum | null;
	arBalance: number | null;
	tokenBalances: { [address: string]: { profileBalance: number; walletBalance: number } } | null;
	toggleTokenBalanceUpdate: boolean;
	setToggleTokenBalanceUpdate: (toggleUpdate: boolean) => void;
	handleConnect: any;
	handleDisconnect: () => void;
	walletModalVisible: boolean;
	setWalletModalVisible: (open: boolean) => void;
	profile: ProfileHeaderType;
	toggleProfileUpdate: boolean;
	setToggleProfileUpdate: (toggleUpdate: boolean) => void;
	vouch: VouchType;
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
	tokenBalances: null,
	toggleTokenBalanceUpdate: false,
	setToggleTokenBalanceUpdate(_toggleUpdate: boolean) {},
	handleConnect() {},
	handleDisconnect() {},
	walletModalVisible: false,
	setWalletModalVisible(_open: boolean) {},
	profile: null,
	toggleProfileUpdate: false,
	setToggleProfileUpdate(_toggleUpdate: boolean) {},
	vouch: null,
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
					<img src={`${wallet.logo}`} alt={''} />
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
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const wallets = AR_WALLETS;

	const [wallet, setWallet] = React.useState<any>(null);
	const [walletType, setWalletType] = React.useState<WalletEnum | null>(null);
	const [walletModalVisible, setWalletModalVisible] = React.useState<boolean>(false);
	const [walletAddress, setWalletAddress] = React.useState<string | null>(null);
	const [vouch, setVouch] = React.useState<VouchType | null>(null);

	const [arBalance, setArBalance] = React.useState<number | null>(null);
	const [tokenBalances, setTokenBalances] = React.useState<{
		[address: string]: { profileBalance: number; walletBalance: number };
	} | null>({
		[AO.defaultToken]: null,
		[AO.pixl]: null,
	});
	const [toggleTokenBalanceUpdate, setToggleTokenBalanceUpdate] = React.useState<boolean>(false);

	const [profile, setProfile] = React.useState<ProfileHeaderType | null>(null);
	const [toggleProfileUpdate, setToggleProfileUpdate] = React.useState<boolean>(false);

	React.useEffect(() => {
		handleWallet();

		window.addEventListener('arweaveWalletLoaded', handleWallet);
		window.addEventListener('walletSwitch', handleWallet);

		return () => {
			window.removeEventListener('arweaveWalletLoaded', handleWallet);
			window.removeEventListener('walletSwitch', handleWallet);
		};
	}, []);

	React.useEffect(() => {
		(async function () {
			if (walletAddress) {
				try {
					setArBalance(Number(await getARBalance(walletAddress)));
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
					setProfile(await getProfileByWalletAddress({ address: walletAddress }));
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [wallet, walletAddress, walletType]);

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

	React.useEffect(() => {
		if (walletAddress && profile && profile.id) {
			const fetchDefaultTokenBalance = async () => {
				try {
					const defaultTokenBalance = await readHandler({
						processId: AO.defaultToken,
						action: 'Balance',
						tags: [{ name: 'Recipient', value: profile.id }],
					});
					const defaultTokenWalletBalance = await readHandler({
						processId: AO.defaultToken,
						action: 'Balance',
						tags: [{ name: 'Recipient', value: walletAddress }],
					});
					setTokenBalances((prevBalances) => ({
						...prevBalances,
						[AO.defaultToken]: {
							profileBalance: defaultTokenBalance || 0,
							walletBalance: defaultTokenWalletBalance || 0,
						},
					}));
				} catch (e) {
					console.error(e);
				}
			};

			fetchDefaultTokenBalance();
		} else {
			setTokenBalances({
				[AO.defaultToken]: { profileBalance: 0, walletBalance: 0 },
				[AO.pixl]: { profileBalance: 0, walletBalance: 0 },
			});
		}
	}, [walletAddress, profile, toggleTokenBalanceUpdate]);

	React.useEffect(() => {
		if (profile && profile.id) {
			const fetchPixlTokenBalance = async () => {
				try {
					const pixlTokenBalance = await readHandler({
						processId: AO.pixl,
						action: 'Balance',
						tags: [{ name: 'Recipient', value: profile.id }],
					});
					setTokenBalances((prevBalances) => ({
						...prevBalances,
						[AO.pixl]: { profileBalance: pixlTokenBalance || 0, walletBalance: 0 },
					}));
				} catch (e) {
					console.error(e);
				}
			};

			fetchPixlTokenBalance();
		}
	}, [profile, toggleTokenBalanceUpdate]);

	React.useEffect(() => {
		if (walletAddress && profile && profile.id) {
			const fetchVouch = async () => {
				try {
					const vouch = await getVouch({ wallet, address: walletAddress });
					setVouch(vouch);
				} catch (e) {
					console.error(e);
				}
			};

			fetchVouch();
		}
	}, [walletAddress, profile]);

	async function handleWallet() {
		if (localStorage.getItem('walletType')) {
			try {
				await handleConnect(localStorage.getItem('walletType') as any);
			} catch (e: any) {
				console.error(e);
			}
		}
	}

	async function handleConnect(walletType: WalletEnum.arConnect | WalletEnum.othent) {
		let walletObj: any = null;
		switch (walletType) {
			case WalletEnum.arConnect:
				handleArConnect();
				break;
			case WalletEnum.othent:
				handleOthent();
				break;
			default:
				if (window.arweaveWallet || walletType === WalletEnum.arConnect) {
					handleArConnect();
					break;
				}
		}
		setWalletModalVisible(false);
		return walletObj;
	}

	async function handleArConnect() {
		if (!walletAddress) {
			if (window.arweaveWallet) {
				try {
					await global.window?.arweaveWallet?.connect(WALLET_PERMISSIONS as any);
					setWalletAddress(await global.window.arweaveWallet.getActiveAddress());
					setWallet(window.arweaveWallet);
					setWalletType(WalletEnum.arConnect);
					setWalletModalVisible(false);
					localStorage.setItem('walletType', WalletEnum.arConnect);
				} catch (e: any) {
					console.error(e);
				}
			}
		}
	}

	async function handleOthent() {
		try {
			const othentConnection = await connect();
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
		return balance.toFixed(12);
	}

	return (
		<>
			{walletModalVisible && (
				<Modal header={language.connectWallet} handleClose={() => setWalletModalVisible(false)}>
					<WalletList handleConnect={handleConnect} />
				</Modal>
			)}
			<ARContext.Provider
				value={{
					wallet,
					walletAddress,
					walletType,
					arBalance,
					tokenBalances,
					toggleTokenBalanceUpdate,
					setToggleTokenBalanceUpdate,
					handleConnect,
					handleDisconnect,
					wallets,
					walletModalVisible,
					setWalletModalVisible,
					profile,
					toggleProfileUpdate,
					setToggleProfileUpdate,
					vouch,
				}}
			>
				{props.children}
			</ARContext.Provider>
		</>
	);
}
