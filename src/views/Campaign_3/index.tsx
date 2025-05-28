import React from 'react';

import { useArweaveProvider } from 'providers/ArweaveProvider';

import glasseaterImg from './glasseater.png';
import survivedAoImg from './survivedao.png';

// Consistent button style
function ConnectButton({
	onClick,
	disabled,
	children,
}: {
	onClick?: () => void;
	disabled?: boolean;
	children: React.ReactNode;
}) {
	return (
		<button
			style={{
				background: '#202416',
				color: '#fff',
				border: 'none',
				borderRadius: 75,
				padding: '16px 32px',
				fontWeight: 700,
				fontSize: 16,
				fontFamily: 'Inter',
				marginTop: 0,
				letterSpacing: -0.5,
				cursor: disabled ? 'default' : 'pointer',
				opacity: disabled ? 0.7 : 1,
				minWidth: 154,
				transition: 'opacity 0.2s',
			}}
			onClick={onClick}
			disabled={disabled}
		>
			{children}
		</button>
	);
}

// Reward card (background panel)
function RewardCard({
	image,
	title,
	collected,
	bgColor,
}: {
	image: string;
	title: string;
	collected: string;
	bgColor: string;
}) {
	return (
		<div
			style={{
				background: bgColor,
				borderRadius: 24,
				boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
				padding: 24,
				width: 360,
				maxWidth: '90vw',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				margin: 16,
				justifyContent: 'flex-start',
				aspectRatio: '1/1.2',
			}}
		>
			<div
				style={{
					width: '100%',
					aspectRatio: '1/1',
					background: '#eaeaea',
					borderRadius: 16,
					overflow: 'hidden',
					marginBottom: 20,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
			</div>
			<div
				style={{
					width: '100%',
					background: '#f1f1f1',
					borderRadius: 16,
					padding: '16px',
					marginTop: 8,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'flex-start',
				}}
			>
				<div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: '#262A1A', fontFamily: 'Inter' }}>
					{title}
				</div>
				<div style={{ color: '#262A1A', fontSize: 13, fontFamily: 'Inter', marginBottom: 12 }}>
					{collected} Collected
				</div>
				<ConnectButton disabled>Wallet Connected</ConnectButton>
			</div>
		</div>
	);
}

// Hero section (main panel/modal)
function HeroSection({ onConnect }: { onConnect: () => void }) {
	return (
		<div
			style={{
				position: 'relative',
				width: 503.5,
				height: 438,
				background: '#fff',
				borderRadius: 16,
				boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'flex-start',
				alignItems: 'flex-start',
				padding: 0,
				overflow: 'hidden',
			}}
		>
			{/* Text content */}
			<div
				style={{
					position: 'absolute',
					left: 32,
					top: 32,
					width: 423.5,
					height: 141,
					display: 'flex',
					flexDirection: 'column',
					zIndex: 2,
				}}
			>
				<span
					style={{
						fontSize: 24,
						fontWeight: 700,
						color: '#262A1A',
						fontFamily: 'Inter',
						letterSpacing: 0,
						marginBottom: 0,
						whiteSpace: 'nowrap',
					}}
				>
					Glasseaters: Collections
				</span>
				<span style={{ fontSize: 13, color: '#262A1A', fontFamily: 'Inter', marginTop: 24, whiteSpace: 'nowrap' }}>
					To start your journey, connect your wallet to check if you are eligible <br /> for "I Survived AO Testnet" or
					"Hyperbeam Glasseaters".
				</span>
				<span style={{ fontSize: 13, color: '#262A1A', fontFamily: 'Inter', marginTop: 24, whiteSpace: 'nowrap' }}>
					Make sure to read through the requirements and reach out on{' '}
					<b>
						AO <br /> discord
					</b>{' '}
					if you have any questions.
				</span>
			</div>
			{/* Connect Wallet button */}
			<div
				style={{
					position: 'absolute',
					left: 324.5,
					top: 343,
					width: 131,
					height: 47,
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					zIndex: 2,
				}}
			>
				<ConnectButton onClick={onConnect}>
					<span style={{ color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'Inter', letterSpacing: 0 }}>
						Connect Wallet
					</span>
				</ConnectButton>
			</div>
			{/* Image in bottom left, overlapping */}
			<img
				src={survivedAoImg}
				alt="I Survived AO Testnet"
				style={{ position: 'absolute', left: 0, top: 170, width: 279, height: 252, zIndex: 1 }}
			/>
		</div>
	);
}

export default function Campaign() {
	const arProvider = useArweaveProvider();
	const connected = !!arProvider.walletAddress;

	// Blur overlay for background cards
	const overlayStyle = {
		position: 'absolute' as const,
		left: 0,
		top: 0,
		width: '100%',
		height: '100%',
		background: 'rgba(220,220,220,0.55)',
		zIndex: 2,
		pointerEvents: 'none' as const,
		backdropFilter: 'blur(8px)',
		transition: 'opacity 0.3s',
		opacity: !connected ? 1 : 0,
		borderRadius: 32,
	};

	return (
		<div
			style={{
				minHeight: '100vh',
				width: '100vw',
				background: '#f5f7fa',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				position: 'relative',
				overflow: 'auto',
			}}
		>
			{/* Background cards row, always visible and centered */}
			<div
				style={{
					display: 'flex',
					flexDirection: 'row',
					justifyContent: 'center',
					alignItems: 'flex-start',
					width: '100%',
					marginTop: 60,
					position: 'relative',
					minHeight: 420,
				}}
			>
				{/* Blur overlay (visible when not connected) */}
				<div style={overlayStyle} />
				<RewardCard image={survivedAoImg} title="I Survived AO Testnet" collected="0/1984" bgColor="#f7f7f7" />
				<RewardCard image={glasseaterImg} title="Hyperbeam Glasseaters" collected="0/100" bgColor="#f3f5f2" />
				{/* HeroSection modal/dialog, only when not connected */}
				{!connected && (
					<div
						style={{
							position: 'absolute',
							left: '50%',
							top: '50%',
							transform: 'translate(-50%, -50%)',
							zIndex: 3,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							width: '100%',
						}}
					>
						<HeroSection onConnect={() => arProvider.setWalletModalVisible(true)} />
					</div>
				)}
			</div>
		</div>
	);
}
