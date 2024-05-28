import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { Avatar } from 'components/atoms/Avatar';
import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { AOS, ASSETS, REDIRECTS, STYLING, URLS } from 'helpers/config';
import { formatAddress, formatARAmount } from 'helpers/utils';
import * as windowUtils from 'helpers/window';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useCustomThemeProvider } from 'providers/CustomThemeProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { CloseHandler } from 'wrappers/CloseHandler';

import * as S from './styles';

export default function WalletConnect(_props: { callback?: () => void }) {
	const navigate = useNavigate();

	const arProvider = useArweaveProvider();
	const themeProvider = useCustomThemeProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [showWallet, setShowWallet] = React.useState<boolean>(false);
	const [showWalletDropdown, setShowWalletDropdown] = React.useState<boolean>(false);
	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);

	const [copied, setCopied] = React.useState<boolean>(false);
	const [label, setLabel] = React.useState<string | null>(null);

	const [desktop, setDesktop] = React.useState(windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.initial)));

	function handleWindowResize() {
		if (windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.initial))) {
			setDesktop(true);
		} else {
			setDesktop(false);
		}
	}

	windowUtils.checkWindowResize(handleWindowResize);

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

	function getDropdown() {
		return (
			<>
				<S.DHeaderWrapper>
					<S.DHeaderFlex>
						<Avatar
							owner={arProvider.profile}
							dimensions={{ wrapper: 35, icon: 21.5 }}
							callback={handleProfileAction}
						/>
						<S.DHeader>
							<p onClick={handleProfileAction}>{label}</p>
							<span onClick={handleProfileAction}>
								{formatAddress(
									arProvider.profile && arProvider.profile.id ? arProvider.profile.id : arProvider.walletAddress,
									false
								)}
							</span>
						</S.DHeader>
					</S.DHeaderFlex>
				</S.DHeaderWrapper>
				<S.DBodyWrapper>
					<S.DBodyHeader>
						<span>{language.balances}</span>
					</S.DBodyHeader>
					<S.BalanceLine>
						<span>{formatARAmount(arProvider.arBalance ? arProvider.arBalance : 0)}</span>
						<ReactSVG src={ASSETS.ar} />
					</S.BalanceLine>
					{arProvider.tokenBalances && arProvider.tokenBalances[AOS.token] !== null && (
						<S.BalanceLine>
							<CurrencyLine
								amount={arProvider.tokenBalances[AOS.token]}
								currency={AOS.token}
								callback={() => setShowWalletDropdown(false)}
							/>
						</S.BalanceLine>
					)}
				</S.DBodyWrapper>
				<S.DBodyWrapper>
					<li onClick={() => window.open(REDIRECTS.arswap)}>
						<ReactSVG src={ASSETS.swap} />
						{`${language.arSwap}`}
					</li>
					<li onClick={() => window.open(REDIRECTS.aox)}>
						<ReactSVG src={ASSETS.bridge} />
						{`${language.arBridge}`}
					</li>
				</S.DBodyWrapper>
				<S.DBodyWrapper>
					<li onClick={handleProfileAction}>
						{arProvider.profile && arProvider.profile.id ? (
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
					{arProvider.profile && arProvider.profile.id && (
						<>
							<li onClick={() => setShowProfileManage(true)}>
								<ReactSVG src={ASSETS.edit} />
								{language.editProfile}
							</li>
							<li onClick={() => copyAddress(arProvider.profile.id)}>
								<ReactSVG src={ASSETS.copy} />
								{copied ? `${language.copied}!` : language.copyProfileAddress}
							</li>
						</>
					)}
					<li onClick={handleToggleTheme}>
						{themeProvider.current === 'light' ? (
							<>
								<ReactSVG src={ASSETS.dark} /> {`${language.useDarkDisplay}`}
							</>
						) : (
							<>
								<ReactSVG src={ASSETS.light} /> {`${language.useLightDisplay}`}
							</>
						)}
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
				{arProvider.profile && !arProvider.profile.id && (
					<S.CAction className={'fade-in'}>
						<Button type={'alt1'} label={language.createProfile} handlePress={handleProfileAction} height={35} />
					</S.CAction>
				)}
				{label && (
					<S.LAction onClick={handlePress} className={'border-wrapper-primary'}>
						<span>{label}</span>
					</S.LAction>
				)}
				<Avatar owner={arProvider.profile} dimensions={{ wrapper: 35, icon: 21.5 }} callback={handlePress} />
			</S.PWrapper>
		);
	}

	function getView() {
		if (desktop) {
			return (
				<CloseHandler
					callback={() => {
						setShowWalletDropdown(false);
					}}
					active={showWalletDropdown}
					disabled={false}
				>
					<S.Wrapper>
						{getHeader()}
						{showWalletDropdown && (
							<S.Dropdown className={'border-wrapper-alt1 scroll-wrapper'}>{getDropdown()}</S.Dropdown>
						)}
					</S.Wrapper>
				</CloseHandler>
			);
		} else {
			return (
				<S.Wrapper>
					{getHeader()}
					{showWalletDropdown && (
						<Panel open={showWalletDropdown} header={label} handleClose={() => setShowWalletDropdown(false)}>
							{getDropdown()}
						</Panel>
					)}
				</S.Wrapper>
			);
		}
	}

	return (
		<>
			{getView()}
			{showProfileManage && (
				<Panel
					open={showProfileManage}
					header={arProvider.profile && arProvider.profile.id ? language.editProfile : `${language.createProfile}!`}
					handleClose={() => setShowProfileManage(false)}
				>
					<S.PManageWrapper>
						<ProfileManage
							profile={arProvider.profile && arProvider.profile.id ? arProvider.profile : null}
							handleClose={() => setShowProfileManage(false)}
							handleUpdate={null}
						/>
					</S.PManageWrapper>
				</Panel>
			)}
		</>
	);
}
