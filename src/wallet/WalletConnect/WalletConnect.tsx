import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { Avatar } from 'components/atoms/Avatar';
import { ASSETS, URLS } from 'helpers/config';
import { formatAddress, formatARAmount } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useCustomThemeProvider } from 'providers/CustomThemeProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { CloseHandler } from 'wrappers/CloseHandler';

import * as S from './styles';

// TODO: balances
export default function WalletConnect(_props: { callback?: () => void }) {
	const navigate = useNavigate();

	const arProvider = useArweaveProvider();
	const themeProvider = useCustomThemeProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [showWallet, setShowWallet] = React.useState<boolean>(false);
	const [showWalletDropdown, setShowWalletDropdown] = React.useState<boolean>(false);

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
				if (arProvider.profile && arProvider.profile.handle) {
					setLabel(arProvider.profile.handle);
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

	function handleViewProfile() {
		navigate(`${URLS.profile}${arProvider.walletAddress}`);
		setShowWalletDropdown(false);
	}

	const copyAddress = React.useCallback(async () => {
		if (arProvider.walletAddress) {
			if (arProvider.walletAddress.length > 0) {
				await navigator.clipboard.writeText(arProvider.walletAddress);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}
		}
	}, [arProvider.walletAddress]);

	function handleToggleTheme() {
		themeProvider.setCurrent(themeProvider.current === 'light' ? 'dark' : 'light');
	}

	function handleDisconnect() {
		arProvider.handleDisconnect();
		setShowWalletDropdown(false);
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
						{label && (
							<S.LAction onClick={handlePress}>
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
										callback={handleViewProfile}
									/>
									<S.DHeader>
										<p onClick={handleViewProfile}>{label}</p>
										<span onClick={handleViewProfile}>{formatAddress(arProvider.walletAddress, false)}</span>
									</S.DHeader>
								</S.DHeaderFlex>
							</S.DHeaderWrapper>
							<S.DBodyWrapper>
								<S.DBodyHeader>
									<span>Balances</span>
								</S.DBodyHeader>
								<S.BalanceLine>
									<ReactSVG src={ASSETS.ar} />
									<p>
										{formatARAmount(arProvider.availableBalance ? arProvider.availableBalance : 0)} <span>AR</span>
									</p>
								</S.BalanceLine>
								{/* <S.BalanceLine>
									<ReactSVG src={ASSETS.u} />
									<p>5.67 <span>U</span></p>
								</S.BalanceLine>
								<S.BalanceLine>
									<ReactSVG src={ASSETS.pixl} className={'pixl-icon'} />
									<p>3.01 <span>PIXL</span></p>
								</S.BalanceLine> */}
							</S.DBodyWrapper>
							<S.DBodyWrapper>
								<li onClick={handleViewProfile}>{language.viewProfile}</li>
								<li onClick={copyAddress}>{copied ? `${language.copied}!` : language.copyAddress}</li>
								<li onClick={handleToggleTheme}>
									{themeProvider.current === 'light' ? language.useDarkMode : language.useLightMode}
								</li>
							</S.DBodyWrapper>
							<S.DFooterWrapper>
								<li onClick={handleDisconnect}>{language.disconnect}</li>
							</S.DFooterWrapper>
						</S.Dropdown>
					)}
				</S.Wrapper>
			</CloseHandler>
		</>
	);
}
