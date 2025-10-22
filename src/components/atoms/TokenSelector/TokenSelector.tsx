import React from 'react';

import { TOKEN_REGISTRY } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { formatCount, getTotalTokenBalance } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { useTokenProvider } from 'providers/TokenProvider';
import { CloseHandler } from 'wrappers/CloseHandler';

import TokenHealthIndicator from '../TokenHealthIndicator';

import * as S from './styles';

interface TokenSelectorProps {
	onTokenChange?: (tokenId: string) => void;
	className?: string;
	showLabel?: boolean;
}

export default function TokenSelector(props: TokenSelectorProps) {
	const { selectedToken, setSelectedToken, availableTokens } = useTokenProvider();
	const permawebProvider = usePermawebProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [isOpen, setIsOpen] = React.useState(false);

	const handleTokenSelect = (tokenId: string) => {
		const newToken = availableTokens.find((token) => token.id === tokenId);
		if (newToken) {
			setSelectedToken(newToken);
			props.onTokenChange?.(tokenId);
		}
		setIsOpen(false);
	};

	const getTokenBalance = (tokenId: string) => {
		if (!permawebProvider.tokenBalances || !permawebProvider.tokenBalances[tokenId]) {
			return null;
		}
		const balance = permawebProvider.tokenBalances[tokenId];
		// Ensure we have proper number types
		const profileBalance =
			typeof balance.profileBalance === 'string' ? Number(balance.profileBalance) : balance.profileBalance;
		const walletBalance =
			typeof balance.walletBalance === 'string' ? Number(balance.walletBalance) : balance.walletBalance;

		const totalRawBalance = getTotalTokenBalance({ profileBalance, walletBalance });

		// Convert raw balance to human-readable amount using token denomination
		const tokenInfo = TOKEN_REGISTRY[tokenId];
		if (tokenInfo && tokenInfo.denomination && totalRawBalance !== null) {
			const humanReadableBalance = totalRawBalance / Math.pow(10, tokenInfo.denomination);
			return humanReadableBalance;
		}

		return totalRawBalance;
	};

	return (
		<CloseHandler active={isOpen} disabled={!isOpen} callback={() => setIsOpen(false)}>
			<S.Wrapper className={props.className}>
				{props.showLabel && <S.Label>{language.selectToken}:</S.Label>}
				<S.CustomSelectWrapper>
					<S.CustomSelect onClick={() => setIsOpen(!isOpen)} className={isOpen ? 'active' : ''}>
						<S.SelectedToken>
							<S.TokenLogo>
								{selectedToken.logo ? (
									<img src={getTxEndpoint(selectedToken.logo)} alt={selectedToken.name} />
								) : (
									<div
										style={{
											width: '24px',
											height: '24px',
											backgroundColor: '#e5e5e5',
											borderRadius: '50%',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											fontSize: '12px',
											fontWeight: 'bold',
											color: '#666',
										}}
									>
										{selectedToken.symbol.charAt(0)}
									</div>
								)}
							</S.TokenLogo>
							<S.TokenInfo>
								<S.TokenName>{selectedToken.name.replace(' Token', '')}</S.TokenName>
								<S.TokenSymbol>{selectedToken.symbol}</S.TokenSymbol>
							</S.TokenInfo>
							<S.HealthWrapper>
								<TokenHealthIndicator tokenId={selectedToken.id} operation="orders" showDetails={false} />
							</S.HealthWrapper>
						</S.SelectedToken>
						<S.DropdownArrow className={isOpen ? 'open' : ''}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<polyline points="6,9 12,15 18,9"></polyline>
							</svg>
						</S.DropdownArrow>
					</S.CustomSelect>

					{isOpen && (
						<S.DropdownOptions>
							{availableTokens.map((token) => {
								const balance = getTokenBalance(token.id);

								return (
									<S.DropdownOption
										key={token.id}
										onClick={() => handleTokenSelect(token.id)}
										className={token.id === selectedToken.id ? 'selected' : ''}
									>
										<S.TokenOption>
											<S.TokenLogo>
												{token.logo ? (
													<img src={getTxEndpoint(token.logo)} alt={token.name} />
												) : (
													<div
														style={{
															width: '24px',
															height: '24px',
															backgroundColor: '#e5e5e5',
															borderRadius: '50%',
															display: 'flex',
															alignItems: 'center',
															justifyContent: 'center',
															fontSize: '12px',
															fontWeight: 'bold',
															color: '#666',
														}}
													>
														{token.symbol.charAt(0)}
													</div>
												)}
											</S.TokenLogo>
											<S.TokenInfo>
												<S.TokenName>{token.name.replace(' Token', '')}</S.TokenName>
												<S.TokenSymbol>{token.symbol}</S.TokenSymbol>
											</S.TokenInfo>
											<S.BalanceAndHealth>
												{balance !== null && <S.TokenBalance>{formatCount(balance.toString())}</S.TokenBalance>}
												<S.HealthWrapper>
													<TokenHealthIndicator tokenId={token.id} operation="orders" showDetails={false} />
												</S.HealthWrapper>
											</S.BalanceAndHealth>
										</S.TokenOption>
									</S.DropdownOption>
								);
							})}
						</S.DropdownOptions>
					)}
				</S.CustomSelectWrapper>
			</S.Wrapper>
		</CloseHandler>
	);
}
