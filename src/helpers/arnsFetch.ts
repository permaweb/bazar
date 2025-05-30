import { ANT, ARIO, getANTProcessesOwnedByWallet } from '@ar.io/sdk';

export interface ANTInfo {
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
	listed?: boolean; // Whether the token is listed for sale
}

const BATCH_SIZE = 5;
const HYPERBEAM_NODES = [
	'https://router-1.forward.computer', // Using only the working node
];
const HYPERBEAM_COOLDOWN = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Cache for ANT info to avoid refetching
export const antInfoCache = new Map<string, ANTInfo>();
const hyperbeamFailureCache = new Map<string, number>(); // Tracks last failure time

const LOCAL_CACHE_KEY = 'arnsInfoCache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function loadLocalCache() {
	try {
		const raw = localStorage.getItem(LOCAL_CACHE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		console.log('[ARNS CACHE] Loaded localStorage cache:', parsed);
		return parsed;
	} catch (e) {
		console.warn('[ARNS CACHE] Failed to load localStorage cache:', e);
		return {};
	}
}

function saveLocalCache(cache) {
	console.log('[ARNS CACHE] Saving to localStorage cache:', cache);
	localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
}

function getCachedANTInfo(processId) {
	const cache = loadLocalCache();
	const entry = cache[processId];
	if (entry) {
		const expired = Date.now() - entry.timestamp >= CACHE_TTL;
		if (expired) {
			console.log(`[ARNS CACHE] Cache expired for processId ${processId}`);
			return null;
		} else {
			console.log(`[ARNS CACHE] Cache hit for processId ${processId}`);
			return entry.data;
		}
	}
	console.log(`[ARNS CACHE] Cache miss for processId ${processId}`);
	return null;
}

function setCachedANTInfo(processId, data) {
	const cache = loadLocalCache();
	cache[processId] = { data, timestamp: Date.now() };
	console.log(`[ARNS CACHE] Setting cache for processId ${processId}`);
	saveLocalCache(cache);
}

// Helper function to calculate exponential backoff delay
const getBackoffDelay = (retryCount: number): number => {
	return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), 10000);
};

// Helper function to initialize process
const initializeProcess = async (processId: string, node: string, retryCount = 0): Promise<boolean> => {
	try {
		const initUrl = `${node}/${processId}~process@1.0/init`;
		console.log(`[HyperBEAM] Starting process initialization for ${processId} (attempt ${retryCount + 1})`);

		// Format message according to process device documentation
		const message = {
			device: 'process@1.0',
			function: 'init',
			Scheduler_Device: 'scheduler@1.0',
			Execution_Device: 'stack@1.0',
			Execution_Stack: ['scheduler@1.0', 'wasm64@1.0', 'json@1.0', 'relay@1.0'],
			Cache_Frequency: 60, // Cache every 60 seconds
			Cache_Keys: ['state', 'results'],
		};

		const response = await fetch(initUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify(message),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.warn(`[HyperBEAM] Init failed for ${processId}:`, {
				status: response.status,
				statusText: response.statusText,
				error: errorText,
			});

			if (retryCount < MAX_RETRIES) {
				const delay = getBackoffDelay(retryCount);
				console.log(`[HyperBEAM] Retrying initialization in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				return initializeProcess(processId, node, retryCount + 1);
			}

			return false;
		}

		// Wait for initialization to complete
		await new Promise((resolve) => setTimeout(resolve, 2000));
		return true;
	} catch (e) {
		console.error(`[HyperBEAM] Error during process initialization for ${processId}:`, e);

		if (retryCount < MAX_RETRIES) {
			const delay = getBackoffDelay(retryCount);
			console.log(`[HyperBEAM] Retrying initialization in ${delay}ms...`);
			await new Promise((resolve) => setTimeout(resolve, delay));
			return initializeProcess(processId, node, retryCount + 1);
		}

		return false;
	}
};

// Helper function to ensure tables are patched
const ensureTablesPatched = async (processId: string, node: string, retryCount = 0): Promise<boolean> => {
	try {
		console.log(`[HyperBEAM] Starting table patching process for ${processId} (attempt ${retryCount + 1})`);

		// First initialize the process
		const initialized = await initializeProcess(processId, node);
		if (!initialized) {
			console.warn(`[HyperBEAM] Process initialization failed for ${processId}, skipping table patch`);
			return false;
		}

		const patchUrl = `${node}/${processId}~process@1.0/patch`;
		console.log(`[HyperBEAM] Patching tables for ${processId} at ${patchUrl}`);

		// Format the message according to process device documentation
		const message = {
			device: 'process@1.0',
			function: 'patch',
			tables: {
				state: {
					Name: '',
					Ticker: '',
					Description: '',
					Keywords: [],
					Denomination: '',
					Owner: '',
					Logo: '',
					'Total-Supply': '',
					Handlers: [],
					HandlerNames: [],
				},
			},
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		};

		console.log(`[HyperBEAM] Patch request payload:`, JSON.stringify(message, null, 2));

		const response = await fetch(patchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify(message),
		});

		console.log(`[HyperBEAM] Patch response status: ${response.status}`);
		console.log(`[HyperBEAM] Patch response headers:`, Object.fromEntries(response.headers.entries()));

		if (!response.ok) {
			const errorText = await response.text();
			console.warn(`[HyperBEAM] Patch failed for ${processId}:`, {
				status: response.status,
				statusText: response.statusText,
				error: errorText,
				headers: Object.fromEntries(response.headers.entries()),
			});

			if (retryCount < MAX_RETRIES) {
				const delay = getBackoffDelay(retryCount);
				console.log(`[HyperBEAM] Retrying patch in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				return ensureTablesPatched(processId, node, retryCount + 1);
			}

			return false;
		}

		const responseData = await response.json();
		console.log(`[HyperBEAM] Patch successful for ${processId}:`, responseData);

		// Wait for patch to be processed
		console.log(`[HyperBEAM] Waiting for patch to be processed...`);
		await new Promise((resolve) => setTimeout(resolve, 2000));

		console.log(`[HyperBEAM] Table patching completed for ${processId}`);
		return true;
	} catch (e) {
		console.error(`[HyperBEAM] Error during table patching for ${processId}:`, {
			error: e,
			message: e.message,
			stack: e.stack,
			type: e.constructor.name,
		});

		if (retryCount < MAX_RETRIES) {
			const delay = getBackoffDelay(retryCount);
			console.log(`[HyperBEAM] Retrying patch in ${delay}ms...`);
			await new Promise((resolve) => setTimeout(resolve, delay));
			return ensureTablesPatched(processId, node, retryCount + 1);
		}

		return false;
	}
};

// Fallback method using dry-run
export const fetchANTInfoWithDryRun = async (
	processId: string,
	name?: string,
	setLoadingState?: (loading: boolean) => void
): Promise<ANTInfo | null> => {
	try {
		console.log(`Fetching ANT info for ${processId} via dry-run`);
		setLoadingState?.(true);
		// Check cache first
		const cached = getCachedANTInfo(processId);
		if (cached) {
			console.log(`Using cached ANT info for ${processId}`);
			const cachedInfo = cached;
			return name ? { ...cachedInfo, name } : cachedInfo;
		}
		const ant = ANT.init({ processId });
		const info = await ant.getInfo();
		console.log(`Successfully fetched ANT info via dry-run for ${processId}:`, info);
		const antInfo = { ...info, processId, name } as ANTInfo;
		// Cache the result
		setCachedANTInfo(processId, antInfo);
		return antInfo;
	} catch (e: any) {
		console.error(`Error fetching ANT info via dry-run for ${processId}:`, e);
		return null;
	} finally {
		setLoadingState?.(false);
	}
};

// Update the fetchANTInfoWithHyperbeam function to handle socket errors better
export const fetchANTInfoWithHyperbeam = async (
	processId: string,
	name?: string,
	setLoadingState?: (loading: boolean) => void,
	retryCount = 0,
	nodeIndex = 0
): Promise<ANTInfo | null> => {
	try {
		setLoadingState?.(true);

		// If we've tried all nodes, fall back to dry-run
		if (nodeIndex >= HYPERBEAM_NODES.length) {
			console.log(`[HyperBEAM] All nodes failed for ${processId}, falling back to dry-run`);
			return fetchANTInfoWithDryRun(processId, name, setLoadingState);
		}

		const node = HYPERBEAM_NODES[nodeIndex];
		console.log(`[HyperBEAM] Trying node ${nodeIndex + 1}/${HYPERBEAM_NODES.length}: ${node}`);

		// First ensure process is initialized
		const initialized = await initializeProcess(processId, node);
		if (!initialized) {
			console.warn(`[HyperBEAM] Process initialization failed for ${processId}, trying next node`);
			return fetchANTInfoWithHyperbeam(processId, name, setLoadingState, 0, nodeIndex + 1);
		}

		const url = `${node}/${processId}~process@1.0/now`;
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
			},
		});

		if (!response.ok) {
			const errorText = await response.text();

			// Handle specific error cases
			if (response.status === 500 && errorText.includes('socket_closed_remotely')) {
				console.warn(`[HyperBEAM] Socket closed for ${processId} on ${node}, trying next node`);
				return fetchANTInfoWithHyperbeam(processId, name, setLoadingState, 0, nodeIndex + 1);
			}

			if (response.status === 429 || response.status === 403) {
				console.warn(`[HyperBEAM] Rate limited or forbidden for ${processId}, falling back to dry-run`);
				return fetchANTInfoWithDryRun(processId, name, setLoadingState);
			}

			throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
		}

		const data = await response.json();
		if (!data || typeof data !== 'object') {
			throw new Error(`[HyperBEAM] Invalid data format for ${processId}`);
		}

		const antInfo = { ...data, processId, name } as ANTInfo;
		setCachedANTInfo(processId, antInfo);
		return antInfo;
	} catch (e: any) {
		console.warn(`[HyperBEAM] Failed for ${processId} on node ${HYPERBEAM_NODES[nodeIndex]}:`, e);

		// If we haven't exceeded max retries, try the next node
		if (retryCount < MAX_RETRIES) {
			const delay = getBackoffDelay(retryCount);
			console.log(`[HyperBEAM] Retrying in ${delay}ms... (attempt ${retryCount + 2})`);
			await new Promise((resolve) => setTimeout(resolve, delay));
			return fetchANTInfoWithHyperbeam(processId, name, setLoadingState, retryCount + 1, nodeIndex);
		}

		// If we've tried all nodes, fall back to dry-run
		if (nodeIndex + 1 < HYPERBEAM_NODES.length) {
			return fetchANTInfoWithHyperbeam(processId, name, setLoadingState, 0, nodeIndex + 1);
		}

		return fetchANTInfoWithDryRun(processId, name, setLoadingState);
	} finally {
		setLoadingState?.(false);
	}
};

/**
 * Fetch all ARNS/ANTs for a user address in batch.
 * @param address - The user's wallet or profile address
 * @returns Array of ANTInfo objects
 */
export async function fetchAllANTsForUser(address: string): Promise<any[]> {
	console.log('[ARNS FETCH] Fetching all ANTs for user:', address);
	try {
		const processIds = await getANTProcessesOwnedByWallet({ address });
		console.log(`[ARNS FETCH] Got ${processIds.length} process IDs for user`);
		const ants: any[] = [];
		for (let i = 0; i < processIds.length; i += BATCH_SIZE) {
			const batch = processIds.slice(i, i + BATCH_SIZE);
			console.log(
				`[ARNS FETCH] Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(processIds.length / BATCH_SIZE)}`
			);
			const batchResults = await Promise.all(
				batch.map(async (processId) => {
					try {
						const ant = await fetchANTInfoWithHyperbeam(processId);
						if (ant) {
							console.log(`[ARNS FETCH] Got ANT info for ${processId}`);
						}
						return ant;
					} catch (e) {
						console.warn(`[ARNS FETCH] Failed to fetch ANT info for ${processId}:`, e);
						return null;
					}
				})
			);
			ants.push(...batchResults.filter(Boolean));
		}
		console.log(`[ARNS FETCH] Finished fetching ${ants.length} ANTs for user`);
		return ants;
	} catch (e) {
		console.warn('[ARNS FETCH] Failed to fetch ANTs for user:', e);
		return [];
	}
}

/**
 * Fetch all ARNS/ANTs in the marketplace (not just for a user)
 * @returns Array of ANTInfo objects
 */
export async function fetchAllMarketplaceANTs(): Promise<ANTInfo[]> {
	console.log('[ARNS FETCH] Fetching all marketplace ANTs');
	try {
		const ario = ARIO.mainnet();
		// You can adjust the limit as needed
		const { items: records } = await ario.getArNSRecords({
			limit: 100,
			sortBy: 'startTimestamp',
			sortOrder: 'desc',
		});
		const ants: ANTInfo[] = await Promise.all(
			records.map(async (rec: any) => {
				try {
					const ant = await fetchANTInfoWithHyperbeam(rec.processId, rec.name);
					return ant;
				} catch (e) {
					console.warn(`[ARNS FETCH] Failed to fetch ANT info for ${rec.processId}:`, e);
					return null;
				}
			})
		);
		const validAnts = ants.filter(Boolean) as ANTInfo[];
		console.log(`[ARNS FETCH] Finished fetching ${validAnts.length} marketplace ANTs`);
		return validAnts;
	} catch (e) {
		console.warn('[ARNS FETCH] Failed to fetch marketplace ANTs:', e);
		return [];
	}
}
