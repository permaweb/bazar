import React from 'react';
import { Link } from 'react-router-dom';

import { connect } from '@permaweb/aoconnect';

import { Loader } from 'components/atoms/Loader';
import { URLS } from 'helpers/config';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

export default function TrendingARNS() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [trendingARNS, setTrendingARNS] = React.useState<any[]>([]);
	const [loading, setLoading] = React.useState(true);

	React.useEffect(() => {
		async function fetchTrendingARNS() {
			try {
				setLoading(true);
				const ao = connect({ MODE: 'legacy' });

				// Fetch trending ARNS tokens
				const response = await ao.dryrun({
					process: '7vHsvgrOUwnhghgaeMhWC7EED84qDCPBQ7mHqTYfzs8',
					action: 'Get-Trending-Records',
				});

				if (response && response.Output) {
					const tokens = JSON.parse(response.Output);
					setTrendingARNS(tokens);
				}
			} catch (err) {
				console.error('Error fetching trending ARNS:', err);
			} finally {
				setLoading(false);
			}
		}

		fetchTrendingARNS();
	}, []);

	return (
		<S.Wrapper>
			<S.Header>
				<h4>{language.trendingARNS}</h4>
				<Link to="/arns">{language.viewAll}</Link>
			</S.Header>
			<S.TokensWrapper>
				{loading ? (
					<S.LoadingWrapper>
						<Loader />
					</S.LoadingWrapper>
				) : (
					trendingARNS.map((token, index) => (
						<S.TokenWrapper key={index} className="fade-in">
							<Link to={`/asset/${token.ProcessId}`}>
								<div>
									<h3>{token.name}</h3>
									<p>{token.description}</p>
									{token.forSale && <p>Price: {token.price} AR</p>}
								</div>
							</Link>
						</S.TokenWrapper>
					))
				)}
			</S.TokensWrapper>
		</S.Wrapper>
	);
}
