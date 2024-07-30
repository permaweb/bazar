import React from 'react';
import { useNavigate } from 'react-router-dom';

import { readHandler } from 'api';

import { DEFAULTS, REFORMATTED_ASSETS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

export default function TrendingTokens() {
	const navigate = useNavigate();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [tokens, setTokens] = React.useState<any[] | null>(null);

	React.useEffect(() => {
		(async function () {
			let responses = [];
			const cachedTokens = localStorage.getItem('trendingTokens');

			if (cachedTokens) {
				responses = JSON.parse(cachedTokens);
			} else {
				for (const tokenProcess of Object.keys(REFORMATTED_ASSETS)) {
					const tokenResponse = await readHandler({
						processId: tokenProcess,
						action: 'Info',
					});

					if (tokenResponse) {
						responses.push({ ProcessId: tokenProcess, ...tokenResponse });
					}
				}

				if (responses && responses.length) {
					localStorage.setItem('trendingTokens', JSON.stringify(responses));
				}
			}

			setTokens(responses);
		})();
	}, []);

	function handleTokenClick(token: any) {
		navigate(`${URLS.asset}${token.ProcessId}`);
	}

	return (
		<S.Wrapper>
			<S.Header>
				<h4>{language.trendingTokens}</h4>
			</S.Header>
			<S.TokensWrapper>
				{tokens && tokens.length > 0 ? (
					<>
						{tokens.map((token: any, index: number) => {
							return (
								<S.TokenLine
									key={index}
									onClick={() => handleTokenClick(token)}
									className={'fade-in border-wrapper-alt2'}
								>
									<S.TokenImage>
										<img
											src={getTxEndpoint(token.Logo || token.logo || DEFAULTS.thumbnail)}
											alt={token.Name || token.name || 'Token'}
										/>
									</S.TokenImage>
									<span>{token.Name || token.name || 'Token'}</span>
									<S.TokenTicker>
										<span>{token.Ticker || token.ticker || 'Token'}</span>
									</S.TokenTicker>
								</S.TokenLine>
							);
						})}
					</>
				) : (
					<>
						{Array.from({ length: Object.keys(REFORMATTED_ASSETS).length }, (_, i) => i + 1).map((index) => {
							return (
								<S.TokenLine key={index} disabled={true} onClick={() => {}} className={'fade-in border-wrapper-alt1'} />
							);
						})}
					</>
				)}
			</S.TokensWrapper>
		</S.Wrapper>
	);
}
