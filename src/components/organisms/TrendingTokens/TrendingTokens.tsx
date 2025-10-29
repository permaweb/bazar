import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { connect } from '@permaweb/aoconnect/browser';

import { DEFAULTS, REFORMATTED_ASSETS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

export default function TrendingTokens() {
	const navigate = useNavigate();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [tokens, setTokens] = React.useState<any[] | null>(null);

	// React.useEffect(() => {
	// 	(async function () {
	// 		let responses = [];

	// 		const tokenProcesses = Object.keys(REFORMATTED_ASSETS);
	// 		tokenProcesses.pop();

	// 		const cachedTokens = localStorage.getItem('trendingTokens');

	// 		if (cachedTokens && JSON.parse(cachedTokens).length === tokenProcesses.length) {
	// 			responses = JSON.parse(cachedTokens);
	// 		} else {
	// 			for (const tokenProcess of tokenProcesses) {
	// 				try {
	// 					const tokenResponse = await readHandler({
	// 						processId: tokenProcess,
	// 						action: 'Info',
	// 					});

	// 					if (tokenResponse) {
	// 						responses.push({ ProcessId: tokenProcess, ...tokenResponse });
	// 						setTokens(responses);
	// 					}
	// 				} catch (e: any) {
	// 					console.error(e);
	// 				}
	// 			}

	// 			if (responses && responses.length) {
	// 				localStorage.setItem('trendingTokens', JSON.stringify(responses));
	// 			}
	// 		}

	// 		setTokens(responses);
	// 	})();
	// }, []);

	// {
	// 	"accumulated_qty": "4479343828286367",
	// 	"website_url": "https://basejump.xyz/",
	// 	"total_yield_ticks": "225",
	// 	"ends_at_ts": 1836597537584,
	// 	"created_at_ts": 1741984400471,
	// 	"flp_token_disclaimer": "Disclaimer for this token",
	// 	"telegram_handle": "",
	// 	"decay_factor": 0.995,
	// 	"last_updated_at_ts": 1761739800330,
	// 	"status": "Active",
	// 	"token_unlock_at_ts": 1799452800000,
	// 	"total_token_supply": "\"10000000000000000000000000000\"",
	// 	"distributed_qty": "674652014881830410872556834",
	// 	"flp_id": "NXZjrPKh-fQx8BUCG_OXBUtB4Ix8Xf0gbUtREFoWQ2Q",
	// 	"flp_token_process": "OiNYKJ16jP7uj7z0DJO7JZr9ClfioGacpItXTn9fKn8",
	// 	"deployer": "yJQN_yAFtCICEwJiPucvtbqfnMrFR0BmDY68Zb8GmX4",
	// 	"flp_token_name": "Action",
	// 	"twitter_handle": "@basejumpxyz",
	// 	"flp_name": "Basejump Action",
	// 	"stats_updated_at": 1761739800330,
	// 	"id": "NXZjrPKh-fQx8BUCG_OXBUtB4Ix8Xf0gbUtREFoWQ2Q",
	// 	"accumulated_pi_qty": "171657105518598220",
	// 	"latest_yield_cycle": "174592",
	// 	"withdrawn_qty": "860093247506211",
	// 	"token_supply_to_use": "1000000000000000000000000000",
	// 	"starts_at_ts": 1741989603660,
	// 	"withdrawn_pi_qty": "860093247506211",
	// 	"flp_token_ticker": "ACTION",
	// 	"flp_long_description": "Action is an infinitely scalable, permissionless AI gaming substrate",
	// 	"flp_token_logo": "bwup_2BRueewi8ni4R04d8qVtzsAORoaQ8_k2uAIBRk",
	// 	"flp_short_description": "Action is an infinitely scalable, permissionless AI gaming substrate",
	// 	"treasury": "yJQN_yAFtCICEwJiPucvtbqfnMrFR0BmDY68Zb8GmX4",
	// 	"flp_token_denomination": "18",
	// 	"exchanged_for_pi_qty": "17173015488915449"
	// }

	React.useEffect(() => {
		(async function () {
			try {
				const ao = connect({
					MODE: 'legacy',
					CU_URL: 'https://cu-af.dataos.so',
				});

				const response = await ao.dryrun({
					process: 'It-_AKlEfARBmJdbJew1nG9_hIaZt0t20wQc28mFGBE', // FLPs
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
							Logo: token.flp_token_logo,
						}))
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
