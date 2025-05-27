import { useEffect, useState } from 'react';
import { ANT, getANTProcessesOwnedByWallet } from '@ar.io/sdk/web';

import { useArweaveProvider } from 'providers/ArweaveProvider';

export function useARNSMarketplaceData() {
	const arweaveProvider = useArweaveProvider();
	const [allArns, setAllArns] = useState<any[]>([]);
	const [myArns, setMyArns] = useState<any[]>([]);
	const [loadingAll, setLoadingAll] = useState(true);
	const [loadingMine, setLoadingMine] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch all ARNS/ANTs using GraphQL
	useEffect(() => {
		async function fetchAllArns() {
			setLoadingAll(true);
			try {
				const response = await fetch('https://arweave.net/graphql', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						query: `
              query {
                transactions(
                  tags: [
                    { name: "Type", values: ["Process"] },
                    { name: "Variant", values: ["ao.TN.1"] }
                  ]
                  first: 50
                ) {
                  edges {
                    node {
                      id
                    }
                  }
                }
              }
            `,
					}),
				});
				const data = await response.json();
				const processIds = data.data.transactions.edges.map((edge: any) => edge.node.id);
				const ants = await Promise.all(
					processIds.map(async (processId: string) => {
						try {
							const ant = ANT.init({ processId });
							const info = await ant.getInfo();
							return {
								name: info.Name || '',
								ticker: info.Ticker || '',
								owner: info.Owner || '',
								logo: info.Logo || '',
								description: info.Description || '',
								processId,
							};
						} catch (e) {
							return null;
						}
					})
				);
				setAllArns(ants.filter(Boolean));
			} catch (err: any) {
				setError(err.message);
				setAllArns([]);
			} finally {
				setLoadingAll(false);
			}
		}
		fetchAllArns();
	}, []);

	// Fetch owned ANTs using ar.io SDK
	useEffect(() => {
		async function fetchMyArns() {
			setLoadingMine(true);
			try {
				const address = arweaveProvider.walletAddress;
				if (!address) {
					setMyArns([]);
					setLoadingMine(false);
					return;
				}
				// getANTProcessesOwnedByWallet expects an object with address
				const processIds = await getANTProcessesOwnedByWallet({ address });
				const ants = await Promise.all(
					processIds.map(async (processId: string) => {
						try {
							const ant = ANT.init({ processId });
							const info = await ant.getInfo();
							return {
								name: info.Name || '',
								ticker: info.Ticker || '',
								owner: info.Owner || '',
								logo: info.Logo || '',
								description: info.Description || '',
								processId,
							};
						} catch (e) {
							return null;
						}
					})
				);
				setMyArns(ants.filter(Boolean));
			} catch (err: any) {
				setMyArns([]);
			} finally {
				setLoadingMine(false);
			}
		}
		fetchMyArns();
	}, [arweaveProvider.walletAddress]);

	return {
		allArns,
		myArns,
		loadingAll,
		loadingMine,
		error,
	};
}
