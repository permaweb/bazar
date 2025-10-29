import React from 'react';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';
import { useTheme } from 'styled-components';

import { IconButton } from 'components/atoms/IconButton';
import { DelegationPanel } from 'components/organisms/DelegationPanel';
import { Streaks } from 'components/organisms/Streaks';
import { ASSETS, REDIRECTS, URLS } from 'helpers/config';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { WalletConnect } from 'wallet/WalletConnect';
import { CloseHandler } from 'wrappers/CloseHandler';

import * as S from './styles';

export default function Header() {
	const theme = useTheme();

	const permawebProvider = usePermawebProvider();
	const arweaveProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [delegationPanelOpen, setDelegationPanelOpen] = React.useState(false);

	const paths: { path: string; label: string; target?: '_blank' }[] = [
		{ path: URLS.collections, label: language.collections },
		{ path: URLS.docs, label: language.learn },
		{ path: REDIRECTS.bazarStudio, label: language.create, target: '_blank' },
	];

	const [panelOpen, setPanelOpen] = React.useState<boolean>(false);

	React.useEffect(() => {
		const header = document.getElementById('navigation-header');
		if (!header) return;

		let lastScrollY = 0;
		let ticking = false;
		const borderColor = theme.colors.border.primary;

		const handleScroll = () => {
			lastScrollY = window.scrollY;
			if (!ticking) {
				window.requestAnimationFrame(() => {
					const parts = window.location.href.split('/');
					const isEditorPage = parts.some((part) => part === 'post' || part === 'page');
					header.style.borderBottom =
						!isEditorPage && lastScrollY > 0 ? `1px solid ${borderColor}` : '1px solid transparent';
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		handleScroll();

		return () => window.removeEventListener('scroll', handleScroll);
	}, [theme.colors.border.primary]);

	return (
		<>
			<S.Wrapper id={'navigation-header'}>
				<S.Content className={'max-view-wrapper'}>
					<S.C1Wrapper>
						<S.LogoWrapper>
							<Link to={URLS.base}>
								<ReactSVG src={ASSETS.logo} />
							</Link>
						</S.LogoWrapper>
						<S.DNavWrapper>
							{paths.map((element: { path: string; label: string; target?: '_blank' }, index: number) => {
								return (
									<Link key={index} to={element.path} target={element.target || ''}>
										{element.label}
									</Link>
								);
							})}
						</S.DNavWrapper>
					</S.C1Wrapper>
					<S.ActionsWrapper>
						{/* {permawebProvider.profile && permawebProvider.profile.id && <Streaks profile={permawebProvider.profile} />} */}
						{arweaveProvider.walletAddress && (
							<S.DelegationButtonWrapper>
								<S.DelegationButton
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setDelegationPanelOpen(true);
									}}
								>
									Delegate
								</S.DelegationButton>
							</S.DelegationButtonWrapper>
						)}
						<WalletConnect />
						<S.MWrapper>
							<IconButton
								type={'alt1'}
								src={ASSETS.menu}
								handlePress={() => setPanelOpen(true)}
								dimensions={{ wrapper: 35, icon: 19.5 }}
							/>
						</S.MWrapper>
					</S.ActionsWrapper>
				</S.Content>
			</S.Wrapper>
			{panelOpen && (
				<div className={'overlay'}>
					<S.PWrapper className={'border-wrapper-primary'}>
						<CloseHandler active={panelOpen} disabled={!panelOpen} callback={() => setPanelOpen(false)}>
							<S.PMenu>
								<S.PHeader>
									<h4>{language.goTo}</h4>
									<IconButton
										type={'primary'}
										src={ASSETS.close}
										handlePress={() => setPanelOpen(false)}
										dimensions={{
											wrapper: 35,
											icon: 20,
										}}
										tooltip={language.close}
										useBottomToolTip
									/>
								</S.PHeader>
								<S.MNavWrapper>
									{paths.map((element: { path: string; label: string; target?: '_blank' }, index: number) => {
										return (
											<Link
												key={index}
												to={element.path}
												target={element.target || ''}
												onClick={() => setPanelOpen(false)}
											>
												{element.label}
											</Link>
										);
									})}
								</S.MNavWrapper>
							</S.PMenu>
						</CloseHandler>
					</S.PWrapper>
				</div>
			)}
			<DelegationPanel
				walletAddress={arweaveProvider.walletAddress}
				isOpen={delegationPanelOpen}
				onClose={() => setDelegationPanelOpen(false)}
			/>
		</>
	);
}
