import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { dryrun } from '@permaweb/aoconnect';

import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

const CONTRACT_IDS = ['7vHsvgrOUwnhghgaeMhWC7EED84qDCPBQ7mHqTYfzs8'];

export function TrendingARNS() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [arns, setArns] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchAll() {
			setLoading(true);
			try {
				const results = await Promise.all(
					CONTRACT_IDS.map(async (id) => {
						const res = await dryrun({
							process: id,
							tags: [{ name: 'Action', value: 'Info' }],
						});
						let data = {};
						if (res.Messages && res.Messages.length && res.Messages[0].Data) {
							data = JSON.parse(res.Messages[0].Data);
						}
						return { ...data, id };
					})
				);
				setArns(results);
			} catch (e) {
				setArns([]);
			}
			setLoading(false);
		}
		fetchAll();
	}, []);

	if (loading) return <div>Loading...</div>;

	return (
		<S.Wrapper>
			<S.Header>
				<h4>{language.arnsMarketplace}</h4>
				<Link to="/arns">{language.viewAllCollections}</Link>
			</S.Header>
			<S.DomainsWrapper>
				{arns.map((domain) => (
					<S.DomainCard key={domain.id}>
						<S.DomainName>{domain.Name}</S.DomainName>
						<S.DomainPrice>{domain.Ticker}</S.DomainPrice>
						{domain.Logo && (
							<img
								src={`https://arweave.net/${domain.Logo}`}
								alt="Logo"
								style={{ width: 40, height: 40, borderRadius: 8, margin: '10px 0' }}
							/>
						)}
						<div>Owner: {domain.Owner}</div>
						<div>Description: {domain.Description}</div>
						<div>Keywords: {Array.isArray(domain.Keywords) ? domain.Keywords.join(', ') : ''}</div>
						<div>Denomination: {domain.Denomination}</div>
						<div>Total Supply: {domain['Total-Supply']}</div>
					</S.DomainCard>
				))}
			</S.DomainsWrapper>
		</S.Wrapper>
	);
}
