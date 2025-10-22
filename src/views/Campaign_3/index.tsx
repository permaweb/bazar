import React, { useEffect, useState } from 'react';
import { createGlobalStyle } from 'styled-components';

import { messageResults } from 'api';

import { ASSETS, GATEWAYS } from 'helpers/config';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';

import { ConnectWallet } from './components/ConnectWallet';
// Import images
import survivedAoImg from './survivedao.png';

// Add these TypeScript module declarations at the top of the file
declare module '*.mp4';
declare module '*.avif';

// Constants for the Bazarro Red collection
const ATOMIC_ASSET_ID = 'p9i8Mqo_MupYIKDyF7xq36qlirgA5W1L1AB8ZID8Njs'; // Bazarro Red
const COLLECTION_ID = 'zOVczA4Zibo6olPAkmEaOcUBB_BdISkk3-G3czMS2GE';

// Zone roles
const ZONE_ROLES = {
	ADMIN: 'Admin',
	CONTRIBUTOR: 'Contributor',
	MODERATOR: 'Moderator',
	EXTERNAL_CONTRIBUTOR: 'ExternalContributor',
} as const;

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
	onClaim,
	showConnectWallet = true,
	cta,
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
	requirements?: { text: string; met: boolean }[];
	requirementsSubheader?: string;
	guide?: string[];
	onClaim?: () => Promise<void>;
	showConnectWallet?: boolean;
	cta?: { label: string; href: string; iconSrc?: string };
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
				{connected && requirements && (
					<RequirementsBox
						requirements={requirements}
						subheaderText={requirementsSubheader}
						style={{ marginTop: 0, marginBottom: guide ? 16 : 2 }}
					/>
				)}
				{connected && guide && <GuideBox steps={guide} style={{ marginTop: 16 }} />}
				{connected && !cta && atLeastOneRequirementMet && onClaim && (
					<button
						onClick={handleClaim}
						disabled={isLoading}
						style={{
							width: 'calc(100% - 32px)',
							padding: '20px 12px',
							border: 'none',
							borderRadius: 8,
							background: '#000',
							color: '#FFFFFF',
							fontSize: 14,
							cursor: isLoading ? 'wait' : 'pointer',
							opacity: isLoading ? 0.7 : 1,
							transition: 'all 80ms ease-out',
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							gap: 8,
							margin: '16px',
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
				{cta && (
					<a
						href={cta.href}
						target={'_blank'}
						rel={'noreferrer'}
						style={{
							width: 'calc(100% - 32px)',
							padding: '20px 12px',
							border: 'none',
							borderRadius: 8,
							background: '#000',
							color: '#FFFFFF',
							fontSize: 14,
							textDecoration: 'none',
							textAlign: 'center',
							transition: 'all 80ms ease-out',
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							gap: 8,
							margin: '16px',
						}}
					>
						{cta.iconSrc && <img src={cta.iconSrc} alt={cta.label} style={{ width: 16, height: 16, marginRight: 8 }} />}
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
								borderRadius: 9999,
								padding: '20px 0px',
								fontSize: 14,
								fontWeight: 700,
								fontFamily: 'Inter',
								cursor: isVerifying ? 'default' : 'pointer',
								transition: 'all 200ms ease-out',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							{isVerifying ? (
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
					</div>
				</div>
			</div>
		</div>
	);
}

// Requirements box component
function RequirementsBox({
	requirements,
	subheaderText = 'Only one required to claim',
	style = {},
}: {
	requirements: { text: string; met: boolean }[];
	subheaderText?: string;
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
			<div style={{ fontWeight: 700, fontSize: 16, color: '#202416', fontFamily: 'Inter', marginBottom: 0 }}>
				Requirements
			</div>
			<div style={{ fontSize: 13, color: '#808080', fontFamily: 'Inter', marginBottom: 12, marginTop: 0 }}>
				{subheaderText}
			</div>
			{requirements.map((req, idx) => (
				<div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
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
							marginRight: 10,
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
					<span style={{ color: req.met ? '#202416' : '#808080', fontSize: 13 }}>{req.text}</span>
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
			<div style={{ fontWeight: 700, fontSize: 16, color: '#202416', fontFamily: 'Inter', marginBottom: 0 }}>Guide</div>
			<div style={{ fontSize: 13, color: '#808080', fontFamily: 'Inter', marginBottom: 12, marginTop: 0 }}>
				How to get started running a node on AO / Hyperbeam
			</div>
			<ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none' }}>
				{steps.map((step, idx) => (
					<li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 28, marginTop: 12 }}>
						<span
							style={{ width: 6, height: 6, background: '#202416', borderRadius: 2, marginTop: 7, flex: '0 0 auto' }}
						/>
						<span style={{ color: '#202416', fontSize: 13, fontFamily: 'Inter' }}>{step}</span>
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
	const [verificationResults, setVerificationResults] = useState({
		hasBazarTransaction: false,
		hasBotegaSwap: false,
		hasPermaswapTransaction: false,
		hasAOProcess: false,
		claimProcessed: false,
		aoProcesses: [] as any[],
	});

	// First check if user has access to the collection
	async function checkCollectionAccess(profileId: string): Promise<boolean> {
		try {
			console.log('Starting collection access check:', {
				profileId,
				collectionId: COLLECTION_ID,
				wallet: arProvider.walletAddress,
			});

			// First try to get collection info
			const infoResponse = await messageResults({
				processId: COLLECTION_ID,
				wallet: arProvider.wallet,
				action: 'Info',
				tags: [{ name: 'Action', value: 'Info' }],
				data: null,
				responses: ['Info-Response', 'Error'],
			});

			console.log('Collection info response:', infoResponse);

			// If info fails, we need to wait for an invite and then join
			if (!infoResponse?.['Info-Response']) {
				console.log('No info response, waiting for invite...');
				// Wait for invite (this should be sent by admin)
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}

			// Try to join the collection
			console.log('Attempting to join collection...');
			const joinResponse = await messageResults({
				processId: COLLECTION_ID,
				wallet: arProvider.wallet,
				action: 'Zone-Join',
				tags: [
					{ name: 'Action', value: 'Zone-Join' },
					{ name: 'ZoneId', value: COLLECTION_ID },
				],
				data: null,
				responses: ['Joined-Zone', 'Error'],
			});

			console.log('Join response:', joinResponse);

			// Check if we successfully joined
			const hasAccess = !!infoResponse?.['Info-Response'] || !!joinResponse?.['Joined-Zone'];
			console.log('Access check result:', { hasAccess });

			return hasAccess;
		} catch (error) {
			console.error('Error in collection access check:', error);
			return false;
		}
	}

	async function setupUserZoneAccess(userProfileId: string, hasMetRequirements: boolean) {
		if (!hasMetRequirements) {
			throw new Error('You must meet all requirements to claim this asset');
		}

		console.log('Setting up zone access for user:', {
			profileId: userProfileId,
			roles: [ZONE_ROLES.ADMIN, ZONE_ROLES.CONTRIBUTOR],
			collection: COLLECTION_ID,
		});

		// First check if we have access
		const hasAccess = await checkCollectionAccess(userProfileId);
		if (!hasAccess) {
			throw new Error('Unable to access collection. Please check your permissions.');
		}

		// Now set up the roles - request both Admin and Contributor roles
		const response = await messageResults({
			processId: COLLECTION_ID,
			wallet: arProvider.wallet,
			action: 'Zone-Role-Set',
			tags: [
				{ name: 'Action', value: 'Zone-Role-Set' },
				{ name: 'Target', value: COLLECTION_ID },
			],
			data: JSON.stringify([
				{
					Id: userProfileId,
					Roles: [ZONE_ROLES.ADMIN, ZONE_ROLES.CONTRIBUTOR],
					Type: 'process',
					SendInvite: true,
				},
			]),
		});

		console.log('Zone role setup response:', response);

		// Check for specific error responses
		if (response?.Error) {
			console.error('Zone role setup error:', response.Error);
			throw new Error(response.Error.message || 'Failed to set up zone access');
		}

		// Verify we got the needed role
		const verifyResponse = await messageResults({
			processId: COLLECTION_ID,
			wallet: arProvider.wallet,
			action: 'Info',
			tags: [{ name: 'Action', value: 'Info' }],
			data: null,
			responses: ['Info-Response', 'Error'],
		});

		console.log('Role verification response:', verifyResponse);

		if (!verifyResponse?.['Info-Response']?.roles?.includes(ZONE_ROLES.ADMIN)) {
			throw new Error('Failed to obtain required Admin role for transfer');
		}

		return response;
	}

	async function handleClaim(processId: string): Promise<void> {
		try {
			if (!arProvider.profile?.id) {
				console.error('No Bazar profile found');
				throw new Error('You must have a Bazar profile to claim this asset');
			}

			console.log('Starting claim process:', {
				walletAddress: arProvider.walletAddress,
				profileId: arProvider.profile.id,
				processId: processId,
				atomicAssetId: ATOMIC_ASSET_ID,
				collectionId: COLLECTION_ID,
			});

			const hasMetRequirements = verificationResults.aoProcesses.length >= 5;
			console.log('Requirement check:', {
				aoProcesses: verificationResults.aoProcesses.length,
				hasMetRequirements,
			});

			// First try to set up zone access
			try {
				await setupUserZoneAccess(arProvider.profile.id, hasMetRequirements);
			} catch (error) {
				console.error('Failed to set up zone access:', error);
				throw new Error('Unable to access collection. Please check your permissions.');
			}

			// Double check collection access before proceeding
			const hasAccess = await checkCollectionAccess(arProvider.profile.id);
			if (!hasAccess) {
				throw new Error('Unable to access collection. Please check your permissions.');
			}

			// Now do the transfer using profile forwarding through the collection
			console.log('Initiating atomic asset transfer via collection...');
			const response = await messageResults({
				processId: arProvider.profile.id,
				wallet: arProvider.wallet,
				action: 'Run-Action',
				tags: [
					{ name: 'Action', value: 'Run-Action' },
					{ name: 'ForwardTo', value: COLLECTION_ID },
					{ name: 'ForwardAction', value: 'Transfer' },
					{ name: 'Target', value: ATOMIC_ASSET_ID },
					{ name: 'Recipient', value: arProvider.profile.id },
					{ name: 'Quantity', value: '1' },
				],
				data: {
					Target: ATOMIC_ASSET_ID,
					Action: 'Transfer',
					Input: {
						Collection: COLLECTION_ID,
					},
				},
				responses: ['Transfer-Success', 'Transfer-Error', 'Debit-Notice', 'Credit-Notice', 'Error', 'Zone-Error'],
			});

			console.log('=== Transfer Response Analysis ===');
			console.log('Raw response:', response);

			// Analyze the response
			const responseAnalysis = {
				hasTransferSuccess: !!response?.['Transfer-Success'],
				hasDebitNotice: !!response?.['Debit-Notice'],
				hasCreditNotice: !!response?.['Credit-Notice'],
				hasError: !!response?.['Error'] || !!response?.['Transfer-Error'] || !!response?.['Zone-Error'],
				transferSuccessDetails: response?.['Transfer-Success'] || null,
				debitNoticeDetails: response?.['Debit-Notice'] || null,
				creditNoticeDetails: response?.['Credit-Notice'] || null,
				errorDetails: response?.['Error'] || response?.['Transfer-Error'] || response?.['Zone-Error'] || null,
				transferId: response?.['Transfer-Success']?.id || response?.['Credit-Notice']?.id,
			};
			console.log('Response Analysis:', responseAnalysis);

			if (
				responseAnalysis.hasTransferSuccess ||
				(responseAnalysis.hasDebitNotice && responseAnalysis.hasCreditNotice)
			) {
				console.log('Transfer successful - Transaction Details:', {
					success: responseAnalysis.hasTransferSuccess ? 'Transfer-Success' : 'Notice-Based',
					transactionId: responseAnalysis.transferId,
					debitNotice: responseAnalysis.hasDebitNotice,
					creditNotice: responseAnalysis.hasCreditNotice,
				});

				setVerificationResults((prev) => ({
					...prev,
					claimProcessed: true,
				}));
			} else if (responseAnalysis.hasError) {
				const errorMessage =
					responseAnalysis.errorDetails?.message || responseAnalysis.errorDetails?.error || 'Transfer failed';

				// If it's a zone error, try to refresh access
				if (response?.['Zone-Error']) {
					console.log('Zone error detected, attempting to refresh access...');
					await setupUserZoneAccess(arProvider.profile.id, hasMetRequirements);
					throw new Error(`${errorMessage} - Please try again.`);
				}

				throw new Error(errorMessage);
			} else if (Object.keys(response).length === 0) {
				throw new Error('No response received - please check your Bazar profile status');
			} else {
				throw new Error('Unexpected transfer response structure');
			}
		} catch (error) {
			console.error('Claim error:', error);
			throw error;
		}
	}

	useEffect(() => {
		if (arProvider.walletAddress && permawebProvider.libs) {
			verifyWallet();
		}
	}, [arProvider.walletAddress, permawebProvider.libs]);

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
						connected={!!arProvider.walletAddress}
						overlayStyle={overlayStyle}
						isLeft
						requirements={[
							{ text: 'Transacted on Bazar (Buy, or Sell)', met: verificationResults.hasBazarTransaction },
							{ text: 'Transacted on Botega (Buy, Sell, Agents, etc...)', met: verificationResults.hasBotegaSwap },
							{ text: 'Transacted on Permawasp (Swap)', met: verificationResults.hasPermaswapTransaction },
							{ text: 'Spawned an AO Process', met: verificationResults.hasAOProcess },
						]}
						onClaim={() => handleClaim(ATOMIC_ASSET_ID)}
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
						cta={{
							label: 'Join Competition Via Discord',
							href: 'https://discord.gg/kDWWbjj7Fm',
							iconSrc: ASSETS.discord,
						}}
						requirements={[{ text: 'Run node for 20+ consecutive days', met: true }]}
						requirementsSubheader={'Complete all requirements to claim'}
						guide={[
							'Run node for 20+ consecutive days by November 21, 2025 (qualification deadline)',
							'Consecutive runtime starting from any date (before or after announcement)',
							'Operators already running count their current streak (if uninterrupted)',
							'Any downtime resets the counter - must have uninterrupted 20-day streak',
							'Verified via on-chain logs/uptime data',
							'Submit wallet address via Discord',
							'First 100 eligible operators (if more apply)',
						]}
						onClaim={() => handleClaim(ATOMIC_ASSET_ID)}
					/>

					{/* Show modal for both unconnected and verifying states */}
					{(!arProvider.walletAddress || isVerifying) && (
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
							<HeroSection onConnect={() => arProvider.setWalletModalVisible(true)} isVerifying={isVerifying} />
						</div>
					)}
				</div>
			</div>
		</>
	);
}
