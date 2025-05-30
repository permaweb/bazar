import React, { useEffect, useState } from 'react';
import { ARIO } from '@ar.io/sdk';

import { fetchAllANTsForUser } from '../../../helpers/arnsFetch';

import * as S from './styles';

interface IProps {
	walletAddress: string;
	profileId: string;
}

const REGISTRY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const ARNS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getRegistryCache() {
	try {
		const raw = localStorage.getItem('arnsRegistryCache');
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (Date.now() - parsed.timestamp > REGISTRY_CACHE_TTL) return null;
		return parsed.data;
	} catch {
		return null;
	}
}

function setRegistryCache(data: any) {
	localStorage.setItem('arnsRegistryCache', JSON.stringify({ data, timestamp: Date.now() }));
}

function getArnsCache(walletAddress: string, profileId: string) {
	try {
		const key = `arnsCache:${walletAddress}:${profileId}`;
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (Date.now() - parsed.timestamp > ARNS_CACHE_TTL) return null;
		return parsed.data;
	} catch {
		return null;
	}
}

function setArnsCache(walletAddress: string, profileId: string, data: any) {
	const key = `arnsCache:${walletAddress}:${profileId}`;
	localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
}

const ProfileArNS: React.FC<IProps> = ({ walletAddress, profileId }) => {
	const [records, setRecords] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [registry, setRegistry] = useState<Record<string, any>>({});

	useEffect(() => {
		let isMounted = true;

		async function fetchRegistry() {
			setLoading(true);
			try {
				let registryData = getRegistryCache();
				if (!registryData) {
					const ario = ARIO.mainnet();
					const { items } = await ario.getArNSRecords({ limit: 1000 });
					registryData = items.reduce((acc: any, rec: any) => {
						acc[rec.processId] = rec;
						return acc;
					}, {});
					setRegistryCache(registryData);
				}
				if (isMounted) setRegistry(registryData);
			} catch (e) {
				if (isMounted) setRegistry({});
			} finally {
				if (isMounted) setLoading(false);
			}
		}
		fetchRegistry();
		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		let isMounted = true;
		async function fetchAllArns() {
			setLoading(true);
			try {
				let filtered = getArnsCache(walletAddress, profileId);
				if (!filtered) {
					const [walletArns, profileArns] = await Promise.all([
						walletAddress ? fetchAllANTsForUser(walletAddress) : [],
						profileId ? fetchAllANTsForUser(profileId) : [],
					]);
					// Merge and deduplicate by processId
					const all = [...walletArns, ...profileArns];
					const deduped = Object.values(
						all.reduce((acc, ant) => {
							acc[ant.processId] = ant;
							return acc;
						}, {})
					);
					// Stricter filter: Only show ANTs that are in the registry AND have Ticker 'ANT-<name>' and Name is not 'ANT'
					filtered = deduped.filter((ant: any) => {
						const reg = registry[ant.processId];
						return (
							reg && typeof ant.Ticker === 'string' && ant.Ticker.startsWith('ANT-') && ant.Name && ant.Name !== 'ANT'
						);
					});
					setArnsCache(walletAddress, profileId, filtered);
				}
				if (isMounted) setRecords(filtered);
			} catch (e) {
				if (isMounted) setRecords([]);
			} finally {
				if (isMounted) setLoading(false);
			}
		}
		if (Object.keys(registry).length > 0) {
			fetchAllArns();
		}
		return () => {
			isMounted = false;
		};
	}, [walletAddress, profileId, registry]);

	if (loading)
		return (
			<S.Wrapper>
				{[...Array(3)].map((_, i) => (
					<S.AntCard key={i} style={{ opacity: 0.5 }}>
						<S.AntName style={{ background: '#eee', width: 120, height: 20, borderRadius: 4 }} />
						<S.AntTicker style={{ background: '#eee', width: 80, height: 16, borderRadius: 4 }} />
						<div style={{ background: '#eee', width: 40, height: 40, borderRadius: 20, margin: '8px 0' }} />
						<S.AntDescription style={{ background: '#eee', width: 180, height: 14, borderRadius: 4 }} />
					</S.AntCard>
				))}
			</S.Wrapper>
		);
	if (!records.length) return <S.Wrapper>No ArNS found for this wallet or profile.</S.Wrapper>;

	return (
		<S.Wrapper>
			{records.map((ant) => (
				<S.AntCard key={ant.processId}>
					<S.AntName>{ant.Name}</S.AntName>
					<S.AntTicker>{ant.Ticker}</S.AntTicker>
					{ant.Logo && (
						<img
							src={`https://arweave.net/${ant.Logo}`}
							alt={ant.Name}
							style={{ width: 40, height: 40, borderRadius: 20 }}
						/>
					)}
					<S.AntDescription>{ant.Description || ''}</S.AntDescription>
				</S.AntCard>
			))}
		</S.Wrapper>
	);
};

export default ProfileArNS;
