import React from 'react';

import { getCurrentProfile } from 'api';

import { Modal } from 'components/molecules/Modal';
import { AR_WALLETS, WALLET_PERMISSIONS } from 'helpers/config';
import { getARBalanceEndpoint } from 'helpers/endpoints';
import { ProfileType, WalletEnum } from 'helpers/types';
import Othent from 'helpers/wallet';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

interface ArweaveContextState {
	wallets: { type: WalletEnum; logo: string }[];
	wallet: any;
	walletAddress: string | null;
	walletType: WalletEnum | null;
	availableBalance: number | null;
	handleConnect: any;
	handleDisconnect: () => void;
	walletModalVisible: boolean;
	setWalletModalVisible: (open: boolean) => void;
	profile: any;
}

interface ArweaveProviderProps {
	children: React.ReactNode;
}

const DEFAULT_CONTEXT = {
	wallets: [],
	wallet: null,
	walletAddress: null,
	walletType: null,
	availableBalance: null,
	handleConnect() {},
	handleDisconnect() {},
	walletModalVisible: false,
	setWalletModalVisible(_open: boolean) {},
	profile: null,
};

const ARContext = React.createContext<ArweaveContextState>(DEFAULT_CONTEXT);

export function useArweaveProvider(): ArweaveContextState {
	return React.useContext(ARContext);
}

function WalletList(props: { handleConnect: any }) {
	return (
		<S.WalletListContainer>
			{AR_WALLETS.map((wallet: any, index: number) => (
				<S.WalletListItem key={index} onClick={() => props.handleConnect(wallet.type)}>
					<img src={`${wallet.logo}`} alt={''} />
					<span>{wallet.type.charAt(0).toUpperCase() + wallet.type.slice(1)}</span>
				</S.WalletListItem>
			))}
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
	const [availableBalance, setAvailableBalance] = React.useState<number | null>(null);
	const [profile, setProfile] = React.useState<ProfileType | null>(null);

	React.useEffect(() => {
		(async function () {
			if (localStorage.getItem('walletType')) {
				try {
					await handleConnect(localStorage.getItem('walletType') as any);
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, []);

	React.useEffect(() => {
		(async function () {
			if (walletAddress) {
				try {
					setAvailableBalance(await getARBalance(walletAddress));
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
					setProfile(await getCurrentProfile({ address: walletAddress }));
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [wallet, walletAddress, walletType]);

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
					alert(e);
				}
			} else {
				alert(language.connectorNotFound);
			}
		}
	}

	async function handleOthent() {
		Othent.init();
		await window.arweaveWallet.connect();
		setWallet(window.arweaveWallet);
		setWalletAddress(Othent.getUserInfo().walletAddress);
		setWalletType(WalletEnum.othent);
		localStorage.setItem('walletType', WalletEnum.othent);
	}

	async function handleDisconnect() {
		await global.window?.arweaveWallet?.disconnect();
		setWallet(null);
		setWalletAddress(null);
		setProfile(null);
		if (localStorage.getItem('walletType')) localStorage.removeItem('walletType');
	}

	async function getARBalance(walletAddress: string) {
		const rawBalance = await fetch(getARBalanceEndpoint(walletAddress));
		const jsonBalance = await rawBalance.json();
		return jsonBalance / 1e12;
	}

	return (
		<>
			{walletModalVisible && (
				<Modal header={language.connect} handleClose={() => setWalletModalVisible(false)}>
					<WalletList handleConnect={handleConnect} />
				</Modal>
			)}
			<ARContext.Provider
				value={{
					wallet,
					walletAddress,
					walletType,
					availableBalance,
					handleConnect,
					handleDisconnect,
					wallets,
					walletModalVisible,
					setWalletModalVisible,
					profile,
				}}
			>
				{props.children}
			</ARContext.Provider>
		</>
	);
}
