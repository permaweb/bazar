import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { Avatar } from 'components/atoms/Avatar';
import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { AO, ASSETS, REDIRECTS, URLS } from 'helpers/config';
import { checkExistingProfile, createProfile } from 'helpers/profileCreation';
import { formatAddress, getTotalTokenBalance } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useCustomThemeProvider } from 'providers/CustomThemeProvider';
import { useEvmWallet } from 'providers/EvmWalletProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { useTokenProvider } from 'providers/TokenProvider';

import * as S from './styles';

export default function WalletConnect(_props: { callback?: () => void }) {
	const navigate = useNavigate();

	const { availableTokens } = useTokenProvider();
	const arProvider = useArweaveProvider();
	const evmWallet = useEvmWallet();
	const permawebProvider = usePermawebProvider();

	const themeProvider = useCustomThemeProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [showWallet, setShowWallet] = React.useState<boolean>(false);
	const [showWalletDropdown, setShowWalletDropdown] = React.useState<boolean>(false);
	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);
	const [ethProfileId, setEthProfileId] = React.useState<string | null>(null);
	const [ethProfile, setEthProfile] = React.useState<any | null>(null);
	const [checkingEthProfile, setCheckingEthProfile] = React.useState<boolean>(false);
	const [creatingEthProfile, setCreatingEthProfile] = React.useState<boolean>(false);

	const [copiedWalletAddress, setCopiedWalletAddress] = React.useState<boolean>(false);
	const [copiedProfileId, setCopiedProfileId] = React.useState<boolean>(false);
	const [label, setLabel] = React.useState<string | null>(null);
	const [isSystemTheme, setIsSystemTheme] = React.useState<boolean>(
		!localStorage.getItem('preferredTheme') || localStorage.getItem('isSystemTheme') === 'true'
	);

	// Check for existing ETH profile when ETH wallet connects
	React.useEffect(() => {
		if (evmWallet.evmAddress && !arProvider.walletAddress) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'WalletConnect.tsx:50',
					message: 'useEffect: Checking for ETH profile on mount',
					data: { evmAddress: evmWallet.evmAddress, currentEthProfileId: ethProfileId },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'V',
				}),
			}).catch(() => {});
			// #endregion
			checkForEthProfile();
		} else {
			setEthProfileId(null);
			setEthProfile(null);
		}
	}, [evmWallet.evmAddress, arProvider.walletAddress]);

	// Fetch ETH profile data when ethProfileId is set
	React.useEffect(() => {
		if (ethProfileId && !arProvider.walletAddress && permawebProvider.libs) {
			(async () => {
				try {
					// #region agent log
					fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							location: 'WalletConnect.tsx:60',
							message: 'Fetching ETH profile data',
							data: { ethProfileId },
							timestamp: Date.now(),
							sessionId: 'debug-session',
							runId: 'run1',
							hypothesisId: 'S',
						}),
					}).catch(() => {});
					// #endregion

					const fetchedProfile = await permawebProvider.libs.getProfileById(ethProfileId);

					// #region agent log
					fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							location: 'WalletConnect.tsx:65',
							message: 'ETH profile data fetched',
							data: {
								profileId: fetchedProfile?.id,
								username: fetchedProfile?.Username,
								displayName: fetchedProfile?.DisplayName,
							},
							timestamp: Date.now(),
							sessionId: 'debug-session',
							runId: 'run1',
							hypothesisId: 'S',
						}),
					}).catch(() => {});
					// #endregion

					if (fetchedProfile) {
						setEthProfile(fetchedProfile);
					}
				} catch (error) {
					console.warn('Failed to fetch ETH profile data:', error);
				}
			})();
		} else if (!ethProfileId) {
			setEthProfile(null);
		}
	}, [ethProfileId, arProvider.walletAddress, permawebProvider.libs]);

	React.useEffect(() => {
		setTimeout(() => {
			setShowWallet(true);
		}, 200);
	}, [arProvider.walletAddress, evmWallet.evmAddress]);

	React.useEffect(() => {
		if (!isSystemTheme) return;

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
			const newTheme = e.matches ? 'dark' : 'light';
			themeProvider.setCurrent(newTheme);
		};

		// Set initial theme
		handleChange(mediaQuery);

		// Listen for changes
		mediaQuery.addEventListener('change', handleChange);

		return () => {
			mediaQuery.removeEventListener('change', handleChange);
		};
	}, [isSystemTheme, themeProvider]);

	React.useEffect(() => {
		if (!showWallet) {
			setLabel(`${language.fetching}...`);
		} else {
			if (arProvider.walletAddress) {
				// Priority: ArNS name > Profile username > Address
				if (permawebProvider.arnsPrimaryName) {
					setLabel(permawebProvider.arnsPrimaryName);
				} else if (permawebProvider.profile && permawebProvider.profile.username) {
					setLabel(permawebProvider.profile.username);
				} else {
					setLabel(formatAddress(arProvider.walletAddress, false));
				}
			} else if (evmWallet.evmAddress) {
				// ETH wallet connected
				// Priority: Profile username > Profile display name > Address
				if (ethProfile && ethProfile.Username) {
					setLabel(ethProfile.Username);
				} else if (ethProfile && ethProfile.DisplayName) {
					setLabel(ethProfile.DisplayName);
				} else {
					setLabel(formatAddress(evmWallet.evmAddress, false));
				}
			} else {
				setLabel(language.connect);
			}
		}
	}, [
		showWallet,
		arProvider.walletAddress,
		evmWallet.evmAddress,
		ethProfileId,
		ethProfile,
		permawebProvider.profile,
		permawebProvider.arnsPrimaryName,
	]);

	async function checkForEthProfile() {
		if (!evmWallet.evmAddress) return;

		// Check localStorage first
		const cacheKey = `ethProfile_${evmWallet.evmAddress.toLowerCase()}`;
		const cachedProfileId = localStorage.getItem(cacheKey);

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'WalletConnect.tsx:110',
				message: 'checkForEthProfile: Checking localStorage',
				data: {
					cacheKey,
					cachedProfileId,
					allKeys: Object.keys(localStorage).filter((k) => k.startsWith('ethProfile_')),
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'V',
			}),
		}).catch(() => {});
		// #endregion

		if (cachedProfileId) {
			console.log('Found cached profile in checkForEthProfile:', cachedProfileId);
			setEthProfileId(cachedProfileId);
			return;
		}

		setCheckingEthProfile(true);
		try {
			const existingProfileId = await checkExistingProfile(evmWallet.evmAddress);
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'WalletConnect.tsx:125',
					message: 'checkForEthProfile: Registry check result',
					data: { existingProfileId },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'V',
				}),
			}).catch(() => {});
			// #endregion

			if (existingProfileId) {
				// Cache it for future use
				localStorage.setItem(cacheKey, existingProfileId);
				setEthProfileId(existingProfileId);
				// Profile will be fetched automatically by the useEffect that watches ethProfileId
			}
		} catch (error) {
			console.error('Error checking for ETH profile:', error);
		} finally {
			setCheckingEthProfile(false);
		}
	}

	async function handleCreateEthProfile() {
		if (!evmWallet.evmAddress) {
			console.error('No ETH wallet address available');
			return;
		}

		// First, check localStorage for recently created profiles (to prevent immediate duplicates)
		const cacheKey = `ethProfile_${evmWallet.evmAddress.toLowerCase()}`;
		const cachedProfileId = localStorage.getItem(cacheKey);

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'WalletConnect.tsx:142',
				message: 'Checking localStorage in handleCreateEthProfile',
				data: {
					cacheKey,
					cachedProfileId,
					allKeys: Object.keys(localStorage).filter((k) => k.startsWith('ethProfile_')),
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'U',
			}),
		}).catch(() => {});
		// #endregion

		if (cachedProfileId) {
			console.log('Found cached profile ID:', cachedProfileId);
			setEthProfileId(cachedProfileId);
			setTimeout(() => {
				setShowProfileManage(true);
			}, 500);
			return;
		}

		// First, check if a profile already exists
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'WalletConnect.tsx:126',
				message: 'handleCreateEthProfile called',
				data: { evmAddress: evmWallet.evmAddress, currentEthProfileId: ethProfileId, cachedProfileId },
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'S',
			}),
		}).catch(() => {});
		// #endregion

		try {
			const existingProfileId = await checkExistingProfile(evmWallet.evmAddress);
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'WalletConnect.tsx:132',
					message: 'Checked for existing profile',
					data: { existingProfileId, currentEthProfileId: ethProfileId },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'S',
				}),
			}).catch(() => {});
			// #endregion

			if (existingProfileId) {
				console.log('Profile already exists:', existingProfileId);
				// Cache it for future use
				localStorage.setItem(cacheKey, existingProfileId);
				setEthProfileId(existingProfileId);
				// Open profile edit modal instead of creating
				setTimeout(() => {
					setShowProfileManage(true);
				}, 500);
				return;
			}
		} catch (checkError) {
			console.warn('Error checking for existing profile (will proceed with creation):', checkError);
			// Continue with creation if check fails
		}

		// Check if session key is available
		if (!evmWallet.sessionKey) {
			console.error('Session key not available yet. Please wait...');
			// Try to initialize session key
			if (evmWallet.initializeSession) {
				await evmWallet.initializeSession(evmWallet.evmAddress);
				// Wait a bit for session key to be set
				await new Promise((resolve) => setTimeout(resolve, 1000));
			} else {
				alert('Session key not ready. Please wait a moment and try again.');
				return;
			}
		}

		setCreatingEthProfile(true);
		try {
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

				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'WalletConnect.tsx:205',
						message: 'Saved profile to localStorage',
						data: { cacheKey, profileId: result.profileId },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'U',
					}),
				}).catch(() => {});
				// #endregion

				setEthProfileId(result.profileId);
				// Profile will be fetched automatically by the useEffect that watches ethProfileId
				// Open profile edit modal after creation
				setTimeout(() => {
					setShowProfileManage(true);
				}, 500);
			} else {
				const errorMsg = result.error || 'Failed to create profile';
				console.error('Failed to create profile:', errorMsg);
				alert(`Failed to create profile: ${errorMsg}`);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
			console.error('Error creating ETH profile:', error);
			alert(`Error creating profile: ${errorMsg}`);
		} finally {
			setCreatingEthProfile(false);
		}
	}

	async function handlePress() {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'WalletConnect.tsx:196',
				message: 'handlePress called',
				data: {
					hasArweave: !!arProvider.walletAddress,
					hasEvm: !!evmWallet.evmAddress,
					ethProfileId,
					isConnected: evmWallet.isConnected,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'T',
			}),
		}).catch(() => {});
		// #endregion

		// If wallet is connected, don't show connect modal
		if (arProvider.walletAddress || (evmWallet.evmAddress && ethProfileId)) {
			setShowWalletDropdown(!showWalletDropdown);
		} else if (evmWallet.evmAddress && !ethProfileId) {
			// ETH wallet connected but no profile - check localStorage first, then registry
			const cacheKey = `ethProfile_${evmWallet.evmAddress.toLowerCase()}`;
			const cachedProfileId = localStorage.getItem(cacheKey);

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'WalletConnect.tsx:210',
					message: 'Checking localStorage cache',
					data: {
						cacheKey,
						cachedProfileId,
						allKeys: Object.keys(localStorage).filter((k) => k.startsWith('ethProfile_')),
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'U',
				}),
			}).catch(() => {});
			// #endregion

			if (cachedProfileId) {
				console.log('Found cached profile in handlePress:', cachedProfileId);
				setEthProfileId(cachedProfileId);
				setShowWalletDropdown(true);
				return;
			}

			// Quick check: if we just created a profile, it might not be in state yet
			try {
				const existingProfileId = await checkExistingProfile(evmWallet.evmAddress);
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'WalletConnect.tsx:204',
						message: 'Quick profile check in handlePress',
						data: { existingProfileId, currentEthProfileId: ethProfileId, cachedProfileId },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'T',
					}),
				}).catch(() => {});
				// #endregion

				if (existingProfileId) {
					// Profile exists, cache it, set it and open dropdown
					localStorage.setItem(cacheKey, existingProfileId);
					setEthProfileId(existingProfileId);
					setShowWalletDropdown(true);
				} else {
					// No profile found, create one (handleCreateEthProfile will also check)
					handleCreateEthProfile();
				}
			} catch (checkError) {
				// If check fails, proceed with creation (handleCreateEthProfile will also check)
				console.warn('Quick profile check failed, proceeding with creation:', checkError);
				handleCreateEthProfile();
			}
		} else if (!evmWallet.isConnected && !arProvider.walletAddress) {
			// Only show connect modal if wallet is actually not connected
			arProvider.setWalletModalVisible(true);
		} else {
			// Wallet connected but no profile - should have been handled above
			setShowWalletDropdown(true);
		}
	}

	function handleDropdownAction(callback?: () => void) {
		setTimeout(() => {
			callback?.();
			setShowWalletDropdown(false);
		}, 200);
	}

	function handleProfileAction() {
		if (permawebProvider.profile && permawebProvider.profile.id) {
			navigate(URLS.profileAssets(permawebProvider.profile.id));
		} else if (ethProfileId) {
			// ETH profile exists - navigate to profile page (same as Arweave)
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'WalletConnect.tsx:315',
					message: 'handleProfileAction: Navigating to ETH profile page',
					data: { ethProfileId },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run2',
					hypothesisId: 'H',
				}),
			}).catch(() => {});
			// #endregion
			navigate(URLS.profileAssets(ethProfileId));
		} else {
			// No profile - open create profile modal
			setShowProfileManage(true);
		}
	}

	const copyWalletAddress = React.useCallback(async () => {
		if (arProvider.walletAddress) {
			await navigator.clipboard.writeText(arProvider.walletAddress);
			setCopiedWalletAddress(true);
			setTimeout(() => setCopiedWalletAddress(false), 2000);
		}
	}, [arProvider.walletAddress]);

	const copyProfileId = React.useCallback(async () => {
		const profileId = permawebProvider.profile?.id || ethProfileId;
		if (profileId) {
			await navigator.clipboard.writeText(profileId);
			setCopiedProfileId(true);
			setTimeout(() => setCopiedProfileId(false), 2000);
		}
	}, [permawebProvider.profile?.id, ethProfileId]);

	function handleThemeChange(theme: 'light' | 'dark' | 'dimmed') {
		setIsSystemTheme(false);
		localStorage.setItem('isSystemTheme', 'false');
		themeProvider.setCurrent(theme);
	}

	function handleSystemTheme() {
		setIsSystemTheme(true);
		localStorage.setItem('isSystemTheme', 'true');
		const preferredTheme =
			window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		themeProvider.setCurrent(preferredTheme);
	}

	function handleDisconnect() {
		setShowWalletDropdown(false);
		if (arProvider.walletAddress) {
			arProvider.handleDisconnect();
		}
		// Note: ETH wallet disconnection is handled by RainbowKit's ConnectButton
		// We just need to clear local state
		setEthProfileId(null);
	}

	const tokenLinks = {
		[AO.defaultToken]: {
			link: REDIRECTS.aox,
			label: language.getWrappedAr,
			target: '_blank',
		},
		[AO.pixl]: {
			link: `${URLS.asset}${AO.pixl}`,
			label: language.tradePixl,
			target: '',
		},
		[AO.wndr]: {
			link: `${URLS.asset}${AO.wndr}`,
			label: language.tradeWander,
			target: '',
		},
		[AO.pi]: {
			link: `${URLS.asset}${AO.pi}`,
			label: language.tradePi,
			target: '',
		},
		[AO.ao]: {
			link: `${URLS.asset}${AO.ao}`,
			label: language.tradeAO,
			target: '',
		},
		[AO.ario]: {
			link: `${URLS.asset}${AO.ario}`,
			label: language.tradeArio,
			target: '',
		},
		[AO.usda]: {
			link: `${URLS.asset}${AO.usda}`,
			label: language.tradeUsda,
			target: '',
		},
		[AO.game]: {
			link: `${URLS.asset}${AO.game}`,
			label: language.tradeGame,
			target: '',
		},
		[AO.stamps]: {
			link: `${URLS.asset}${AO.stamps}`,
			label: language.tradeStamp,
			target: '',
		},
	};

	function getDropdown() {
		return (
			<>
				<S.DHeaderWrapper>
					<S.DHeaderFlex>
						<Avatar
							owner={permawebProvider.profile}
							dimensions={{ wrapper: 35, icon: 21.5 }}
							callback={() => handleDropdownAction(handleProfileAction)}
						/>
						<S.DHeader>
							<S.DNameWrapper>
								<p onClick={() => handleDropdownAction(handleProfileAction)}>{label}</p>
								{/* {arProvider.vouch?.isVouched && (
									<div id={'vouch-check'}>
										<ReactSVG src={ASSETS.checkmark} />
										<S.Tooltip className={'info-text'} useBottom={true}>
											<span>{language.userConnectedVouched}</span>
										</S.Tooltip>
									</div>
								)} */}
							</S.DNameWrapper>
							{/* <span onClick={() => handleDropdownAction(handleProfileAction)}>
								{permawebProvider.arnsPrimaryName
									? formatAddress(arProvider.walletAddress, false)
									: formatAddress(
											permawebProvider.profile && permawebProvider.profile.id
												? permawebProvider.profile.id
												: arProvider.walletAddress,
											false
									  )}
							</span> */}
						</S.DHeader>
					</S.DHeaderFlex>
				</S.DHeaderWrapper>
				<S.DBalancesWrapper>
					<S.DBalancesHeaderWrapper>
						<p>Token Balances</p>
						{!permawebProvider.allTokensLoaded && (
							<Button
								type={'alt3'}
								label={'Show More'}
								handlePress={() => permawebProvider.loadAllTokens()}
								height={30}
							/>
						)}
					</S.DBalancesHeaderWrapper>
					{/* <S.BalanceLine>
						<ReactSVG src={ASSETS.ar} />
						<span>{formatCount(arProvider.arBalance ? arProvider.arBalance.toString() : '0')}</span>
						<S.TokenLink>
							<Link
								to={'https://viewblock.io/arweave/'}
								target={'_blank'}
								onClick={() => handleDropdownAction(() => setShowWalletDropdown(false))}
							>
								<span>{language.viewAr}</span>
							</Link>
						</S.TokenLink>
					</S.BalanceLine> */}
					{availableTokens && (
						<>
							{availableTokens
								.filter((token: any) => {
									// Only show tokens that have been loaded (have balance data)
									return permawebProvider.tokenBalances && permawebProvider.tokenBalances[token.id];
								})
								.map((token: any) => {
									return (
										<S.BalanceLine key={token.id}>
											<CurrencyLine
												amount={getTotalTokenBalance(permawebProvider.tokenBalances[token.id])}
												currency={token.id}
												callback={() => handleDropdownAction(() => setShowWalletDropdown(false))}
											/>
											{tokenLinks[token.id] && (
												<S.TokenLink>
													<Link
														to={tokenLinks[token.id].link}
														target={tokenLinks[token.id].target}
														onClick={() => handleDropdownAction(() => setShowWalletDropdown(false))}
													>
														<span>{tokenLinks[token.id].label}</span>
													</Link>
												</S.TokenLink>
											)}
										</S.BalanceLine>
									);
								})}
						</>
					)}
				</S.DBalancesWrapper>
				<S.DBodyWrapper>
					<li onClick={copyWalletAddress}>
						<ReactSVG src={ASSETS.wallet} />
						{copiedWalletAddress ? `${language.copied}!` : language.copyWalletAddress}
					</li>
					<li onClick={() => handleDropdownAction(handleProfileAction)}>
						{(permawebProvider.profile && permawebProvider.profile.id) || ethProfileId ? (
							<>
								<ReactSVG src={ASSETS.user} />
								{`${language.viewProfile}`}
							</>
						) : (
							<>
								<ReactSVG src={ASSETS.edit} />
								{`${language.createProfile}`}
							</>
						)}
					</li>
					{((permawebProvider.profile && permawebProvider.profile.id) || ethProfileId) && (
						<>
							<li onClick={() => handleDropdownAction(() => setShowProfileManage(true))}>
								<ReactSVG src={ASSETS.edit} />
								{language.editProfile}
							</li>
							<li onClick={copyProfileId}>
								<ReactSVG src={ASSETS.copy} />
								{copiedProfileId ? `${language.copied}!` : language.copyProfileId}
							</li>
						</>
					)}
				</S.DBodyWrapper>
				<S.DBodyWrapper>
					<p>Appearance</p>
					<li onClick={handleSystemTheme} className={isSystemTheme ? 'active' : ''}>
						<ReactSVG src={ASSETS.system} /> {`System`}
					</li>
					<li
						onClick={() => handleThemeChange('light')}
						className={!isSystemTheme && themeProvider.current === 'light' ? 'active' : ''}
					>
						<ReactSVG src={ASSETS.light} /> {`Light`}
					</li>
					<li
						onClick={() => handleThemeChange('dimmed')}
						className={!isSystemTheme && themeProvider.current === 'dimmed' ? 'active' : ''}
					>
						<ReactSVG src={ASSETS.dim} /> {`Dimmed`}
					</li>
					<li
						onClick={() => handleThemeChange('dark')}
						className={!isSystemTheme && themeProvider.current === 'dark' ? 'active' : ''}
					>
						<ReactSVG src={ASSETS.dark} /> {`Dark`}
					</li>
				</S.DBodyWrapper>
				<S.DFooterWrapper>
					<li onClick={handleDisconnect}>
						<ReactSVG src={ASSETS.disconnect} />
						{language.disconnect}
					</li>
				</S.DFooterWrapper>
			</>
		);
	}

	function getHeader() {
		const hasArweaveWallet = !!arProvider.walletAddress;
		const hasEthWallet = !!evmWallet.evmAddress;
		const hasArweaveProfile = !!(permawebProvider.profile && permawebProvider.profile.id);
		const hasEthProfile = !!ethProfileId;
		const needsProfile = (hasArweaveWallet && !hasArweaveProfile) || (hasEthWallet && !hasEthProfile);

		return (
			<S.PWrapper>
				{needsProfile && (
					<S.CAction className={'fade-in'}>
						<Button
							type={'alt1'}
							label={creatingEthProfile ? `${language.creating}...` : language.createProfile}
							handlePress={hasEthWallet && !hasEthProfile ? handleCreateEthProfile : handleProfileAction}
							disabled={creatingEthProfile || checkingEthProfile}
						/>
					</S.CAction>
				)}
				{hasArweaveWallet && !hasArweaveProfile && !hasEthWallet && (
					<S.MessageWrapper className={'update-wrapper'}>
						<span>{`${language.fetchingProfile}...`}</span>
					</S.MessageWrapper>
				)}
				{hasEthWallet && !hasEthProfile && checkingEthProfile && (
					<S.MessageWrapper className={'update-wrapper'}>
						<span>{`${language.fetchingProfile}...`}</span>
					</S.MessageWrapper>
				)}
				{label && (
					<S.LAction onClick={handlePress} className={'border-wrapper-primary'}>
						<span>{label}</span>
					</S.LAction>
				)}
				<Avatar
					owner={permawebProvider.profile || (hasEthProfile ? { id: ethProfileId } : null)}
					dimensions={{ wrapper: 35, icon: 21.5 }}
					callback={handlePress}
				/>
			</S.PWrapper>
		);
	}

	function getView() {
		return (
			<S.Wrapper>
				{getHeader()}
				{showWalletDropdown && (
					<Panel
						open={showWalletDropdown}
						header={language.profile}
						handleClose={() => setShowWalletDropdown(false)}
						width={375}
						type={'alt1'}
					>
						{getDropdown()}
					</Panel>
				)}
			</S.Wrapper>
		);
	}

	return (
		<>
			{getView()}
			{showProfileManage && (
				<Panel
					open={showProfileManage}
					header={
						(permawebProvider.profile && permawebProvider.profile.id) || ethProfileId
							? language.editProfile
							: `${language.createProfile}!`
					}
					handleClose={() => setShowProfileManage(false)}
					width={555}
					closeHandlerDisabled
				>
					<S.PManageWrapper>
						<ProfileManage
							profile={
								permawebProvider.profile && permawebProvider.profile.id
									? permawebProvider.profile
									: ethProfile || (ethProfileId ? { id: ethProfileId } : null)
							}
							handleClose={() => setShowProfileManage(false)}
							handleUpdate={() => {
								// When profile is updated, re-fetch the ETH profile data
								if (ethProfileId && permawebProvider.libs) {
									(async () => {
										try {
											const updatedProfile = await permawebProvider.libs.getProfileById(ethProfileId);
											if (updatedProfile) {
												setEthProfile(updatedProfile);
											}
										} catch (error) {
											console.warn('Failed to refresh ETH profile after update:', error);
										}
									})();
								}
							}}
						/>
					</S.PManageWrapper>
				</Panel>
			)}
		</>
	);
}
