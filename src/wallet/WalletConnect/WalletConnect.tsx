import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { Avatar } from 'components/atoms/Avatar';
import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { AO, ASSETS, REDIRECTS, URLS } from 'helpers/config';
import { formatAddress, getTotalTokenBalance } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useCustomThemeProvider } from 'providers/CustomThemeProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { useTokenProvider } from 'providers/TokenProvider';

import * as S from './styles';

export default function WalletConnect(_props: { callback?: () => void }) {
	const navigate = useNavigate();

	const { availableTokens } = useTokenProvider();
	const arProvider = useArweaveProvider();
	const permawebProvider = usePermawebProvider();

	const themeProvider = useCustomThemeProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [showWallet, setShowWallet] = React.useState<boolean>(false);
	const [showWalletDropdown, setShowWalletDropdown] = React.useState<boolean>(false);
	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);

	const [copiedWalletAddress, setCopiedWalletAddress] = React.useState<boolean>(false);
	const [copiedProfileId, setCopiedProfileId] = React.useState<boolean>(false);
	const [label, setLabel] = React.useState<string | null>(null);
	const [isSystemTheme, setIsSystemTheme] = React.useState<boolean>(
		!localStorage.getItem('preferredTheme') || localStorage.getItem('isSystemTheme') === 'true'
	);

	React.useEffect(() => {
		setTimeout(() => {
			setShowWallet(true);
		}, 200);
	}, [arProvider.walletAddress]);

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
			} else {
				setLabel(language.connect);
			}
		}
	}, [showWallet, arProvider.walletAddress, permawebProvider.profile, permawebProvider.arnsPrimaryName]);

	function handlePress() {
		if (arProvider.walletAddress) {
			setShowWalletDropdown(!showWalletDropdown);
		} else {
			arProvider.setWalletModalVisible(true);
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
		} else {
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
		if (permawebProvider.profile?.id) {
			await navigator.clipboard.writeText(permawebProvider.profile.id);
			setCopiedProfileId(true);
			setTimeout(() => setCopiedProfileId(false), 2000);
		}
	}, [permawebProvider.profile?.id]);

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
		arProvider.handleDisconnect();
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
						{permawebProvider.profile && permawebProvider.profile.id ? (
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
					{permawebProvider.profile && permawebProvider.profile.id && (
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
		return (
			<S.PWrapper>
				{permawebProvider.profile && !permawebProvider.profile.id && (
					<S.CAction className={'fade-in'}>
						<Button type={'alt1'} label={language.createProfile} handlePress={handleProfileAction} />
					</S.CAction>
				)}
				{arProvider.walletAddress && !permawebProvider.profile && (
					<S.MessageWrapper className={'update-wrapper'}>
						<span>{`${language.fetchingProfile}...`}</span>
					</S.MessageWrapper>
				)}
				{label && (
					<S.LAction onClick={handlePress} className={'border-wrapper-primary'}>
						<span>{label}</span>
					</S.LAction>
				)}
				<Avatar owner={permawebProvider.profile} dimensions={{ wrapper: 35, icon: 21.5 }} callback={handlePress} />
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
						permawebProvider.profile && permawebProvider.profile.id
							? language.editProfile
							: `${language.createProfile}!`
					}
					handleClose={() => setShowProfileManage(false)}
					width={555}
					closeHandlerDisabled
				>
					<S.PManageWrapper>
						<ProfileManage
							profile={permawebProvider.profile && permawebProvider.profile.id ? permawebProvider.profile : null}
							handleClose={() => setShowProfileManage(false)}
							handleUpdate={null}
						/>
					</S.PManageWrapper>
				</Panel>
			)}
		</>
	);
}
