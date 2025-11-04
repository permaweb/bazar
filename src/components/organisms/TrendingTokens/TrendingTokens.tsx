import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { connect } from '@permaweb/aoconnect/browser';

import { AO, AOCONFIG, CUSTOM_ORDERBOOKS, DEFAULTS, URLS } from 'helpers/config';
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
			try {
				const ao = connect({
					MODE: 'legacy',
					CU_URL: AOCONFIG.cu_af_url,
				});

				const response = await ao.dryrun({
					process: AO.flps,
					tags: [{ name: 'Action', value: 'Get-FLPs' }],
				});

				const data = JSON.parse(response?.Messages?.[0].Data);

				setTokens(
					data
						.slice()
						.sort((a, b) => (b.accumulated_qty ?? 0) - (a.accumulated_qty ?? 0))
						.slice(0, 16)
						.map((token) => ({
							ProcessId: token.flp_token_process,
							Name: token.flp_token_name,
							Ticker: token.flp_token_ticker,
							Logo: token.flp_token_logo,
						}))
						.filter((token) => [...Object.keys(CUSTOM_ORDERBOOKS)].includes(token.ProcessId))
				);
			} catch (e: any) {
				console.error(e);
			}
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
								<S.TokenWrapper
									key={index}
									onClick={() => handleTokenClick(token)}
									className={'fade-in border-wrapper-alt1'}
									disabled={false}
								>
									<Link to={`${URLS.asset}${token.ProcessId}`}>
										<S.TokenImage>
											<img
												src={getTxEndpoint(token.Logo || token.logo || DEFAULTS.thumbnail)}
												alt={token.Name || token.name || 'Token'}
											/>
										</S.TokenImage>
										<S.TokenName>
											<p>{token.Ticker || token.ticker || 'Token'}</p>
										</S.TokenName>
									</Link>
								</S.TokenWrapper>
							);
						})}
					</>
				) : (
					<>
						{Array.from({ length: 8 }, (_, i) => i + 1).map((index) => {
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
