import React, { useEffect, useState } from 'react';
import { createGlobalStyle } from 'styled-components';

import { GATEWAYS } from 'helpers/config';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';

import { ConnectWallet } from './components/ConnectWallet';
// Import images
import glasseaterImg from './glasseater.png';
import glasseatersVideo from './Glasseaters.mp4';
import survivedAoFallback from './I-Survived-Testnet_Fallback.avif';
import survivedAoVideo from './I-Survived-Testnet_Video.mp4';
import survivedAoImg from './survivedao.png';

// Add these TypeScript module declarations at the top of the file
declare module '*.mp4';
declare module '*.avif';

// Media URLs
const MEDIA_URLS = {
	glasseaterImg: '/campaign3/glasseater.png',
	survivedAoImg: '/campaign3/survivedao.png',
	survivedAoVideo: '/campaign3/I-Survived-Testnet_Video.mp4',
	survivedAoFallback: '/campaign3/I-Survived-Testnet_Fallback.avif',
	glasseatersVideo: '/campaign3/Glasseaters.mp4',
};

const Campaign3Responsive = createGlobalStyle`
	@media (max-width: 900px) {
		.campaign3-cards-row {
			flex-direction: column !important;
			align-items: center !important;
			gap: 32px;
		}
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
`;

// Loading state component
function LoadingState() {
	return (
		<div
			style={{
				width: 503.5,
				height: 438,
				background: '#fff',
				borderRadius: 16,
				boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				alignItems: 'center',
				padding: 0,
				overflow: 'hidden',
			}}
		>
			<div
				style={{
					background: '#F1F1F1',
					borderRadius: 12,
					margin: 8,
					padding: 16,
					height: 'calc(100% - 16px)',
					width: 'calc(100% - 16px)',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<div
					style={{
						width: 48,
						height: 48,
						border: '3px solid #000',
						borderTopColor: 'transparent',
						borderRadius: '50%',
						animation: 'spin 1s linear infinite',
						marginBottom: 24,
					}}
				/>
				<span
					style={{
						color: '#262A1A',
						fontSize: 18,
						fontWeight: 700,
						fontFamily: 'Inter',
						textAlign: 'center',
					}}
				>
					Checking Eligibility
				</span>
				<span
					style={{
						color: '#262A1A',
						fontSize: 14,
						fontFamily: 'Inter',
						textAlign: 'center',
						marginTop: 8,
						maxWidth: 300,
					}}
				>
					Please wait while we verify your wallet activity...
				</span>
			</div>
		</div>
	);
}

// Reward card (background panel)
function RewardCard({
	video,
	fallbackImage,
	image,
	title,
	collected,
	bgColor,
	cardBgColor,
	connected,
	overlayStyle,
	isLeft,
	isRight,
	requirements,
	guide,
}: {
	video?: string;
	fallbackImage?: string;
	image: string;
	title: string;
	collected: string;
	bgColor: string;
	cardBgColor: string;
	connected: boolean;
	overlayStyle: React.CSSProperties;
	isLeft?: boolean;
	isRight?: boolean;
	requirements?: { text: string; met: boolean }[];
	guide?: string[];
}) {
	const [videoError, setVideoError] = useState(false);

	// Adjust overlay style for seamless inner corners
	const customOverlayStyle = {
		...overlayStyle,
		borderTopRightRadius: isLeft ? 0 : overlayStyle.borderRadius,
		borderTopLeftRadius: isRight ? 0 : overlayStyle.borderRadius,
		borderBottomRightRadius: isLeft ? 0 : overlayStyle.borderRadius,
		borderBottomLeftRadius: isRight ? 0 : overlayStyle.borderRadius,
	};
	// Adjust cardBgColor container for seamless inner and bottom corners
	const cardBgRadius = `${isLeft ? '16px 0 0 16px' : isRight ? '0 16px 16px 0' : '16px'}`;
	return (
		<div
			style={{
				background: cardBgColor,
				borderRadius: cardBgRadius,
				width: 743.5,
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'flex-start',
				alignItems: 'center',
				margin: 0,
				position: 'relative',
			}}
		>
			{!connected && <div style={customOverlayStyle} />}
			<div
				style={{
					background: '#fff',
					borderRadius: 16,
					width: 503.5,
					marginTop: 100,
					marginBottom: 48,
					padding: '8px 0',
					display: 'flex',
					alignItems: 'center',
					flexDirection: 'column',
				}}
			>
				<div
					style={{
						width: 487.5,
						height: 487.5,
						borderRadius: 16,
						overflow: 'hidden',
						marginBottom: 24,
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center',
					}}
				>
					{video && !videoError ? (
						<video
							width="100%"
							height="100%"
							style={{
								objectFit: 'cover',
								borderRadius: 16,
								width: '100%',
								height: '100%',
							}}
							autoPlay
							loop
							muted
							playsInline
							controls={false}
							poster={fallbackImage || image}
							onError={() => setVideoError(true)}
						>
							<source src={video} type="video/mp4" />
						</video>
					) : (
						<img
							src={fallbackImage || image}
							alt={title}
							style={{
								width: '100%',
								height: '100%',
								objectFit: 'cover',
								borderRadius: 16,
							}}
						/>
					)}
				</div>
				<div
					style={{
						width: 486.5,
						height: 83,
						padding: '0 16px',
						borderRadius: 16,
						background: '#F1F1F1',
						display: 'flex',
						alignItems: 'center',
						marginBottom: 24,
					}}
				>
					<div style={{ width: 157, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
						<div style={{ color: '#202416', fontSize: 16, fontWeight: 700, fontFamily: 'Inter', whiteSpace: 'nowrap' }}>
							{title}
						</div>
						<div style={{ color: '#000', fontSize: 13, fontFamily: 'Inter', whiteSpace: 'nowrap' }}>
							{collected} Collected
						</div>
					</div>
					<div style={{ marginLeft: 'auto' }}>
						<ConnectWallet />
					</div>
				</div>
				{connected && requirements && (
					<RequirementsBox requirements={requirements} style={{ marginTop: 0, marginBottom: guide ? 16 : 2 }} />
				)}
				{connected && guide && <GuideBox steps={guide} style={{ marginTop: 16 }} />}
			</div>
		</div>
	);
}

// Hero section (main panel/modal)
function HeroSection({ onConnect, isVerifying }: { onConnect: () => void; isVerifying?: boolean }) {
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
			{/* Light gray inner area */}
			<div
				style={{
					background: '#F1F1F1',
					borderRadius: 12,
					margin: 8,
					padding: 16,
					height: 'calc(100% - 16px)',
					width: 'calc(100% - 16px)',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'flex-start',
					justifyContent: 'flex-start',
				}}
			>
				{/* Text content */}
				<div style={{ width: '100%' }}>
					<span
						style={{
							fontSize: 22,
							fontWeight: 700,
							color: '#262A1A',
							fontFamily: 'Inter',
							marginBottom: 12,
							display: 'block',
						}}
					>
						Glasseaters: Collections
					</span>
					<p style={{ fontSize: 15, color: '#262A1A', fontFamily: 'Inter', margin: 0, marginBottom: 16 }}>
						To start your journey, connect your wallet to check if you are eligible for <b>"I Survived AO Testnet"</b>{' '}
						or <b>"Hyperbeam Glasseaters"</b>.
					</p>
					<p style={{ fontSize: 15, color: '#262A1A', fontFamily: 'Inter', margin: 0, marginBottom: 16 }}>
						Make sure to read through the requirements and reach out on <b>AO discord</b> if you have any questions.
					</p>
				</div>
				{/* Image and button row */}
				<div
					style={{
						display: 'flex',
						flexDirection: 'row',
						alignItems: 'center',
						width: '100%',
						marginTop: 2,
						minHeight: 180,
					}}
				>
					<img
						src={survivedAoImg}
						alt="I Survived AO Testnet"
						style={{
							width: 180,
							height: 180,
							borderRadius: 12,
							marginRight: 16,
						}}
					/>
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'flex-end',
							height: 180,
							flex: 1,
						}}
					>
						<button
							onClick={onConnect}
							disabled={isVerifying}
							style={{
								background: '#000',
								color: '#fff',
								border: 'none',
								borderRadius: 8,
								padding: '12px 25px',
								fontSize: 14,
								fontWeight: 700,
								fontFamily: 'Inter',
								cursor: isVerifying ? 'default' : 'pointer',
								transition: 'all 200ms ease',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								minWidth: 179,
							}}
						>
							{isVerifying ? (
								<>
									<div
										style={{
											width: 18,
											height: 18,
											border: '2px solid #fff',
											borderTopColor: 'transparent',
											borderRadius: '50%',
											animation: 'spin 1s linear infinite',
											marginRight: 9,
										}}
									/>
									Checking Eligibility
								</>
							) : (
								'Connect Wallet'
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

// Requirements box component
function RequirementsBox({
	requirements,
	style = {},
}: {
	requirements: { text: string; met: boolean }[];
	style?: React.CSSProperties;
}) {
	return (
		<div
			style={{
				background: '#F1F1F1',
				borderRadius: 16,
				padding: 20,
				width: 486.5,
				display: 'flex',
				flexDirection: 'column',
				...style,
			}}
		>
			<div style={{ fontWeight: 700, fontSize: 16, color: '#202416', fontFamily: 'Inter', marginBottom: 8 }}>
				Requirements
			</div>
			<div style={{ fontSize: 13, color: '#808080', fontFamily: 'Inter', marginBottom: 12 }}>
				Only one required to claim
			</div>
			{requirements.map((req, idx) => (
				<div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
					<span
						style={{
							display: 'inline-block',
							width: 16,
							height: 16,
							borderRadius: 8,
							background: req.met ? '#5AF650' : '#E0E0E0',
							color: req.met ? '#fff' : '#B0B0B0',
							fontWeight: 700,
							fontSize: 12,
							textAlign: 'center',
							lineHeight: '16px',
							marginRight: 8,
						}}
					>
						{req.met ? '✓' : ''}
					</span>
					<span style={{ color: req.met ? '#202416' : '#808080' }}>{req.text}</span>
				</div>
			))}
		</div>
	);
}

// Guide box component (for right card)
function GuideBox({ steps, style = {} }: { steps: string[]; style?: React.CSSProperties }) {
	return (
		<div
			style={{
				background: '#F1F1F1',
				borderRadius: 16,
				padding: 20,
				width: 486.5,
				display: 'flex',
				flexDirection: 'column',
				...style,
			}}
		>
			<div style={{ fontWeight: 700, fontSize: 16, color: '#202416', fontFamily: 'Inter', marginBottom: 8 }}>Guide</div>
			<div style={{ fontSize: 13, color: '#808080', fontFamily: 'Inter', marginBottom: 12 }}>
				How to Create A New Device on Hyperbeam
			</div>
			<ul style={{ paddingLeft: 18, margin: 0 }}>
				{steps.map((step, idx) => (
					<li key={idx} style={{ color: '#202416', fontSize: 13, fontFamily: 'Inter', marginBottom: 8 }}>
						{step}
					</li>
				))}
			</ul>
		</div>
	);
}

export default function Campaign() {
	const { walletAddress, setWalletModalVisible } = useArweaveProvider();
	const { libs } = usePermawebProvider();
	const [isVerifying, setIsVerifying] = useState(false);
	const [verificationResults, setVerificationResults] = useState({
		hasBazarTransaction: false,
		hasBotegaSwap: false,
		hasPermaswapTransaction: false,
		hasAOProcess: false,
	});

	useEffect(() => {
		if (walletAddress && libs) {
			verifyWallet();
		}
	}, [walletAddress, libs]);

	const verifyWallet = async () => {
		if (!libs) return;

		setIsVerifying(true);
		try {
			// Check Bazar transactions
			const bazarData = await libs.getGQLData({
				gateway: GATEWAYS.arweave,
				owners: [walletAddress],
				tags: [
					{ name: 'Data-Protocol', values: ['ao'] },
					{ name: 'Type', values: ['Message'] },
					{ name: 'Variant', values: ['ao.TN.1'] },
					{ name: 'X-Order-Action', values: ['Create-Order'] },
				],
			});

			// Check Swap transactions
			const swapData = await libs.getGQLData({
				gateway: GATEWAYS.arweave,
				owners: [walletAddress],
				tags: [
					{ name: 'X-Action', values: ['Multi-Hop-Swap'] },
					{ name: 'Data-Protocol', values: ['ao'] },
					{ name: 'Type', values: ['Message'] },
					{ name: 'Variant', values: ['ao.TN.1'] },
				],
			});

			// Check AO Process
			const aoProcessData = await libs.getGQLData({
				gateway: GATEWAYS.arweave,
				owners: [walletAddress],
				tags: [
					{ name: 'Data-Protocol', values: ['ao'] },
					{ name: 'Type', values: ['Process'] },
				],
			});

			setVerificationResults({
				hasBazarTransaction: bazarData.data.length > 0,
				hasBotegaSwap: false, // TODO: Implement Botega swap check
				hasPermaswapTransaction: swapData.data.length > 0,
				hasAOProcess: aoProcessData.data.length > 0,
			});
		} catch (error) {
			console.error('Verification error:', error);
		} finally {
			setIsVerifying(false);
		}
	};

	useEffect(() => {
		document.body.classList.add('body-campaign-3');
		return () => {
			document.body.classList.remove('body-campaign-3');
		};
	}, []);

	// Blur overlay for background cards
	const overlayStyle = {
		position: 'absolute' as const,
		left: 0,
		top: 0,
		width: '100%',
		height: '100%',
		background: 'rgba(13, 12, 12, 0.47)',
		zIndex: 2,
		pointerEvents: 'none' as const,
		backdropFilter: 'blur(8px)',
		transition: 'opacity 0.3s',
		opacity: !walletAddress ? 1 : 0,
		borderRadius: 16,
	};

	return (
		<>
			<Campaign3Responsive />
			<div
				className="campaign3-main-wrapper"
				style={{
					minHeight: 'calc(100vh - 75px - 50px)',
					width: '100%',
					background: '#ffffff',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					position: 'relative',
					overflow: 'auto',
				}}
			>
				<div
					className="campaign3-cards-row"
					style={{
						display: 'flex',
						flexDirection: 'row',
						justifyContent: 'center',
						alignItems: 'stretch',
						width: '100%',
						position: 'relative',
						minHeight: 420,
					}}
				>
					<RewardCard
						video={MEDIA_URLS.survivedAoVideo}
						fallbackImage={MEDIA_URLS.survivedAoFallback}
						image={MEDIA_URLS.survivedAoImg}
						title="I Survived AO Testnet"
						collected="0/1984"
						bgColor="#f7f7f7"
						cardBgColor="#F1F1F1"
						connected={!!walletAddress}
						overlayStyle={overlayStyle}
						isLeft
						requirements={[
							{ text: 'Transacted on Bazar (Buy, or Sell)', met: verificationResults.hasBazarTransaction },
							{ text: 'Transacted on Botega (Buy, Sell, Agents, etc...)', met: verificationResults.hasBotegaSwap },
							{ text: 'Transacted on Permawasp (Swap)', met: verificationResults.hasPermaswapTransaction },
							{ text: 'Spawned an AO Process', met: verificationResults.hasAOProcess },
						]}
					/>
					<RewardCard
						video={MEDIA_URLS.glasseatersVideo}
						fallbackImage={MEDIA_URLS.glasseaterImg}
						image={MEDIA_URLS.glasseaterImg}
						title="Hyperbeam Glasseaters"
						collected="0/100"
						bgColor="#f3f5f2"
						cardBgColor="#CFCFCF"
						connected={!!walletAddress}
						overlayStyle={overlayStyle}
						isRight
						requirements={[{ text: 'Whitelisted & created a new device and merged PR', met: true }]}
						guide={[
							'Start by reading up on what a device is and how to start creating by diving into the Documentation.',
							'Make a fork of the repo, and start a new branch.',
							'Submit your Pull Request in the repo with your Discord ID notated in the PR submission for verification.',
							'Once your PR is approved by the AO core team head on over to the AO Discord. Head to #Glasseaters channel and post the link to your PR and your wallet address.',
							'Success! Once verified, allow some time to come back to claim your 1/1 glasseater.',
						]}
					/>

					{/* Show modal for both unconnected and verifying states */}
					{(!walletAddress || isVerifying) && (
						<div
							style={{
								position: 'fixed',
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
							<HeroSection onConnect={() => setWalletModalVisible(true)} isVerifying={isVerifying} />
						</div>
					)}
				</div>
			</div>
		</>
	);
}
