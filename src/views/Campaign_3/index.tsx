import React, { useEffect, useState } from 'react';
import { createGlobalStyle } from 'styled-components';

import { readHandler } from 'api';
import { message, results as getResults } from 'helpers/aoconnect';
import { createDataItemSigner } from 'helpers/aoconnect';
import { getTagValue } from 'helpers/utils';
import { HB } from 'helpers/config';

import { ASSETS, GATEWAYS } from 'helpers/config';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';

import { ConnectWallet } from './components/ConnectWallet';
// Import images
import survivedAoImg from './survivedao.png';

// Add these TypeScript module declarations at the top of the file
declare module '*.mp4';
declare module '*.avif';

// Constants for the I Survived AO Testnet campaign
// Using UNIFIED approach - Claim logic is in the atomic asset process itself!
const ATOMIC_ASSET_ID = 'rSehf8qeKDDDnrnOiwKT_NWSCFED_q5PouLpXMNHxl8'; // I Survived AO Testnet Asset (also handles claims)

// Media URLs
const MEDIA_URLS = {
	glasseaterImg: './campaign3/glasseater.png',
	survivedAoImg: './campaign3/survivedao.png',
	survivedAoVideo: './campaign3/I-Survived-Testnet_Video.mp4',
	survivedAoFallback: './campaign3/I-Survived-Testnet_Fallback.avif',
	glasseatersVideo: './campaign3/Glasseaters.mp4',
};

const Campaign3Responsive = createGlobalStyle`
	@media (max-width: 1120px) {
		.campaign3-cards-row {
			flex-direction: column !important;
			align-items: center !important;
			gap: 32px;
		}
	}

	@media (max-width: 543px) {
		.campaign3-outer-card {
			background: transparent !important;
		}
		.campaign3-inner-card {
			margin-top: 0 !important;
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

	.campaign3-cta:hover {
		opacity: 0.9;
		transition: transform 150ms ease-out;
	}

	.campaign3-cta:active {
		transform: scale(0.98);
		transition: transform 150ms ease-out;
	}
	.campaign3-cta:disabled {
		opacity: 0.5
		cursor: not-allowed;
	}
`;

// Loading state component
function LoadingState() {
	return (
		<div
			style={{
				width: '100%',
				maxWidth: 503.5,
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
	collectedSuffix = 'Collected',
	bgColor,
	cardBgColor,
	connected,
	overlayStyle,
	isLeft,
	isRight,
	requirements,
	requirementsSubheader,
	guide,
	guideSubheader,
	onClaim,
	onConnectWallet,
	showConnectWallet = true,
	showBlur = false,
	cta,
	claimStatus,
}: {
	video?: string;
	fallbackImage?: string;
	image: string;
	title: string;
	collected: string;
	collectedSuffix?: string;
	bgColor: string;
	cardBgColor: string;
	connected: boolean;
	overlayStyle: React.CSSProperties;
	isLeft?: boolean;
	isRight?: boolean;
	requirements?: { text: string; met: boolean; hideCheckbox?: boolean }[];
	requirementsSubheader?: string;
	guide?: (string | { text: string; href?: string } | { parts: (string | { text: string; href: string })[] })[];
	guideSubheader?: string;
	onClaim?: () => Promise<void>;
	showConnectWallet?: boolean;
	showBlur?: boolean;
	onConnectWallet?: () => void;
	cta?: { label: string; href: string; iconSrc?: string };
	claimStatus?: {
		hasClaimed: boolean;
		status: 'Available' | 'Already-Claimed' | 'Sold-Out' | 'Checking' | null;
		claimedAt?: string;
	};
}) {
	const [videoError, setVideoError] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleClaim = async () => {
		if (!onClaim) return;
		setIsLoading(true);
		setError(null);
		try {
			await onClaim();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to claim reward');
		} finally {
			setIsLoading(false);
		}
	};

	const atLeastOneRequirementMet = requirements?.some((req) => req.met) || false;

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
			className="campaign3-outer-card"
			style={{
				background: cardBgColor,
				borderRadius: cardBgRadius,
				width: '100%',
				maxWidth: 743.5,
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'flex-start',
				alignItems: 'center',
				margin: 0,
				position: 'relative',
			}}
		>
			{!connected && showBlur && <div style={customOverlayStyle} />}
			<div
				className="campaign3-inner-card"
				style={{
					background: '#fff',
					borderRadius: 16,
					width: '100%',
					maxWidth: 503.5,
					marginTop: 100,
					marginBottom: 48,
					padding: '8px 0',
					display: 'flex',
					alignItems: 'center',
					flexDirection: 'column',
					gap: 12,
				}}
			>
				<div
					style={{
						width: '100%',
						maxWidth: 487.5,
						aspectRatio: '1/1',
						borderRadius: 16,
						overflow: 'hidden',
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
								borderRadius: 8,
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
								borderRadius: 8,
							}}
						/>
					)}
				</div>
				<div
					style={{
						width: '100%',
						maxWidth: 486.5,
						boxSizing: 'border-box',
						height: 83,
						padding: '0 16px',
						borderRadius: 8,
						background: '#F1F1F1',
						display: 'flex',
						alignItems: 'center',
					}}
				>
					<div style={{ width: 157, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
						<div style={{ color: '#202416', fontSize: 16, fontWeight: 700, fontFamily: 'Inter', whiteSpace: 'nowrap' }}>
							{title}
						</div>
						<div style={{ color: '#000', fontSize: 13, fontFamily: 'Inter', whiteSpace: 'nowrap' }}>
							{collected}
							{collectedSuffix ? ` ${collectedSuffix}` : ''}
						</div>
					</div>
					{showConnectWallet && (
						<div style={{ marginLeft: 'auto' }}>
							<ConnectWallet />
						</div>
					)}
				</div>
				{requirements && (
					<RequirementsBox
						requirements={requirements}
						subheaderText={requirementsSubheader}
						style={{ marginTop: 0, marginBottom: guide ? 0 : 2 }}
					/>
				)}
				{guide && <GuideBox steps={guide} subheaderText={guideSubheader} style={{ marginTop: 0 }} />}
				{!connected && !cta && onClaim && onConnectWallet && (
					<button
						onClick={onConnectWallet}
						style={{
							width: 'calc(100% - 16px)',
							padding: '20px 12px',
							border: 'none',
							borderRadius: 8,
							background: '#1a1a1a',
							color: '#FFFFFF',
							fontSize: 14,
							cursor: 'pointer',
							transition: 'all 80ms ease-out',
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							gap: 8,
							margin: '0px 0px 0px 0px',
						}}
					>
						Connect Wallet
					</button>
				)}
				{connected && !cta && atLeastOneRequirementMet && onClaim && (
					<>
						{claimStatus?.status === 'Already-Claimed' ? (
							<div
								style={{
									width: 'calc(100% - 16px)',
									padding: '20px 12px',
									border: 'none',
									borderRadius: 8,
									background: '#4A5568',
									color: '#FFFFFF',
									fontSize: 14,
									textAlign: 'center',
									margin: '0px 0px 0px 0px',
								}}
							>
								✓ Already Claimed
							</div>
						) : claimStatus?.status === 'Checking' ? (
							<div
								style={{
									width: 'calc(100% - 16px)',
									padding: '20px 12px',
									border: 'none',
									borderRadius: 8,
									background: '#1a1a1a',
									color: '#FFFFFF',
									fontSize: 14,
									textAlign: 'center',
									margin: '0px 0px 0px 0px',
									opacity: 0.7,
								}}
							>
								Checking claim status...
							</div>
						) : (
							<button
								className={'campaign3-cta'}
								onClick={handleClaim}
								disabled={isLoading || claimStatus?.hasClaimed}
								style={{
									width: 'calc(100% - 16px)',
									padding: '20px 12px',
									border: 'none',
									borderRadius: 8,
									background: '#1a1a1a',
									color: '#FFFFFF',
									fontSize: 14,
									cursor: isLoading || claimStatus?.hasClaimed ? 'not-allowed' : 'pointer',
									opacity: isLoading || claimStatus?.hasClaimed ? 0.5 : 1,
									transition: 'all 80ms ease-out',
									display: 'flex',
									justifyContent: 'center',
									alignItems: 'center',
									gap: 8,
									margin: '0px 0px 0px 0px',
								}}
							>
								{isLoading ? (
									<>
										<div
											style={{
												width: 16,
												height: 16,
												border: '2px solid #ffffff',
												borderTopColor: 'transparent',
												borderRadius: '50%',
												animation: 'spin 1s linear infinite',
											}}
										/>
										Claiming...
									</>
								) : (
									'Claim Reward'
								)}
							</button>
						)}
					</>
				)}
				{cta && (
					<a
						className={'campaign3-cta'}
						href={cta.href}
						target={'_blank'}
						rel={'noreferrer'}
						style={{
							width: 'calc(100% - 16px)',
							padding: '20px 12px',
							border: 'none',
							borderRadius: 8,
							background: '#1a1a1a',
							color: '#FFFFFF',
							fontSize: 14,
							textDecoration: 'none',
							textAlign: 'center',
							transition: 'all 80ms ease-out',
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							gap: 8,
							margin: '0px 0px 0px 0px',
						}}
					>
						{cta.iconSrc && (
							<img
								src={cta.iconSrc}
								alt={cta.label}
								style={{ width: 16, height: 16, marginRight: 8, filter: 'invert(1)' }}
							/>
						)}
						{cta.label}
					</a>
				)}
				{error && (
					<div
						style={{
							color: '#E53E3E',
							fontSize: 14,
							fontFamily: 'Inter',
							textAlign: 'center',
							marginTop: 8,
							padding: '0 16px',
						}}
					>
						{error}
					</div>
				)}
			</div>
		</div>
	);
}

// Hero section (main panel/modal)
function HeroSection({
	onConnect,
	onViewCampaign,
	isVerifying,
	isCheckingEligibility,
}: {
	onConnect: () => void;
	onViewCampaign: () => void;
	isVerifying?: boolean;
	isCheckingEligibility?: boolean;
}) {
	return (
		<div
			style={{
				position: 'relative',
				width: 503.5,
				height: 438,
				background: '#fff',
				borderRadius: 8,
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
					borderRadius: 8,
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
						AO Testnet Legends
					</span>
					<p style={{ fontSize: 13, color: '#262A1A', fontFamily: 'Inter', margin: 0, marginBottom: 16 }}>
						To start your journey, connect your wallet to check if you are eligible for <b>"I Survived AO Testnet"</b>{' '}
						or view the requirements and guide for <b>"Hyperbeam Glasseaters"</b>.
					</p>
					<p style={{ fontSize: 13, color: '#262A1A', fontFamily: 'Inter', margin: 0, marginBottom: 16 }}>
						Make sure to reach out on <b>AO discord</b> if you have any questions.
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
							width: 260,
							borderRadius: 8,
							marginRight: 4,
						}}
					/>
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'flex-end',
							height: 180,
							flex: 1,
							gap: 12,
						}}
					>
						<button
							onClick={onConnect}
							disabled={isVerifying}
							style={{
								background: '#1a1a1a',
								color: '#fff',
								border: 'none',
								borderRadius: 8,
								padding: '16px 0px',
								fontSize: 14,
								fontWeight: 500,
								fontFamily: 'Inter',
								cursor: isVerifying ? 'default' : 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								boxSizing: 'border-box',
								height: 48,
								opacity: 1,
							}}
							onMouseEnter={(e) => {
								if (!isVerifying) {
									e.currentTarget.style.opacity = '0.8';
								}
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.opacity = '1';
							}}
						>
							{isVerifying || isCheckingEligibility ? (
								<>
									<div
										style={{
											width: 16,
											height: 16,
											border: '2px solid #fff',
											borderTopColor: 'transparent',
											borderRadius: '50%',
											animation: 'spin 1s linear infinite',
											marginRight: 16,
										}}
									/>
									Checking Eligibility
								</>
							) : (
								'Connect Wallet'
							)}
						</button>
						<button
							onClick={onViewCampaign}
							style={{
								background: 'transparent',
								color: '#1a1a1a',
								border: '1px solid #1a1a1a',
								borderRadius: 8,
								padding: '16px 0px',
								fontSize: 14,
								fontWeight: 500,
								fontFamily: 'Inter',
								cursor: 'pointer',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								textDecoration: 'none',
								boxSizing: 'border-box',
								height: 48,
								opacity: 1,
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.opacity = '0.8';
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.opacity = '1';
							}}
						>
							View Campaign
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
	subheaderText = 'Two or more requirements must be met to claim',
	style = {},
}: {
	requirements: { text: string; met: boolean; hideCheckbox?: boolean }[];
	subheaderText?: string;
	style?: React.CSSProperties;
}) {
	return (
		<div
			style={{
				background: '#F1F1F1',
				borderRadius: 8,
				padding: 20,
				width: '100%',
				maxWidth: 486.5,
				boxSizing: 'border-box',
				display: 'flex',
				flexDirection: 'column',
				...style,
			}}
		>
			<div style={{ fontWeight: 700, fontSize: 16, color: '#202416', fontFamily: 'Inter', marginBottom: 0 }}>
				Requirements
			</div>
			<div style={{ fontSize: 13, color: '#808080', fontFamily: 'Inter', marginBottom: 12, marginTop: 0 }}>
				{subheaderText}
			</div>
			{requirements.map((req, idx) => (
				<div
					key={idx}
					style={{
						display: 'flex',
						alignItems: req.hideCheckbox ? 'flex-start' : 'center',
						gap: 10,
						marginBottom: idx === requirements.length - 1 ? 0 : 16,
					}}
				>
					{req.hideCheckbox ? (
						<span
							style={{ width: 6, height: 6, background: '#202416', borderRadius: 2, marginTop: 7, flex: '0 0 auto' }}
						/>
					) : (
						<span
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								justifyContent: 'center',
								width: 18,
								height: 18,
								borderRadius: 6,
								background: req.met ? '#D6EACF' : '#EDEDED',
								color: req.met ? '#22C55E' : '#B0B0B0',
								border: req.met ? '1px solid rgba(167, 243, 208, 0)' : '1px solid #E0E0E0',
								fontWeight: 700,
								fontSize: 13,
								textAlign: 'center',
								lineHeight: '18px',
								flex: '0 0 auto',
							}}
						>
							{req.met ? (
								<svg width={11} height={8} viewBox={'0 0 11 8'} fill={'none'} xmlns={'http://www.w3.org/2000/svg'}>
									<path
										d={'M1 4.375L3.73913 7L10 1'}
										stroke={'#2CBB00'}
										strokeWidth={2}
										strokeLinecap={'round'}
										strokeLinejoin={'round'}
									/>
								</svg>
							) : null}
						</span>
					)}
					<span
						style={{
							color: req.hideCheckbox ? '#000' : req.met ? '#202416' : '#808080',
							fontSize: 13,
						}}
					>
						{req.text}
					</span>
				</div>
			))}
		</div>
	);
}

// Guide box component (for right card)
function GuideBox({
	steps,
	style = {},
	subheaderText = 'Additional information on how to particpate',
}: {
	steps: (string | { text: string; href?: string } | { parts: (string | { text: string; href: string })[] })[];
	style?: React.CSSProperties;
	subheaderText?: string;
}) {
	const renderStepContent = (
		step: string | { text: string; href?: string } | { parts: (string | { text: string; href: string })[] }
	) => {
		if (typeof step === 'string') {
			return step;
		}
		if ('parts' in step) {
			return (
				<>
					{step.parts.map((part, partIdx) =>
						typeof part === 'string' ? (
							<span key={partIdx}>{part}</span>
						) : (
							<a
								key={partIdx}
								href={part.href}
								target={'_blank'}
								rel={'noreferrer'}
								style={{ color: '#202416', textDecoration: 'underline', fontWeight: 600 }}
							>
								{part.text}
							</a>
						)
					)}
				</>
			);
		}
		if (step.href) {
			return (
				<a
					href={step.href}
					target={'_blank'}
					rel={'noreferrer'}
					style={{ color: '#202416', textDecoration: 'underline', fontWeight: 600 }}
				>
					{step.text}
				</a>
			);
		}
		return step.text;
	};

	return (
		<div
			style={{
				background: '#F1F1F1',
				borderRadius: 8,
				padding: 20,
				width: '100%',
				maxWidth: 486.5,
				boxSizing: 'border-box',
				display: 'flex',
				flexDirection: 'column',
				...style,
			}}
		>
			<div style={{ fontWeight: 700, fontSize: 16, color: '#202416', fontFamily: 'Inter', marginBottom: 0 }}>Guide</div>
			{subheaderText && (
				<div style={{ fontSize: 13, color: '#808080', fontFamily: 'Inter', marginBottom: 12, marginTop: 0 }}>
					{subheaderText}
				</div>
			)}
			<ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none' }}>
				{steps.map((step, idx) => (
					<li
						key={idx}
						style={{
							display: 'flex',
							alignItems: 'flex-start',
							gap: 10,
							marginBottom: idx === steps.length - 1 ? 0 : 28,
							marginTop: 12,
						}}
					>
						<span
							style={{ width: 6, height: 6, background: '#202416', borderRadius: 2, marginTop: 7, flex: '0 0 auto' }}
						/>
						<span style={{ color: '#202416', fontSize: 13, fontFamily: 'Inter' }}>{renderStepContent(step)}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

export default function Campaign() {
	const arProvider = useArweaveProvider();
	const permawebProvider = usePermawebProvider();
	const [isVerifying, setIsVerifying] = useState(false);
	const [showModal, setShowModal] = useState(true);
	const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
	const [claimStatus, setClaimStatus] = useState<{
		hasClaimed: boolean;
		status: 'Available' | 'Already-Claimed' | 'Sold-Out' | 'Checking' | null;
		claimedAt?: string;
	}>({
		hasClaimed: false,
		status: null,
	});
	const [verificationResults, setVerificationResults] = useState({
		hasBazarTransaction: false,
		hasBotegaSwap: false,
		hasPermaswapTransaction: false,
		hasAOProcess: false,
		claimProcessed: false,
		aoProcesses: [] as any[],
	});
	const [campaignStats, setCampaignStats] = useState<{
		claimed: number;
		remaining: number;
		total: number;
	} | null>(null);

	async function handleClaim(processId: string): Promise<void> {
		try {
			// Check if already claimed before attempting
			if (claimStatus?.hasClaimed) {
				throw new Error('You have already claimed your asset');
			}

			if (!permawebProvider.profile?.id) {
				console.error('No Bazar profile found');
				throw new Error('You must have a Bazar profile to claim this asset');
			}

			console.log('Starting claim process:', {
				walletAddress: arProvider.walletAddress,
				profileId: permawebProvider.profile.id,
				processId: processId,
				atomicAssetId: ATOMIC_ASSET_ID,
			});

			// Count how many requirements are met
			const requirementsMet = [
				verificationResults.hasBazarTransaction,
				verificationResults.hasBotegaSwap,
				verificationResults.hasPermaswapTransaction,
				verificationResults.hasAOProcess,
			].filter(Boolean).length;

			const hasMetRequirements = requirementsMet >= 2;
			console.log('Requirement check:', {
				bazarTransaction: verificationResults.hasBazarTransaction,
				botegaSwap: verificationResults.hasBotegaSwap,
				permaswapTransaction: verificationResults.hasPermaswapTransaction,
				aoProcess: verificationResults.hasAOProcess,
				totalMet: requirementsMet,
				hasMetRequirements,
			});

			if (!hasMetRequirements) {
				throw new Error('You must meet at least 2 of the 4 requirements to claim this asset');
			}

			// Send claim message using Zone Profile Run-Action pattern
			console.log('Sending claim request via Zone Profile Run-Action...');

			// Use Run-Action for new Zone Profiles (routes through profile to asset)
			const isLegacyProfile = permawebProvider.profile?.isLegacyProfile;

			let tags = [];
			let targetProcessId = '';
			let action = '';

			if (isLegacyProfile) {
				// Legacy profile: send directly to atomic asset
				targetProcessId = ATOMIC_ASSET_ID;
				action = 'Claim';
				tags = [
					{ name: 'Action', value: 'Claim' },
					{ name: 'Recipient', value: permawebProvider.profile.id },
					{ name: 'Wallet-Address', value: arProvider.walletAddress },
				];
			} else {
				// New Zone Profile: use Run-Action pattern (profile forwards to asset)
				targetProcessId = permawebProvider.profile.id; // Send to profile first
				action = 'Run-Action';
				tags = [
					{ name: 'Action', value: 'Run-Action' },
					{ name: 'Forward-To', value: ATOMIC_ASSET_ID }, // Zone Profile expects hyphenated tag name
					{ name: 'Forward-Action', value: 'Claim' }, // Zone Profile expects hyphenated tag name
					{ name: 'Recipient', value: permawebProvider.profile.id },
					{ name: 'Wallet-Address', value: arProvider.walletAddress },
				];
			}

			// When using Zone Profile forwarding, the response comes from the asset process,
			// not the profile process, so we need to query results from the asset process
			console.log('=== Sending Claim Request ===');
			console.log('Target Process (message):', targetProcessId);
			console.log('Result Process (query):', ATOMIC_ASSET_ID);
			console.log('Action:', action);
			console.log('Tags:', tags);
			console.log('Is Legacy Profile:', isLegacyProfile);
			console.log('Data being sent:', {
				requirements: {
					bazarTransaction: verificationResults.hasBazarTransaction,
					botegaSwap: verificationResults.hasBotegaSwap,
					permaswapTransaction: verificationResults.hasPermaswapTransaction,
					aoProcess: verificationResults.hasAOProcess,
				},
				recipient: permawebProvider.profile.id,
			});

			// Use messageResult (singular) with specific message ID instead of messageResults (plural)
			// This avoids rate limiting from querying all results and is more efficient
			console.log('=== Using messageResult with specific message ID ===');

			// First, send the message and get the message ID
			const messageTags = [{ name: 'Action', value: action }, ...tags];

			// For Zone Profile Run-Action, wrap data in Input field
			// For legacy profiles, send data directly
			const claimData = {
				requirements: {
					bazarTransaction: verificationResults.hasBazarTransaction,
					botegaSwap: verificationResults.hasBotegaSwap,
					permaswapTransaction: verificationResults.hasPermaswapTransaction,
					aoProcess: verificationResults.hasAOProcess,
				},
				recipient: permawebProvider.profile.id,
			};

			// Zone Profile expects data wrapped in Input field
			const messageData = isLegacyProfile ? claimData : { Input: claimData };

			const messageTxId = await message({
				process: targetProcessId,
				signer: createDataItemSigner(arProvider.wallet),
				tags: messageTags,
				data: JSON.stringify(messageData),
			});

			console.log('[handleClaim] Message sent, txId:', messageTxId);
			console.log('[handleClaim] Waiting for response...');

			// Wait for the process to respond
			await new Promise((resolve) => setTimeout(resolve, 12000)); // 12 second wait for claim processing

			// Query response using HyperBEAM to avoid CU rate limiting
			// For Zone Profile forwarding, the response is sent back to the profile process via msg.reply()
			// But we should check both the asset process (where handler runs) and profile process (where reply goes)
			const assetProcessId = ATOMIC_ASSET_ID;
			const profileProcessId = permawebProvider.profile.id;

			console.log('[handleClaim] Querying response from HyperBEAM for asset process:', assetProcessId);
			console.log('[handleClaim] Also checking profile process for reply:', profileProcessId);

			let response = null;
			let retries = 8; // More retries since we're using HyperBEAM
			let delay = 3000; // Start with 3 second delay

			// Helper function to query HyperBEAM for process state
			const queryHyperBEAMState = async (processId: string): Promise<any> => {
				const url = `${HB.defaultNode}/${processId}~process@1.0/now`;
				const headers = {
					'require-codec': 'application/json',
					'accept-bundle': 'true',
				};

				try {
					const res = await fetch(url, { headers });
					if (res.ok) {
						return await res.json();
					}
					throw new Error(`HyperBEAM returned status ${res.status}`);
				} catch (error: any) {
					console.error('[handleClaim] HyperBEAM query error:', error);
					throw error;
				}
			};

			while (retries > 0 && !response) {
				try {
					// Try HyperBEAM first (no rate limiting)
					// Check both asset process and profile process for the response
					const processesToCheck = [assetProcessId, profileProcessId];

					for (const processId of processesToCheck) {
						if (response) break; // Already found response

						try {
							const state = await queryHyperBEAMState(processId);

							// Check if state has Results key with messages
							if (state?.Results && Array.isArray(state.Results)) {
								// Look through Results for Claim-Success, Claim-Error, or Error actions
								// Prioritize Claim-Error over Claim-Success (to catch duplicate attempts)
								const foundResponses: any[] = [];

								for (const result of state.Results) {
									if (result?.Messages && Array.isArray(result.Messages)) {
										for (const msg of result.Messages) {
											const action = getTagValue(msg.Tags, 'Action');
											if (action === 'Claim-Success' || action === 'Claim-Error' || action === 'Error') {
												// For profile process, check if Target matches our profile
												// For asset process, check if Recipient matches our profile
												const target = getTagValue(msg.Tags, 'Target');
												const recipient = getTagValue(msg.Tags, 'Recipient');
												const isForUs = target === profileProcessId || recipient === profileProcessId;

												if (isForUs) {
													let responseData = null;
													if (msg.Data) {
														try {
															responseData = JSON.parse(msg.Data);
														} catch {
															responseData = msg.Data;
														}
													}

													foundResponses.push({
														action,
														response: {
															[action]: {
																status: getTagValue(msg.Tags, 'Status'),
																message: getTagValue(msg.Tags, 'Message'),
																data: responseData,
															},
														},
														timestamp: msg.Timestamp || 0,
													});
												}
											}
										}
									}
								}

								// Prioritize Claim-Error responses (duplicate attempts), then take most recent
								if (foundResponses.length > 0) {
									// Sort: Claim-Error first, then by timestamp (most recent first)
									foundResponses.sort((a, b) => {
										if (a.action === 'Claim-Error' && b.action !== 'Claim-Error') return -1;
										if (a.action !== 'Claim-Error' && b.action === 'Claim-Error') return 1;
										return (b.timestamp || 0) - (a.timestamp || 0);
									});

									response = foundResponses[0].response;
									console.log(`[handleClaim] Found response via HyperBEAM from ${processId}:`, response);
									console.log(
										`[handleClaim] Total matching responses found: ${foundResponses.length}, selected: ${foundResponses[0].action}`
									);
								}
							}
						} catch (hyperbeamError: any) {
							console.warn(`[handleClaim] HyperBEAM query failed for ${processId}:`, hyperbeamError);
						}
					}

					// If HyperBEAM didn't find it, try CU results as fallback
					if (!response) {
						console.log("[handleClaim] HyperBEAM didn't find response, trying CU results...");

						for (const processId of processesToCheck) {
							if (response) break; // Already found response

							try {
								const resultsData = await getResults({
									process: processId,
									sort: 'DESC',
									limit: 10,
								});

								if (resultsData?.edges && resultsData.edges.length > 0) {
									// Look through recent results for Claim-Success, Claim-Error, or Error actions
									// Prioritize Claim-Error over Claim-Success (to catch duplicate attempts)
									const foundResponses: any[] = [];

									for (const edge of resultsData.edges) {
										if (edge.node?.Messages && edge.node.Messages.length > 0) {
											for (const msg of edge.node.Messages) {
												const action = getTagValue(msg.Tags, 'Action');
												if (action === 'Claim-Success' || action === 'Claim-Error' || action === 'Error') {
													// For profile process, check if Target matches our profile
													// For asset process, check if Recipient matches our profile
													const target = getTagValue(msg.Tags, 'Target');
													const recipient = getTagValue(msg.Tags, 'Recipient');
													const isForUs = target === profileProcessId || recipient === profileProcessId;

													if (isForUs) {
														let responseData = null;
														if (msg.Data) {
															try {
																responseData = JSON.parse(msg.Data);
															} catch {
																responseData = msg.Data;
															}
														}

														foundResponses.push({
															action,
															response: {
																[action]: {
																	status: getTagValue(msg.Tags, 'Status'),
																	message: getTagValue(msg.Tags, 'Message'),
																	data: responseData,
																},
															},
															// Use message timestamp or order to determine recency
															timestamp: msg.Timestamp || edge.node.Output?.timestamp || 0,
														});
													}
												}
											}
										}
									}

									// Prioritize Claim-Error responses (duplicate attempts), then take most recent
									if (foundResponses.length > 0) {
										// Sort: Claim-Error first, then by timestamp (most recent first)
										foundResponses.sort((a, b) => {
											if (a.action === 'Claim-Error' && b.action !== 'Claim-Error') return -1;
											if (a.action !== 'Claim-Error' && b.action === 'Claim-Error') return 1;
											return (b.timestamp || 0) - (a.timestamp || 0);
										});

										response = foundResponses[0].response;
										console.log(`[handleClaim] Found response via CU from ${processId}:`, response);
										console.log(
											`[handleClaim] Total matching responses found: ${foundResponses.length}, selected: ${foundResponses[0].action}`
										);
									}
								}
							} catch (cuError: any) {
								console.warn(`[handleClaim] CU query failed for ${processId}:`, cuError);
							}
						}
					}

					if (response) break;

					// If no response found, wait and retry
					if (retries > 1) {
						console.log(
							`[handleClaim] Response not found yet, retrying in ${delay}ms... (${retries - 1} retries left)`
						);
						await new Promise((resolve) => setTimeout(resolve, delay));
						delay *= 1.2; // Gradual backoff
					}
					retries--;
				} catch (error: any) {
					console.error('[handleClaim] Error querying results:', error);
					// If rate limited, wait longer before retrying
					if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
						if (retries > 1) {
							console.log(`[handleClaim] Rate limited, waiting ${delay * 2}ms before retry...`);
							await new Promise((resolve) => setTimeout(resolve, delay * 2));
							delay *= 2;
						}
					} else if (retries > 1) {
						await new Promise((resolve) => setTimeout(resolve, delay));
						delay *= 1.2;
					}
					retries--;
				}
			}

			console.log('=== Claim Response ===');
			console.log('Raw response:', response);
			console.log('Response type:', typeof response);
			console.log('Response keys:', response ? Object.keys(response) : 'null');
			console.log('Response is null?', response === null);
			console.log('Response is undefined?', response === undefined);

			if (!response) {
				console.error('No response received - this could mean:');
				console.error('1. Handler not loaded in process');
				console.error('2. Timeout too short');
				console.error('3. Process not responding');
				console.error('4. Message format incorrect');
				throw new Error('No response received from claim process. Check console for details.');
			}

			if (response?.['Claim-Success']) {
				console.log('Claim successful!', response['Claim-Success']);
				setVerificationResults((prev) => ({
					...prev,
					claimProcessed: true,
				}));
				// Update claim status to reflect successful claim
				setClaimStatus({
					hasClaimed: true,
					status: 'Already-Claimed',
					claimedAt: response['Claim-Success']?.data?.claimedAt?.toString(),
				});
				// Refresh campaign stats after successful claim
				await fetchCampaignStats();
			} else if (response?.['Claim-Error'] || response?.['Error']) {
				const errorMessage =
					response?.['Claim-Error']?.message ||
					response?.['Claim-Error']?.Tags?.Message ||
					response?.['Error']?.message ||
					response?.['Error']?.Tags?.Message ||
					'Claim failed';
				console.error('Claim error response:', response);
				throw new Error(errorMessage);
			} else {
				console.error('Unexpected response format:', response);
				console.error('Expected one of: Claim-Success, Claim-Error, Error');
				throw new Error('Unexpected response format from claim process');
			}
		} catch (error) {
			console.error('Claim error:', error);
			throw error;
		}
	}

	// Check claim status when wallet connects
	const checkClaimStatus = async () => {
		if (!arProvider.walletAddress) {
			return;
		}

		try {
			setClaimStatus((prev) => ({ ...prev, status: 'Checking' }));
			console.log('[checkClaimStatus] Checking claim status for wallet:', arProvider.walletAddress);

			const statusData = await readHandler({
				processId: ATOMIC_ASSET_ID,
				action: 'Get-Claim-Status',
				tags: [{ name: 'Wallet-Address', value: arProvider.walletAddress }],
				data: null,
			});

			console.log('[checkClaimStatus] Received status:', statusData);

			if (statusData) {
				// readHandler returns tags as an object, so Status will be a property
				const status = statusData.Status || statusData.status;
				if (status === 'Already-Claimed') {
					setClaimStatus({
						hasClaimed: true,
						status: 'Already-Claimed',
						claimedAt: statusData.ClaimedAt || statusData.claimedAt,
					});
				} else if (status === 'Sold-Out') {
					setClaimStatus({
						hasClaimed: false,
						status: 'Sold-Out',
					});
				} else if (status === 'Available') {
					setClaimStatus({
						hasClaimed: false,
						status: 'Available',
					});
				}
			}
		} catch (error) {
			console.error('[checkClaimStatus] Error checking claim status:', error);
			// Don't set error status, just log it - user can still try to claim
			setClaimStatus({
				hasClaimed: false,
				status: null,
			});
		}
	};

	useEffect(() => {
		if (arProvider.walletAddress && permawebProvider.libs) {
			setIsCheckingEligibility(true);
			Promise.all([verifyWallet(), checkClaimStatus()]).finally(() => {
				setIsCheckingEligibility(false);
			});
		}
		// Fetch campaign stats on mount
		fetchCampaignStats();
	}, [arProvider.walletAddress, permawebProvider.libs]);

	const fetchCampaignStats = async () => {
		try {
			console.log('[fetchCampaignStats] Fetching stats from process:', ATOMIC_ASSET_ID);
			// Use readHandler for campaign stats (will use dryrun)
			const statsData = await readHandler({
				processId: ATOMIC_ASSET_ID,
				action: 'Get-Campaign-Stats',
			});

			console.log('[fetchCampaignStats] Received stats data:', statsData);

			if (statsData) {
				// Handle case-insensitive field names (TotalSupply vs Totalsupply)
				const totalSupply = statsData.TotalSupply || statsData.Totalsupply || statsData.totalSupply || 1984;
				const claimed = statsData.Claimed || statsData.claimed || 0;
				const remaining = statsData.Remaining || statsData.remaining || totalSupply - claimed;

				setCampaignStats({
					claimed: parseInt(claimed),
					remaining: parseInt(remaining),
					total: parseInt(totalSupply),
				});
				console.log('[fetchCampaignStats] Stats set:', { claimed, remaining, total: totalSupply });
			} else {
				console.warn('[fetchCampaignStats] No stats data received - handler may not be loaded');
			}
		} catch (error) {
			console.error('[fetchCampaignStats] Failed to fetch campaign stats:', error);
		}
	};

	const verifyWallet = async () => {
		if (!permawebProvider.libs) return;

		setIsVerifying(true);
		try {
			// Check Bazar transactions
			const bazarData = await permawebProvider.libs.getGQLData({
				gateway: GATEWAYS.arweave,
				owners: [arProvider.walletAddress],
				tags: [
					{ name: 'Type', values: ['Message'] },
					{ name: 'Variant', values: ['ao.TN.1'] },
					{ name: 'X-Order-Action', values: ['Create-Order'] },
				],
			});

			// Check Swap transactions
			const swapData = await permawebProvider.libs.getGQLData({
				gateway: GATEWAYS.arweave,
				owners: [arProvider.walletAddress],
				tags: [
					{ name: 'X-Action', values: ['Multi-Hop-Swap'] },
					{ name: 'Data-Protocol', values: ['ao'] },
					{ name: 'Type', values: ['Message'] },
					{ name: 'Variant', values: ['ao.TN.1'] },
				],
			});

			// Check AO Process
			const aoProcessData = await permawebProvider.libs.getGQLData({
				gateway: GATEWAYS.arweave,
				owners: [arProvider.walletAddress],
				tags: [
					{ name: 'Data-Protocol', values: ['ao'] },
					{ name: 'Type', values: ['Process'] },
				],
			});

			console.log('Verification results:', {
				bazarTransactions: bazarData.data,
				swapTransactions: swapData.data,
				aoProcesses: aoProcessData.data,
			});

			setVerificationResults((prev) => ({
				...prev,
				hasBazarTransaction: bazarData.data.length > 0,
				hasBotegaSwap: false, // TODO: Implement Botega swap check
				hasPermaswapTransaction: swapData.data.length > 0,
				hasAOProcess: aoProcessData.data.length > 0,
				aoProcesses: aoProcessData.data, // Store the actual processes
			}));
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
		opacity: !arProvider.walletAddress ? 1 : 0,
		borderRadius: 8,
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
						collected={campaignStats ? `${campaignStats.claimed}/${campaignStats.total}` : '0/1984'}
						bgColor="#f7f7f7"
						cardBgColor="#F1F1F1"
						connected={!!arProvider.walletAddress}
						overlayStyle={overlayStyle}
						isLeft
						showConnectWallet={true}
						showBlur={showModal || isCheckingEligibility}
						requirements={[
							{ text: 'Transacted on Bazar (Buy, or Sell)', met: verificationResults.hasBazarTransaction },
							{ text: 'Transacted on Botega (Buy, Sell, Agents, etc...)', met: verificationResults.hasBotegaSwap },
							{ text: 'Transacted on Permawasp (Swap)', met: verificationResults.hasPermaswapTransaction },
							{ text: 'Spawned an AO Process', met: verificationResults.hasAOProcess },
						]}
						onClaim={() => handleClaim(ATOMIC_ASSET_ID)}
						onConnectWallet={() => arProvider.setWalletModalVisible(true)}
						claimStatus={claimStatus}
						guideSubheader={'More info on how to claim your Atomic Asset'}
						guide={[
							'Transactions must be from the start of legacynet up to February 8, 2025 (mainnet launch)',
							'First 1,984 wallets get to claim. (first come, first serve)',
							'One atomic asset per wallet.',
						]}
					/>
					<RewardCard
						video={MEDIA_URLS.glasseatersVideo}
						fallbackImage={MEDIA_URLS.glasseaterImg}
						image={MEDIA_URLS.glasseaterImg}
						title="Hyperbeam Glasseaters"
						collected="100 Total Supply"
						collectedSuffix=""
						bgColor="#f3f5f2"
						cardBgColor="#CFCFCF"
						connected={!!arProvider.walletAddress}
						overlayStyle={overlayStyle}
						isRight
						showConnectWallet={false}
						showBlur={showModal || isCheckingEligibility}
						cta={{
							label: 'Join Competition Via Discord',
							href: 'https://discord.gg/kDWWbjj7Fm',
							iconSrc: ASSETS.discord,
						}}
						requirements={[
							{ text: 'Participated actively in AO Testnet', met: false, hideCheckbox: true },
							{
								text: 'Selected by one of the 10 partner projects for standout testnet contributions',
								met: false,
								hideCheckbox: true,
							},
						]}
						requirementsSubheader={'Complete all requirements to claim'}
						guide={[
							{
								parts: [
									'Projects include: ',
									{ text: 'Apus Network', href: 'https://apus.network/' },
									', ',
									{ text: 'Protocol Land', href: 'https://protocol.land' },
									', ',
									{ text: 'Wander', href: 'https://wander.app' },
									', ',
									{ text: 'ARIO', href: 'https://ar.io' },
									', ',
									{ text: 'RandAO', href: 'https://randao.org' },
									', ',
									{ text: 'StarGrid Battle Tactics', href: 'https://stargrid.ar.io/' },
									', ',
									{ text: 'Arweave Oasis', href: 'https://arweaveoasis.com' },
									', ',
									{ text: 'Arweave India', href: 'https://arweaveindia.com' },
									', ',
									{ text: 'Bazar Marketplace', href: 'https://bazar.arweave.net' },
									', ',
									{ text: 'Load Network', href: 'https://load.network' },
								],
							},
							'Throughout Dec 31–Jan 6 the Glasseaters will be distributed to selected winners',
						]}
						onClaim={() => handleClaim(ATOMIC_ASSET_ID)}
					/>

					{/* Show modal for both unconnected and verifying states, but allow user to dismiss */}
					{((showModal && (!arProvider.walletAddress || isVerifying)) || isCheckingEligibility) && (
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
							<HeroSection
								onConnect={() => arProvider.setWalletModalVisible(true)}
								onViewCampaign={() => setShowModal(false)}
								isVerifying={isVerifying}
								isCheckingEligibility={isCheckingEligibility}
							/>
						</div>
					)}
				</div>
			</div>
		</>
	);
}
