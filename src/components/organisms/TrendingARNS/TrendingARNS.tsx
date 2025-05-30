import React from 'react';
import { Link } from 'react-router-dom';
import { ANT, ARIO } from '@ar.io/sdk/lib/types/web';

// import { URLS } from 'helpers/config'; // Removed unused import
import { useLanguageProvider } from 'providers/LanguageProvider';

import { fetchANTInfoWithHyperbeam } from '../../../helpers/arnsFetch';
import ARNSMetadata from '../../atoms/ARNSMetadata';
import { Loader } from '../../atoms/Loader';

import * as S from './styles.js';

const BATCH_SIZE = 5; // Show only 5 trending ARNS on the landing page

export default function TrendingARNS() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [trendingARNS, setTrendingARNS] = React.useState<any[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		let isMounted = true;
		async function fetchTrendingARNS() {
			setLoading(true);
			setError(null);
			try {
				const ario = ARIO.mainnet();
				const { items: records } = await ario.getArNSRecords({
					limit: BATCH_SIZE,
					sortBy: 'startTimestamp',
					sortOrder: 'desc',
				});
				const ants = await Promise.all(
					records.map(async (rec) => {
						try {
							return await fetchANTInfoWithHyperbeam(rec.processId, rec.name, (loading) => setLoading(loading));
						} catch (e) {
							return null;
						}
					})
				);
				const validResults = ants.filter(Boolean);
				if (isMounted) setTrendingARNS(validResults);
			} catch (err: any) {
				if (isMounted) setError(err.message || 'Failed to fetch ARNS');
			} finally {
				if (isMounted) setLoading(false);
			}
		}
		fetchTrendingARNS();
		return () => {
			isMounted = false;
		};
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
				) : error ? (
					<S.ErrorWrapper>
						<p>{error}</p>
					</S.ErrorWrapper>
				) : trendingARNS.length === 0 ? (
					<S.EmptyWrapper>
						<p>{language.noARNSFound}</p>
					</S.EmptyWrapper>
				) : (
					trendingARNS.map((token, index) => (
						<S.TokenWrapper key={index} className="fade-in">
							<Link to={`/asset/${token.processId}`}>
								<ARNSMetadata metadata={token} compact />
							</Link>
						</S.TokenWrapper>
					))
				)}
			</S.TokensWrapper>
		</S.Wrapper>
	);
}
