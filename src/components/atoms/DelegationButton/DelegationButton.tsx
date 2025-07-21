import React from 'react';
import styled from 'styled-components';

import { DelegationPanel } from 'components/organisms/DelegationPanel';
import { STYLING } from 'helpers/config';

interface DelegationButtonProps {
	walletAddress?: string;
}

const FloatingButton = styled.button`
	position: fixed;
	bottom: 20px;
	right: 20px;
	width: 60px;
	height: 60px;
	border-radius: 50%;
	background: ${({ theme }) => theme.colors.primary};
	color: white;
	border: none;
	cursor: pointer;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 24px;
	z-index: 999;
	transition: all 0.2s ease;

	&:hover {
		transform: scale(1.1);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}

	&:active {
		transform: scale(0.95);
	}

	@media (max-width: ${STYLING.cutoffs.secondary}) {
		right: 50%;
		transform: translateX(50%);
		bottom: 15px;
		width: 55px;
		height: 55px;
		font-size: 20px;
	}
`;

const PIXLIcon = styled.div`
	font-weight: bold;
	font-size: 18px;
`;

export function DelegationButton({ walletAddress }: DelegationButtonProps) {
	const [isPanelOpen, setIsPanelOpen] = React.useState(false);

	const handleClick = () => {
		if (!walletAddress) {
			// Show a notification to connect wallet
			console.log('Wallet not connected. Please connect your wallet first.');
			alert('Please connect your wallet to use PIXL delegation.');
			return;
		}
		setIsPanelOpen(true);
	};

	const handleClose = () => {
		setIsPanelOpen(false);
	};

	// Debug: Log wallet status
	console.log('DelegationButton: walletAddress =', walletAddress);

	return (
		<>
			<FloatingButton
				onClick={handleClick}
				title={walletAddress ? 'Delegate to PIXL' : 'Connect wallet to delegate'}
				style={{
					opacity: walletAddress ? 1 : 0.6,
					background: walletAddress ? undefined : '#ccc',
				}}
			>
				<PIXLIcon>P</PIXLIcon>
			</FloatingButton>
			<DelegationPanel walletAddress={walletAddress} isOpen={isPanelOpen} onClose={handleClose} />
		</>
	);
}
