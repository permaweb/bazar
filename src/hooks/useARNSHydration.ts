import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { fetchAllANTsForUser, fetchAllMarketplaceANTs } from 'helpers/arnsFetch';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { RootState } from 'store';
import { fetchARNSFailure, fetchARNSStart, fetchARNSSuccess, hydrateARNS } from 'store/arns';

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function useARNSHydration() {
	const dispatch = useDispatch();
	const arweaveProvider = useArweaveProvider();
	const { arnsById, lastFetched, loading } = useSelector((state: RootState) => state.arnsReducer);

	const [allArns, setAllArns] = useState<any[]>([]);
	const [myArns, setMyArns] = useState<any[]>([]);
	const [loadingAll, setLoadingAll] = useState(true);
	const [loadingMine, setLoadingMine] = useState(true);

	useEffect(() => {
		let isMounted = true;
		async function hydrateAllArns() {
			setLoadingAll(true);
			try {
				const ants = await fetchAllMarketplaceANTs();
				if (isMounted) setAllArns(ants);
			} catch (e) {
				if (isMounted) setAllArns([]);
			} finally {
				if (isMounted) setLoadingAll(false);
			}
		}
		hydrateAllArns();
		return () => {
			isMounted = false;
		};
	}, []);

	useEffect(() => {
		let isMounted = true;
		async function hydrateMyArns() {
			setLoadingMine(true);
			try {
				if (!arweaveProvider.walletAddress) {
					if (isMounted) setMyArns([]);
					if (isMounted) setLoadingMine(false);
					return;
				}
				const ants = await fetchAllANTsForUser(arweaveProvider.walletAddress);
				if (isMounted) setMyArns(ants);
			} catch (e) {
				if (isMounted) setMyArns([]);
			} finally {
				if (isMounted) setLoadingMine(false);
			}
		}
		hydrateMyArns();
	}, [arweaveProvider.walletAddress]);

	return {
		allArns,
		myArns,
		loadingAll,
		loadingMine,
		arnsById,
		loading,
		lastFetched,
	};
}
