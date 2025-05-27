import React from 'react';
import { useSelector } from 'react-redux';
import { ANT, ARIO, getANTProcessesOwnedByWallet } from '@ar.io/sdk/web';

import ARNSMetadata from 'components/atoms/ARNSMetadata';
import { Button } from 'components/atoms/Button';
import { Loader } from 'components/atoms/Loader';
import { Panel } from 'components/molecules/Panel';
import { Tabs } from 'components/molecules/Tabs';
import { ASSETS } from 'helpers/config';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import * as S from './styles';

interface ANTInfo {
	Name: string;
	Ticker: string;
	Description: string;
	Keywords: string[];
	Denomination: string;
	Owner: string;
	Logo: string;
	'Total-Supply': string;
	Handlers?: string[];
	HandlerNames?: string[];
	processId: string;
	name?: string; // ArNS name
}

interface TabProps {
	label: string;
	icon: string;
}

export default function ARNSMarketplace() {
	const arweaveProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [allArns, setAllArns] = React.useState<ANTInfo[]>([]);
	const [myArns, setMyArns] = React.useState<ANTInfo[]>([]);
	const [loadingAll, setLoadingAll] = React.useState(true);
	const [loadingMine, setLoadingMine] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [currentTab, setCurrentTab] = React.useState('all');

	const MARKET_TABS = [
		{
			label: 'All ARNS',
			icon: ASSETS.market,
			key: 'all',
		},
		{
			label: 'My ARNS',
			icon: ASSETS.wallet,
			key: 'mine',
		},
	];

	// Fetch all ARNS/ANTs using ar.io SDK (ARIO Registry)
	React.useEffect(() => {
		async function fetchAllArns() {
			setLoadingAll(true);
			try {
				const ario = ARIO.mainnet();
				const { items: records } = await ario.getArNSRecords({
					limit: 50,
					sortBy: 'startTimestamp',
					sortOrder: 'desc',
				});
				// For each record, fetch ANT metadata
				const ants = await Promise.all(
					records.map(async (rec: any, idx: number) => {
						try {
							const ant = ANT.init({ processId: rec.processId });
							const info = await ant.getInfo();
							if (idx === 0) console.log('Marketplace: ANT info:', info);
							return { ...info, processId: rec.processId, name: rec.name } as ANTInfo;
						} catch (e) {
							console.error('Error fetching ANT info:', e);
							return null;
						}
					})
				);
				setAllArns(ants.filter(Boolean) as ANTInfo[]);
			} catch (err: any) {
				console.error('Error fetching all ARNS:', err);
				setError(err.message);
				setAllArns([]);
			} finally {
				setLoadingAll(false);
			}
		}
		fetchAllArns();
	}, []);

	// Fetch owned ANTs using ar.io SDK
	React.useEffect(() => {
		async function fetchMyArns() {
			setLoadingMine(true);
			try {
				const address = arweaveProvider.walletAddress;
				if (!address) {
					setMyArns([]);
					setLoadingMine(false);
					return;
				}
				const processIds = await getANTProcessesOwnedByWallet({ address });
				const ants = await Promise.all(
					processIds.map(async (processId: string, idx: number) => {
						try {
							const ant = ANT.init({ processId });
							const info = await ant.getInfo();
							if (idx === 0) console.log('Profile: ANT info:', info);
							return { ...info, processId } as ANTInfo;
						} catch (e) {
							console.error('Error fetching ANT info:', e);
							return null;
						}
					})
				);
				setMyArns(ants.filter(Boolean) as ANTInfo[]);
			} catch (err: any) {
				console.error('Error fetching my ARNS:', err);
				setMyArns([]);
			} finally {
				setLoadingMine(false);
			}
		}
		fetchMyArns();
	}, [arweaveProvider.walletAddress]);

	function getCurrentTab() {
		if (currentTab === 'all') {
			if (loadingAll)
				return (
					<S.LoadingWrapper>
						<Loader />
					</S.LoadingWrapper>
				);
			if (error)
				return (
					<S.EmptyWrapper>
						<p>Error: {error}</p>
					</S.EmptyWrapper>
				);
			if (allArns.length === 0)
				return (
					<S.EmptyWrapper>
						<p>{language.noARNSFound}</p>
					</S.EmptyWrapper>
				);
			return (
				<S.ListWrapper>
					{allArns.map((token, index) => (
						<S.TokenCard key={index} className="border-wrapper-alt1">
							<ARNSMetadata metadata={token} />
							<S.ActionsWrapper>
								<Button
									type="primary"
									label={language.viewDetails}
									handlePress={() => (window.location.href = `#/asset/${token.processId}`)}
								/>
							</S.ActionsWrapper>
						</S.TokenCard>
					))}
				</S.ListWrapper>
			);
		} else if (currentTab === 'mine') {
			if (loadingMine)
				return (
					<S.LoadingWrapper>
						<Loader />
					</S.LoadingWrapper>
				);
			if (myArns.length === 0)
				return (
					<S.EmptyWrapper>
						<p>{language.noARNSFound}</p>
					</S.EmptyWrapper>
				);
			return (
				<S.ListWrapper>
					{myArns.map((token, index) => (
						<S.TokenCard key={index} className="border-wrapper-alt1">
							<ARNSMetadata metadata={token} />
							<S.ActionsWrapper>
								<Button
									type="primary"
									label={language.viewDetails}
									handlePress={() => (window.location.href = `#/asset/${token.processId}`)}
								/>
							</S.ActionsWrapper>
						</S.TokenCard>
					))}
				</S.ListWrapper>
			);
		}
		return null;
	}

	return (
		<S.Wrapper>
			<S.Header>
				<h1>{language.arnsMarketplace}</h1>
			</S.Header>
			<S.TabsWrapper>
				<Tabs onTabPropClick={(label: string) => setCurrentTab(label === 'All ARNS' ? 'all' : 'mine')} type={'alt1'}>
					{MARKET_TABS.map((tab, index) => (
						<S.TabWrapper key={index} {...tab} />
					))}
				</Tabs>
				<S.TabContent>{getCurrentTab()}</S.TabContent>
			</S.TabsWrapper>
		</S.Wrapper>
	);
}
