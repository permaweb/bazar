import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { Avatar } from 'components/atoms/Avatar';
import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { ASSETS, PROCESSES, URLS } from 'helpers/config';
import { formatAddress, formatARAmount } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useCustomThemeProvider } from 'providers/CustomThemeProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';
import { CloseHandler } from 'wrappers/CloseHandler';

import * as S from './styles';

export default function WalletConnect(_props: { callback?: () => void }) {
	const navigate = useNavigate();

	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);

	const arProvider = useArweaveProvider();
	const themeProvider = useCustomThemeProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [showWallet, setShowWallet] = React.useState<boolean>(false);
	const [showWalletDropdown, setShowWalletDropdown] = React.useState<boolean>(false);
	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);

	const [copied, setCopied] = React.useState<boolean>(false);
	const [label, setLabel] = React.useState<string | null>(null);

	React.useEffect(() => {
		setTimeout(() => {
			setShowWallet(true);
		}, 200);
	}, [arProvider.walletAddress]);

	React.useEffect(() => {
		if (!showWallet) {
			setLabel(`${language.fetching}...`);
		} else {
			if (arProvider.walletAddress) {
				if (arProvider.profile && arProvider.profile.username) {
					setLabel(arProvider.profile.username);
				} else {
					setLabel(formatAddress(arProvider.walletAddress, false));
				}
			} else {
				setLabel(language.connect);
			}
		}
	}, [showWallet, arProvider.walletAddress, arProvider.profile]);

	function handlePress() {
		if (arProvider.walletAddress) {
			setShowWalletDropdown(!showWalletDropdown);
		} else {
			arProvider.setWalletModalVisible(true);
		}
	}

	function handleProfileAction() {
		if (arProvider.profile && arProvider.profile.id) {
			navigate(`${URLS.profile}${arProvider.profile.id}`);
			setShowWalletDropdown(false);
		} else {
			setShowProfileManage(true);
		}
	}

	const copyAddress = React.useCallback(async (address: string) => {
		if (address) {
			if (address.length > 0) {
				await navigator.clipboard.writeText(address);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}
		}
	}, []);

	function handleToggleTheme() {
		themeProvider.setCurrent(themeProvider.current === 'light' ? 'dark' : 'light');
	}

	function handleDisconnect() {
		arProvider.handleDisconnect();
		setShowWalletDropdown(false);
	}

	function getTokenBalance(tokenProcess: string) {
		if (
			arProvider.profile &&
			arProvider.profile.id &&
			currenciesReducer &&
			currenciesReducer[tokenProcess] &&
			currenciesReducer[tokenProcess].Balances[arProvider.profile.id]
		) {
			const ownerBalance = currenciesReducer[tokenProcess].Balances[arProvider.profile.id];
			return ownerBalance.toString();
		}
		return 0;
	}

	return (
		<>
			<CloseHandler
				callback={() => {
					setShowWalletDropdown(false);
				}}
				active={showWalletDropdown}
				disabled={false}
			>
				<S.Wrapper>
					<S.PWrapper>
						{arProvider.profile && !arProvider.profile.id && (
							<S.CAction className={'fade-in'}>
								<Button type={'primary'} label={language.createProfile} handlePress={handleProfileAction} height={35} />
							</S.CAction>
						)}
						{label && (
							<S.LAction onClick={handlePress} className={'border-wrapper-alt2'}>
								<span>{label}</span>
							</S.LAction>
						)}
						<Avatar owner={arProvider.profile} dimensions={{ wrapper: 35, icon: 21.5 }} callback={handlePress} />
					</S.PWrapper>
					{showWalletDropdown && (
						<S.Dropdown className={'border-wrapper-alt2 scroll-wrapper'}>
							<S.DHeaderWrapper>
								<S.DHeaderFlex>
									<Avatar
										owner={arProvider.profile}
										dimensions={{ wrapper: 35, icon: 21.5 }}
										callback={handleProfileAction}
									/>
									<S.DHeader>
										<p onClick={handleProfileAction}>{label}</p>
										<span onClick={handleProfileAction}>{formatAddress(arProvider.walletAddress, false)}</span>
									</S.DHeader>
								</S.DHeaderFlex>
							</S.DHeaderWrapper>
							<S.DBodyWrapper>
								<S.DBodyHeader>
									<span>{language.balances}</span>
								</S.DBodyHeader>
								<S.BalanceLine>
									<span>{formatARAmount(arProvider.availableBalance ? arProvider.availableBalance : 0)}</span>
									<ReactSVG src={ASSETS.ar} />
								</S.BalanceLine>
								{currenciesReducer && currenciesReducer[PROCESSES.token] && (
									<S.BalanceLine>
										<CurrencyLine
											amount={getTokenBalance(PROCESSES.token)}
											currency={PROCESSES.token}
											callback={() => setShowWalletDropdown(false)}
										/>
									</S.BalanceLine>
								)}
							</S.DBodyWrapper>
							<S.DBodyWrapper>
								<li onClick={handleProfileAction}>
									{arProvider.profile && arProvider.profile.id ? language.viewProfile : language.createProfile}
								</li>
								{arProvider.profile && arProvider.profile.id && (
									<>
										<li onClick={() => setShowProfileManage(true)}>{language.editProfile}</li>
										<li onClick={() => copyAddress(arProvider.profile.id)}>
											{copied ? `${language.copied}!` : language.copyProfileAddress}
										</li>
									</>
								)}
								{/* <li onClick={() => copyAddress(arProvider.walletAddress)}>{copied ? `${language.copied}!` : language.copyWalletAddress}</li> */}
								<li onClick={handleToggleTheme}>
									{themeProvider.current === 'light' ? language.useDarkDisplay : language.useLightDisplay}
								</li>
							</S.DBodyWrapper>
							<S.DFooterWrapper>
								<li onClick={handleDisconnect}>{language.disconnect}</li>
							</S.DFooterWrapper>
						</S.Dropdown>
					)}
				</S.Wrapper>
			</CloseHandler>
			{showProfileManage && (
				<Panel
					open={showProfileManage}
					header={`${language.createProfile}!`}
					handleClose={() => setShowProfileManage(false)}
				>
					<ProfileManage
						profile={arProvider.profile && arProvider.profile.id ? arProvider.profile : null}
						handleClose={() => setShowProfileManage(false)}
						handleUpdate={null}
					/>
				</Panel>
			)}
		</>
	);
}
