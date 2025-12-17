import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import * as S from './styles';

export function EthWalletConnect() {
	return (
		<S.EthWalletWrapper>
			<ConnectButton label="Connect Ethereum Wallet" showBalance={false} />
		</S.EthWalletWrapper>
	);
}
