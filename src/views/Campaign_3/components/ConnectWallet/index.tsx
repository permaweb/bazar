import React from 'react';

import { useArweaveProvider } from 'providers/ArweaveProvider';

import { ConnectWalletButton } from '../../styles';

export const ConnectWallet: React.FC = () => {
	const arProvider = useArweaveProvider();
	const connected = !!arProvider.walletAddress;

	const handleConnect = () => {
		if (!connected) {
			arProvider.setWalletModalVisible(true);
		}
	};

	return (
		<ConnectWalletButton onClick={handleConnect}>
			{connected ? 'Wallet Connected' : 'Connect Wallet'}
		</ConnectWalletButton>
	);
};
