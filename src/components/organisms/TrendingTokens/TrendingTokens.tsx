import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

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
				const tokenProcesses = Object.keys(REFORMATTED_ASSETS);
				tokenProcesses.pop();
				for (const tokenProcess of tokenProcesses) {
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
								<S.TokenWrapper key={index} onClick={() => handleTokenClick(token)} className={'fade-in'}>
									<Link to={`${URLS.asset}${token.ProcessId}`}>
										<S.TokenImage>
											<img
												src={getTxEndpoint(token.Logo || token.logo || DEFAULTS.thumbnail)}
												alt={token.Name || token.name || 'Token'}
											/>
										</S.TokenImage>
										<S.TokenName>
											<p>{token.Name || token.name || 'Token'}</p>
										</S.TokenName>
									</Link>
								</S.TokenWrapper>
							);
						})}
					</>
				) : (
					<>
						{Array.from({ length: Object.keys(REFORMATTED_ASSETS).length - 1 }, (_, i) => i + 1).map((index) => {
							return (
								<S.TokenWrapper
									key={index}
									disabled={true}
									onClick={() => {}}
									className={'fade-in border-wrapper-alt1'}
								/>
							);
						})}
					</>
				)}
			</S.TokensWrapper>
		</S.Wrapper>
	);
}
