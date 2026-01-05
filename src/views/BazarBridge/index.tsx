import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

import { Button } from 'components/atoms/Button';
import { Loader } from 'components/atoms/Loader';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { checkExistingProfile, createProfile } from 'helpers/profileCreation';
import { REDIRECTS } from 'helpers/config';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useEvmWallet } from 'providers/EvmWalletProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';

import * as S from './styles';

type StepStatus = 'pending' | 'active' | 'completed';

interface StepState {
	profileCreation: StepStatus;
	bridgeAssets: StepStatus;
	delegation: StepStatus;
}

export default function BazarBridge() {
	const arProvider = useArweaveProvider();
	const evmWallet = useEvmWallet();
	const permawebProvider = usePermawebProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [steps, setSteps] = React.useState<StepState>({
		profileCreation: 'active',
		bridgeAssets: 'pending',
		delegation: 'pending',
	});

	const [profileCreating, setProfileCreating] = React.useState(false);
	const [profileError, setProfileError] = React.useState<string | null>(null);
	const [ethProfile, setEthProfile] = React.useState<string | null>(null);
	const [profileEditOpen, setProfileEditOpen] = React.useState(false);
	const [delegationPanelOpen, setDelegationPanelOpen] = React.useState(false);

	// Check if user has ETH profile on mount
	React.useEffect(() => {
		if (evmWallet.evmAddress && !arProvider.walletAddress) {
			checkForExistingProfile();
		}
	}, [evmWallet.evmAddress]);

	// Update steps based on profile status
	React.useEffect(() => {
		if (permawebProvider.profile?.id || ethProfile) {
			setSteps({
				profileCreation: 'completed',
				bridgeAssets: 'active',
				delegation: 'pending',
			});
		}
	}, [permawebProvider.profile, ethProfile]);

	const checkForExistingProfile = async () => {
		if (!evmWallet.evmAddress) return;

		// Check localStorage first
		const cacheKey = `ethProfile_${evmWallet.evmAddress.toLowerCase()}`;
		const cachedProfileId = localStorage.getItem(cacheKey);
		if (cachedProfileId) {
			setEthProfile(cachedProfileId);
			console.log('Found cached ETH profile:', cachedProfileId);
			return;
		}

		try {
			const existingProfileId = await checkExistingProfile(evmWallet.evmAddress);
			if (existingProfileId) {
				// Cache it for future use
				localStorage.setItem(cacheKey, existingProfileId);
				setEthProfile(existingProfileId);
				console.log('Found existing ETH profile:', existingProfileId);
			}
		} catch (error) {
			console.error('Error checking for profile:', error);
		}
	};

	const handleCreateEthProfile = async () => {
		if (!evmWallet.evmAddress) {
			setProfileError('No ETH wallet address available');
			return;
		}

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'BazarBridge/index.tsx:87',
				message: 'handleCreateEthProfile: Entry',
				data: {
					evmAddress: evmWallet.evmAddress,
					currentEthProfile: ethProfile,
					hasSessionKey: !!evmWallet.sessionKey,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'BB1',
			}),
		}).catch(() => {});
		// #endregion

		// CRITICAL: Check if profile already exists BEFORE creating
		// Check localStorage first (fastest)
		const cacheKey = `ethProfile_${evmWallet.evmAddress.toLowerCase()}`;
		const cachedProfileId = localStorage.getItem(cacheKey);

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'BazarBridge/index.tsx:95',
				message: 'handleCreateEthProfile: Checking for existing profile',
				data: {
					evmAddress: evmWallet.evmAddress,
					cacheKey,
					cachedProfileId,
					currentEthProfile,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'BB1',
			}),
		}).catch(() => {});
		// #endregion

		if (cachedProfileId || ethProfile) {
			const existingProfileId = cachedProfileId || ethProfile;
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'BazarBridge/index.tsx:110',
					message: 'handleCreateEthProfile: Profile already exists, opening edit',
					data: { existingProfileId, source: cachedProfileId ? 'localStorage' : 'state' },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'BB1',
				}),
			}).catch(() => {});
			// #endregion
			console.log('Profile already exists:', existingProfileId);
			setEthProfile(existingProfileId);
			setProfileEditOpen(true);
			return;
		}

		// Also check registry before creating
		try {
			const existingProfileId = await checkExistingProfile(evmWallet.evmAddress);
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'BazarBridge/index.tsx:125',
					message: 'handleCreateEthProfile: Registry check result',
					data: { existingProfileId, evmAddress: evmWallet.evmAddress },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'BB1',
				}),
			}).catch(() => {});
			// #endregion

			if (existingProfileId) {
				// Cache it and set it
				localStorage.setItem(cacheKey, existingProfileId);
				setEthProfile(existingProfileId);
				setProfileEditOpen(true);
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'BazarBridge/index.tsx:140',
						message: 'handleCreateEthProfile: Using existing profile from registry',
						data: { existingProfileId, cached: true },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'BB1',
					}),
				}).catch(() => {});
				// #endregion
				return;
			}
		} catch (checkError) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'BazarBridge/index.tsx:150',
					message: 'handleCreateEthProfile: Registry check failed, proceeding with creation',
					data: {
						checkError: checkError instanceof Error ? checkError.message : String(checkError),
						evmAddress: evmWallet.evmAddress,
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'BB1',
				}),
			}).catch(() => {});
			// #endregion
			console.warn('Registry check failed, proceeding with creation:', checkError);
		}

		// Check if session key is available
		if (!evmWallet.sessionKey) {
			console.log('Session key not available yet. Initializing...');
			// Try to initialize session key
			if (evmWallet.initializeSession) {
				await evmWallet.initializeSession(evmWallet.evmAddress);
				// Wait a bit for session key to be set
				await new Promise((resolve) => setTimeout(resolve, 1000));
			} else {
				setProfileError('Session key not ready. Please wait a moment and try again.');
				return;
			}
		}

		setProfileCreating(true);
		setProfileError(null);

		try {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'BazarBridge/index.tsx:175',
					message: 'handleCreateEthProfile: Starting profile creation',
					data: { evmAddress: evmWallet.evmAddress, hasSessionKey: !!evmWallet.sessionKey },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'BB2',
				}),
			}).catch(() => {});
			// #endregion

			console.log('Creating profile for ETH wallet:', evmWallet.evmAddress);
			const result = await createProfile({
				walletAddress: evmWallet.evmAddress,
				walletType: 'evm',
				displayName: `ETH User ${evmWallet.evmAddress.slice(0, 6)}`,
			});

			if (result.success && result.profileId) {
				console.log('Profile created successfully:', result.profileId);
				// Cache the profile ID to prevent duplicate creation
				const cacheKey = `ethProfile_${evmWallet.evmAddress.toLowerCase()}`;
				localStorage.setItem(cacheKey, result.profileId);
				setEthProfile(result.profileId);
				setSteps({
					profileCreation: 'completed',
					bridgeAssets: 'active',
					delegation: 'pending',
				});
			} else {
				const errorMsg = result.error || 'Failed to create profile';
				console.error('Failed to create profile:', errorMsg);
				setProfileError(errorMsg);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
			console.error('Profile creation error:', error);
			setProfileError(errorMsg);
		} finally {
			setProfileCreating(false);
		}
	};

	const hasArweaveWallet = !!arProvider.walletAddress;
	const hasEvmWallet = evmWallet.isConnected;
	const hasProfile = !!permawebProvider.profile?.id || !!ethProfile;

	const currentWalletAddress = arProvider.walletAddress || evmWallet.evmAddress;
	const currentWalletType = arProvider.walletAddress ? 'arweave' : evmWallet.evmAddress ? 'evm' : null;

	const formatSessionExpiry = (expiry: number) => {
		const date = new Date(expiry);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	};

	const handleRefreshSessionKey = () => {
		if (evmWallet.evmAddress) {
			evmWallet.clearSession();
			evmWallet.initializeSession(evmWallet.evmAddress);
		}
	};

	return (
		<S.Wrapper>
			<S.Header>
				<S.Title>Bazar Bridge</S.Title>
				<S.Subtitle>Connect with Ethereum, create your profile, and bridge assets to AO</S.Subtitle>
			</S.Header>

			{/* Progress Steps */}
			<S.StepsContainer>
				<S.Step status={steps.profileCreation}>
					<S.StepNumber status={steps.profileCreation}>
						{steps.profileCreation === 'completed' ? '✓' : '1'}
					</S.StepNumber>
					<S.StepContent>
						<S.StepTitle>Create Profile</S.StepTitle>
						<S.StepDesc>Connect wallet & create Zone profile</S.StepDesc>
					</S.StepContent>
				</S.Step>

				<S.StepConnector status={steps.bridgeAssets} />

				<S.Step status={steps.bridgeAssets}>
					<S.StepNumber status={steps.bridgeAssets}>{steps.bridgeAssets === 'completed' ? '✓' : '2'}</S.StepNumber>
					<S.StepContent>
						<S.StepTitle>Bridge Assets</S.StepTitle>
						<S.StepDesc>Deposit ETH, DAI, stETH, or USDS</S.StepDesc>
					</S.StepContent>
				</S.Step>

				<S.StepConnector status={steps.delegation} />

				<S.Step status={steps.delegation}>
					<S.StepNumber status={steps.delegation}>{steps.delegation === 'completed' ? '✓' : '3'}</S.StepNumber>
					<S.StepContent>
						<S.StepTitle>Delegate to PIXL</S.StepTitle>
						<S.StepDesc>Earn rewards on your AO tokens</S.StepDesc>
					</S.StepContent>
				</S.Step>
			</S.StepsContainer>

			{/* Step 1: Profile Creation */}
			<S.StepSection active={steps.profileCreation === 'active'}>
				<S.SectionTitle>Step 1: Create Your Profile</S.SectionTitle>
				<S.WalletGrid>
					{/* Arweave Wallet Card */}
					<S.WalletCard>
						<S.WalletCardHeader>
							<S.WalletCardTitle>Arweave Wallet</S.WalletCardTitle>
							<S.OptionalBadge>Option A</S.OptionalBadge>
						</S.WalletCardHeader>
						<S.WalletCardBody>
							{hasArweaveWallet ? (
								<>
									<S.ConnectedStatus>
										<S.StatusIcon>✅</S.StatusIcon>
										<S.StatusText>Connected</S.StatusText>
									</S.ConnectedStatus>
									<S.WalletAddress>{arProvider.walletAddress.slice(0, 12)}...</S.WalletAddress>
									{permawebProvider.profile?.id && (
										<S.ProfileInfo>
											<S.ProfileLabel>Profile:</S.ProfileLabel>
											<S.ProfileName>
												{permawebProvider.profile.DisplayName || permawebProvider.profile.Username || 'Anonymous'}
											</S.ProfileName>
										</S.ProfileInfo>
									)}
									{permawebProvider.profile?.id && (
										<Button
											type={'primary'}
											label={language.editProfile}
											handlePress={() => setProfileEditOpen(true)}
											height={35}
										/>
									)}
									<Button
										type={'alt2'}
										label={language.disconnect}
										handlePress={arProvider.handleDisconnect}
										height={35}
									/>
								</>
							) : (
								<>
									<S.DisconnectedStatus>
										<S.StatusIcon>⏳</S.StatusIcon>
										<S.StatusText>Not Connected</S.StatusText>
									</S.DisconnectedStatus>
									<S.WalletDescription>
										Connect your Arweave wallet (Wander, Beacon, Othent) to create a profile and use BazAR.
									</S.WalletDescription>
									<Button
										type={'primary'}
										label={'Connect Arweave Wallet'}
										handlePress={() => arProvider.setWalletModalVisible(true)}
										height={40}
									/>
								</>
							)}
						</S.WalletCardBody>
					</S.WalletCard>

					{/* EVM Wallet Card */}
					<S.WalletCard>
						<S.WalletCardHeader>
							<S.WalletCardTitle>Ethereum Wallet</S.WalletCardTitle>
							<S.OptionalBadge>Option B</S.OptionalBadge>
						</S.WalletCardHeader>
						<S.WalletCardBody>
							{hasEvmWallet ? (
								<>
									<S.ConnectedStatus>
										<S.StatusIcon>✅</S.StatusIcon>
										<S.StatusText>Connected</S.StatusText>
									</S.ConnectedStatus>
									<S.WalletAddress>{evmWallet.evmAddress?.slice(0, 12)}...</S.WalletAddress>
									{evmWallet.evmBalance && (
										<S.BalanceInfo>
											<S.BalanceLabel>Balance:</S.BalanceLabel>
											<S.BalanceAmount>{parseFloat(evmWallet.evmBalance).toFixed(4)} ETH</S.BalanceAmount>
										</S.BalanceInfo>
									)}
									{evmWallet.sessionKey && (
										<S.SessionKeyInfo>
											<S.SessionKeyIcon>🔑</S.SessionKeyIcon>
											<div>
												<S.SessionKeyLabel>{language.sessionActive}</S.SessionKeyLabel>
												<S.SessionKeyExpiry>
													{language.expires}: {formatSessionExpiry(evmWallet.sessionKey.expiry)}
												</S.SessionKeyExpiry>
											</div>
											<Button
												type={'alt2'}
												label={language.refreshSessionKey}
												handlePress={handleRefreshSessionKey}
												height={30}
											/>
										</S.SessionKeyInfo>
									)}

									{ethProfile && (
										<S.ProfileInfo>
											<S.ProfileLabel>Profile:</S.ProfileLabel>
											<S.ProfileName>{ethProfile.slice(0, 8)}...</S.ProfileName>
										</S.ProfileInfo>
									)}

									{ethProfile && (
										<Button
											type={'primary'}
											label={language.editProfile}
											handlePress={() => setProfileEditOpen(true)}
											height={35}
										/>
									)}

									{!ethProfile && !profileCreating && (
										<Button
											type={'primary'}
											label={'Create BazAR Profile'}
											handlePress={handleCreateEthProfile}
											height={40}
											disabled={profileCreating}
										/>
									)}

									{profileCreating && <Loader />}

									{profileError && <S.ErrorMessage>{profileError}</S.ErrorMessage>}

									<ConnectButton accountStatus="full" chainStatus="icon" showBalance={false} />
								</>
							) : (
								<>
									<S.DisconnectedStatus>
										<S.StatusIcon>⏳</S.StatusIcon>
										<S.StatusText>Not Connected</S.StatusText>
									</S.DisconnectedStatus>
									<S.WalletDescription>
										Connect your Ethereum wallet (MetaMask, Coinbase, etc.) to create a profile and bridge assets. A
										session key will be created for seamless transactions.
									</S.WalletDescription>
									<S.RainbowButtonWrapper>
										<ConnectButton label="Connect Ethereum Wallet" />
									</S.RainbowButtonWrapper>
								</>
							)}
						</S.WalletCardBody>
					</S.WalletCard>
				</S.WalletGrid>

				{(hasArweaveWallet || hasEvmWallet) && !hasProfile && (
					<S.InfoBox>
						<S.InfoIcon>ℹ️</S.InfoIcon>
						<S.InfoText>
							<strong>New to BazAR?</strong> You need a Zone profile to upload assets, trade tokens, and participate in
							the marketplace.{' '}
							{hasEvmWallet &&
								!ethProfile &&
								'Click "Create BazAR Profile" above to get started with your Ethereum wallet!'}
						</S.InfoText>
					</S.InfoBox>
				)}
			</S.StepSection>

			{/* Step 2: Bridge Assets */}
			{hasProfile && (
				<S.StepSection active={steps.bridgeAssets === 'active'}>
					<S.SectionTitle>Step 2: Bridge Assets to AO</S.SectionTitle>
					<S.BridgeCard>
						<S.BridgeInfo>
							<S.BridgeTitle>Supported Assets</S.BridgeTitle>
							<S.BridgeAssetList>
								<S.BridgeAssetItem>
									<S.AssetIcon>Ξ</S.AssetIcon>
									<S.AssetName>ETH</S.AssetName>
								</S.BridgeAssetItem>
								<S.BridgeAssetItem>
									<S.AssetIcon>💵</S.AssetIcon>
									<S.AssetName>DAI</S.AssetName>
								</S.BridgeAssetItem>
								<S.BridgeAssetItem>
									<S.AssetIcon>🔥</S.AssetIcon>
									<S.AssetName>stETH</S.AssetName>
								</S.BridgeAssetItem>
								<S.BridgeAssetItem>
									<S.AssetIcon>💲</S.AssetIcon>
									<S.AssetName>USDS</S.AssetName>
								</S.BridgeAssetItem>
							</S.BridgeAssetList>

							<S.BridgeDescription>
								Bridge your assets from Ethereum to AO using AOX. Your bridged assets will appear in your BazAR profile
								and earn yield automatically.
							</S.BridgeDescription>

							<S.BridgeFeatures>
								<S.FeatureItem>
									<S.FeatureIcon>✨</S.FeatureIcon>
									<S.FeatureText>Automatic AO yield generation</S.FeatureText>
								</S.FeatureItem>
								<S.FeatureItem>
									<S.FeatureIcon>🔒</S.FeatureIcon>
									<S.FeatureText>Secure cross-chain bridge</S.FeatureText>
								</S.FeatureItem>
								<S.FeatureItem>
									<S.FeatureIcon>⚡</S.FeatureIcon>
									<S.FeatureText>Fast and efficient transfers</S.FeatureText>
								</S.FeatureItem>
							</S.BridgeFeatures>

							<a href={REDIRECTS.aox} target="_blank" rel="noopener noreferrer">
								<Button type={'primary'} label={'Open AOX Bridge'} handlePress={() => {}} height={50} />
							</a>

							<S.BridgeNote>
								<strong>Note:</strong> You'll be redirected to AOX (aox.arweave.net) to complete the bridge transaction.
								Make sure to enter your {hasEvmWallet && ethProfile ? 'Ethereum' : 'Arweave'} address as the recipient.
							</S.BridgeNote>
						</S.BridgeInfo>
					</S.BridgeCard>
				</S.StepSection>
			)}

			{/* Step 3: Delegation */}
			{hasProfile && (
				<S.StepSection active={steps.delegation === 'active'}>
					<S.SectionTitle>Step 3: Delegate to PIXL</S.SectionTitle>
					<S.DelegationCard>
						<S.DelegationInfo>
							<S.DelegationTitle>Earn PIXL Rewards</S.DelegationTitle>
							<S.DelegationDescription>
								Delegate your AO tokens to the PIXL protocol and earn rewards. PIXL is BazAR's fair launch token with a
								fixed supply.
							</S.DelegationDescription>

							<S.DelegationFeatures>
								<S.FeatureItem>
									<S.FeatureIcon>💰</S.FeatureIcon>
									<S.FeatureText>Earn PIXL rewards on your AO balance</S.FeatureText>
								</S.FeatureItem>
								<S.FeatureItem>
									<S.FeatureIcon>📈</S.FeatureIcon>
									<S.FeatureText>Participate in BazAR governance</S.FeatureText>
								</S.FeatureItem>
								<S.FeatureItem>
									<S.FeatureIcon>🎯</S.FeatureIcon>
									<S.FeatureText>Support the BazAR ecosystem</S.FeatureText>
								</S.FeatureItem>
							</S.DelegationFeatures>

							{currentWalletAddress && currentWalletType && (
								<>
									<S.DelegationButtonWrapper>
										<Button
											type={'primary'}
											label={language.manageDelegation}
											handlePress={() => setDelegationPanelOpen(true)}
											height={50}
										/>
									</S.DelegationButtonWrapper>
									<S.DelegationNote>
										<strong>Note:</strong> You can delegate your AO tokens to PIXL to earn rewards. The delegation panel
										allows you to manage your delegation preferences and view your current delegations.
									</S.DelegationNote>
								</>
							)}

							<S.LearnMoreLink
								href={`${REDIRECTS.docs}overview/pixl-fair-launch`}
								target="_blank"
								rel="noopener noreferrer"
							>
								Learn about PIXL Fair Launch →
							</S.LearnMoreLink>
						</S.DelegationInfo>
					</S.DelegationCard>
				</S.StepSection>
			)}

			{/* Profile Edit Modal */}
			{profileEditOpen && (
				<Panel
					open={profileEditOpen}
					header={
						permawebProvider.profile && permawebProvider.profile.id
							? language.editProfile
							: `${language.createProfile}!`
					}
					handleClose={() => setProfileEditOpen(false)}
					width={555}
					closeHandlerDisabled
				>
					<S.ProfileManageWrapper>
						<ProfileManage
							profile={permawebProvider.profile && permawebProvider.profile.id ? permawebProvider.profile : null}
							handleClose={() => setProfileEditOpen(false)}
							handleUpdate={() => {
								permawebProvider.refreshProfile();
							}}
						/>
					</S.ProfileManageWrapper>
				</Panel>
			)}

			{/* Delegation Panel - Note: Currently uses Arweave wallet signer, ETH support coming soon */}
			{delegationPanelOpen && currentWalletAddress && (
				<S.DelegationPanelWrapper>
					{/* TODO: Update DelegationPanel to support both wallet types */}
					{/* For now, only show for Arweave wallets */}
					{arProvider.walletAddress ? (
						<S.DelegationPanelContent>
							<S.DelegationPanelNote>
								Delegation panel will open here. Currently requires Arweave wallet connection.
							</S.DelegationPanelNote>
							<Button
								type={'alt2'}
								label={language.close}
								handlePress={() => setDelegationPanelOpen(false)}
								height={40}
							/>
						</S.DelegationPanelContent>
					) : (
						<S.DelegationPanelContent>
							<S.DelegationPanelNote>
								ETH wallet delegation coming soon! For now, please use the delegation button in the header with an
								Arweave wallet.
							</S.DelegationPanelNote>
							<Button
								type={'alt2'}
								label={language.close}
								handlePress={() => setDelegationPanelOpen(false)}
								height={40}
							/>
						</S.DelegationPanelContent>
					)}
				</S.DelegationPanelWrapper>
			)}

			{/* FAQ Section */}
			<S.FeatureSection>
				<S.SectionTitle>Frequently Asked Questions</S.SectionTitle>
				<S.FaqCard>
					<S.FaqItem>
						<S.FaqQuestion>Can I use my Ethereum wallet with BazAR?</S.FaqQuestion>
						<S.FaqAnswer>
							Yes! You can now create a BazAR profile with your Ethereum wallet (MetaMask, Coinbase, etc.). Your ETH
							address will own the profile, and you'll have full access to upload assets, trade tokens, and participate
							in the marketplace.
						</S.FaqAnswer>
					</S.FaqItem>
					<S.FaqItem>
						<S.FaqQuestion>What are session keys?</S.FaqQuestion>
						<S.FaqAnswer>
							Session keys allow you to sign transactions without repeated MetaMask popups. They expire after 7 days for
							security and are created automatically when you connect your Ethereum wallet.
						</S.FaqAnswer>
					</S.FaqItem>
					<S.FaqItem>
						<S.FaqQuestion>What assets can I bridge?</S.FaqQuestion>
						<S.FaqAnswer>
							You can bridge ETH, DAI, stETH, and USDS from Ethereum to AO. Your bridged assets will automatically earn
							yield on the AO network and can be used throughout the BazAR ecosystem.
						</S.FaqAnswer>
					</S.FaqItem>
					<S.FaqItem>
						<S.FaqQuestion>What is PIXL?</S.FaqQuestion>
						<S.FaqAnswer>
							PIXL is BazAR's fair launch protocol token with a fixed supply. Users earn PIXL by collecting, trading,
							stamping assets, and delegating their AO tokens. Learn more in our docs.
						</S.FaqAnswer>
					</S.FaqItem>
					<S.FaqItem>
						<S.FaqQuestion>Do I need both Arweave and Ethereum wallets?</S.FaqQuestion>
						<S.FaqAnswer>
							No! You can choose either. Connect an Arweave wallet (Wander, Beacon, Othent) OR an Ethereum wallet
							(MetaMask, etc.). Both can create profiles and use all BazAR features.
						</S.FaqAnswer>
					</S.FaqItem>
				</S.FaqCard>
			</S.FeatureSection>
		</S.Wrapper>
	);
}
