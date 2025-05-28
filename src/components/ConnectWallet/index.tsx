import React from 'react';
import styled from 'styled-components';

const WalletButton = styled.button`
	background: rgba(15, 15, 15, 0.9);
	padding: 12px 25px;
	border: 2px solid #5af650;
	border-radius: 8px;
	color: #5af650;
	font-weight: bold;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		background: rgba(30, 30, 30, 0.9);
		transform: translateY(-2px);
	}
`;

export const ConnectWallet: React.FC = () => {
	return <WalletButton onClick={() => console.log('Connect wallet clicked')}>Connect Wallet</WalletButton>;
};
