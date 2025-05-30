import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ANT, ARIO } from '@ar.io/sdk/web';
import styled from 'styled-components';

import { useLanguageProvider } from 'providers/LanguageProvider';

import ARNSMetadata from '../../atoms/ARNSMetadata';
import { Loader } from '../../atoms/Loader';

import * as S from './styles';

const BATCH_SIZE = 5; // Show only 5 trending ARNS on the landing page

export const Wrapper = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 20px;
	min-height: 100px; // reduce from 220px
	background: transparent; // ensure no overlay
`;

export const LoadingWrapper = styled.div`
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 80px; // reduce from 200px
	background: transparent;
`;

export function TrendingARNS() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [trendingARNS, setTrendingARNS] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
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
							const ant = ANT.init({ processId: rec.processId });
							const info = await ant.getInfo();
							return { ...info, name: rec.name, processId: rec.processId };
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
				<h4>{language.arnsMarketplace}</h4>
				<Link to="/arns">{language.viewAllCollections}</Link>
			</S.Header>
			<S.DomainsWrapper>
				{error ? (
					<S.ErrorWrapper>
						<p>{error}</p>
					</S.ErrorWrapper>
				) : loading ? (
					// Show 3 skeleton cards while loading
					<>
						{[...Array(3)].map((_, idx) => (
							<S.DomainCard key={idx} style={{ opacity: 0.5 }}>
								<Loader sm />
							</S.DomainCard>
						))}
					</>
				) : trendingARNS.length === 0 ? (
					<S.EmptyWrapper>
						<p>{language.noARNSFound}</p>
					</S.EmptyWrapper>
				) : (
					trendingARNS.map((token, index) => (
						<S.DomainCard key={token.processId || index}>
							<ARNSMetadata metadata={token} />
						</S.DomainCard>
					))
				)}
			</S.DomainsWrapper>
		</S.Wrapper>
	);
}
