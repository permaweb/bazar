import { createDataItemSigner, dryrun, message, result, results } from 'helpers/aoconnect';
import { CURSORS, GATEWAYS, PAGINATORS } from 'helpers/config';
import {
	BatchAGQLResponseType,
	BatchGQLArgsType,
	DefaultGQLResponseType,
	GQLArgsType,
	GQLNodeResponseType,
	QueryBodyGQLArgsType,
	TagType,
} from 'helpers/types';
import { getTagValue } from 'helpers/utils';

const debug = (..._args: any[]) => {};

export async function getGQLData(args: GQLArgsType): Promise<DefaultGQLResponseType> {
	const paginator = args.paginator ? args.paginator : PAGINATORS.default;

	let data: GQLNodeResponseType[] = [];
	let count: number = 0;
	let nextCursor: string | null = null;

	if (args.ids && !args.ids.length) {
		return { data: data, count: count, nextCursor: nextCursor, previousCursor: null };
	}

	try {
		debug('getGQLData: Starting query with args', args);
		let queryBody: string = getQueryBody(args);
		debug('getGQLData: Query body', queryBody);
		const response = await getResponse({ gateway: args.gateway, query: getQuery(queryBody) });
		debug('getGQLData: Response', response);

		if (response.data.transactions.edges.length) {
			data = [...response.data.transactions.edges];
			count = response.data.transactions.count ?? 0;

			const lastResults: boolean = data.length < paginator || !response.data.transactions.pageInfo.hasNextPage;

			if (lastResults) nextCursor = CURSORS.end;
			else nextCursor = data[data.length - 1].cursor;

			return {
				data: data,
				count: count,
				nextCursor: nextCursor,
				previousCursor: null,
			};
		} else {
			return { data: data, count: count, nextCursor: nextCursor, previousCursor: null };
		}
	} catch (e: any) {
		console.error(e);
		return { data: data, count: count, nextCursor: nextCursor, previousCursor: null };
	}
}

export async function getBatchGQLData(args: BatchGQLArgsType): Promise<BatchAGQLResponseType> {
	let responseObject: BatchAGQLResponseType = {};
	let queryBody: string = '';

	for (const [queryKey, baseArgs] of Object.entries(args.entries)) {
		responseObject[queryKey] = { data: [], count: 0, nextCursor: null, previousCursor: null };
		queryBody += getQueryBody({ ...baseArgs, gateway: args.gateway, queryKey: queryKey });
	}

	try {
		const response = await getResponse({ gateway: args.gateway, query: getQuery(queryBody) });

		if (response && response.data) {
			for (const queryKey of Object.keys(response.data)) {
				const paginator = args.entries[queryKey].paginator ? args.entries[queryKey].paginator : PAGINATORS.default;

				let data: GQLNodeResponseType[] = [];
				let count: number = 0;
				let nextCursor: string | null = null;

				if (response.data[queryKey].edges.length) {
					data = [...response.data[queryKey].edges];
					count = response.data[queryKey].count ?? 0;

					const lastResults: boolean = data.length < paginator || !response.data[queryKey].pageInfo.hasNextPage;

					if (lastResults) nextCursor = CURSORS.end;
					else nextCursor = data[data.length - 1].cursor;

					responseObject[queryKey] = {
						data: [...response.data[queryKey].edges],
						count: count,
						nextCursor: nextCursor,
						previousCursor: null,
					};
				}
			}
		}
		return responseObject;
	} catch (e: any) {
		console.error(e);
		return responseObject;
	}
}

function getQuery(body: string): string {
	const query = { query: `query { ${body} }` };
	return JSON.stringify(query);
}

function getQueryBody(args: QueryBodyGQLArgsType): string {
	const paginator = args.paginator ? args.paginator : PAGINATORS.default;
	const ids = args.ids ? JSON.stringify(args.ids) : null;
	let blockFilter: { min?: number; max?: number } | null = null;
	if (args.minBlock !== undefined && args.minBlock !== null) {
		blockFilter = {};
		blockFilter.min = args.minBlock;
	}
	const blockFilterStr = blockFilter ? JSON.stringify(blockFilter).replace(/"([^"]+)":/g, '$1:') : null;
	const tagFilters = args.tagFilters
		? JSON.stringify(args.tagFilters)
				.replace(/"(name)":/g, '$1:')
				.replace(/"(values)":/g, '$1:')
				.replace(/"FUZZY_OR"/g, 'FUZZY_OR')
		: null;
	const owners = args.owners ? JSON.stringify(args.owners) : null;
	const cursor = args.cursor && args.cursor !== CURSORS.end ? `"${args.cursor}"` : null;

	let fetchCount: string = `first: ${paginator}`;
	let txCount: string = '';
	let nodeFields: string = `data { size type } owner { address } block { height timestamp }`;
	let order: string = '';

	switch (args.gateway) {
		case GATEWAYS.arweave:
			break;
		case GATEWAYS.goldsky:
			txCount = `count`;
			break;
	}

	let body = `
		transactions(
				ids: ${ids},
				tags: ${tagFilters},
				${fetchCount}
				owners: ${owners},
				block: ${blockFilterStr},
				after: ${cursor},
				${order}
				
			){
			${txCount}
				pageInfo {
					hasNextPage
				}
				edges {
					cursor
					node {
						id
						tags {
							name 
							value 
						}
						${nodeFields}
					}
				}
		}`;

	if (args.queryKey) body = `${args.queryKey}: ${body}`;

	return body;
}

async function getResponse(args: { gateway: string; query: string }): Promise<any> {
	try {
		debug('getResponse: Making request to', `https://${args.gateway}/graphql`);
		debug('getResponse: Query', args.query);
		const response = await fetch(`https://${args.gateway}/graphql`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: args.query,
		});
		debug('getResponse: Response status', response.status);
		const result = await response.json();
		debug('getResponse: Response data', result);
		return result;
	} catch (e: any) {
		console.error('🔍 getResponse: Error:', e);
		throw e;
	}
}

export async function messageResult(args: {
	processId: string;
	wallet: any;
	action: string;
	tags: TagType[] | null;
	data: any;
	useRawData?: boolean;
}): Promise<any> {
	try {
		const tags = [{ name: 'Action', value: args.action }];
		if (args.tags) tags.push(...args.tags);

		const data = args.useRawData ? args.data : JSON.stringify(args.data);

		const txId = await message({
			process: args.processId,
			signer: createDataItemSigner(args.wallet),
			tags: tags,
			data: data,
		});

		const { Messages } = await result({ message: txId, process: args.processId });

		if (Messages && Messages.length) {
			const response = {};

			Messages.forEach((message: any) => {
				const action = getTagValue(message.Tags, 'Action') || args.action;

				let responseData = null;
				const messageData = message.Data;

				if (messageData) {
					try {
						responseData = JSON.parse(messageData);
					} catch {
						responseData = messageData;
					}
				}

				const responseStatus = getTagValue(message.Tags, 'Status');
				const responseMessage = getTagValue(message.Tags, 'Message');

				response[action] = {
					id: txId,
					status: responseStatus,
					message: responseMessage,
					data: responseData,
				};
			});

			return response;
		} else return null;
	} catch (e) {
		console.error(e);
	}
}

export async function messageResults(args: {
	processId: string;
	wallet: any;
	action: string;
	tags: TagType[] | null;
	data: any;
	responses?: string[];
	handler?: string;
	timeout?: number; // Add timeout parameter for legacy assets
	resultProcessId?: string; // Optional: query results from a different process (e.g., when using Zone Profile forwarding)
}): Promise<any> {
	try {
		const tags = [{ name: 'Action', value: args.action }];
		if (args.tags) tags.push(...args.tags);

		if (process.env.NODE_ENV === 'development') {
			console.log('[messageResults] Sending message:', {
				processId: args.processId,
				action: args.action,
				tags: tags,
				data: args.data,
				resultProcessId: args.resultProcessId,
			});
		}

		const messageTxId = await message({
			process: args.processId,
			signer: createDataItemSigner(args.wallet),
			tags: tags,
			data: JSON.stringify(args.data),
		});

		if (process.env.NODE_ENV === 'development') {
			console.log('[messageResults] Message sent, txId:', messageTxId);
		}

		// Use custom timeout for legacy assets, default to 1 second for regular assets
		const timeoutMs = args.timeout || 1000;
		if (process.env.NODE_ENV === 'development') {
			console.log('[messageResults] Waiting', timeoutMs, 'ms for process to respond...');
		}
		await new Promise((resolve) => setTimeout(resolve, timeoutMs));

		// For claim operations, wait a bit more and retry querying results
		// This handles cases where the response takes longer to appear in results
		const isClaimOperation = args.action === 'Claim' || args.action === 'Run-Action';
		if (isClaimOperation && timeoutMs >= 5000) {
			if (process.env.NODE_ENV === 'development') {
				console.log('[messageResults] Claim operation detected, waiting additional 2s for response...');
			}
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		// Query results from the resultProcessId if provided (for Zone Profile forwarding),
		// otherwise query from the process we sent the message to
		const resultProcessId = args.resultProcessId || args.processId;

		// Determine which actions to look for in results
		const isDifferentProcess = args.resultProcessId && args.resultProcessId !== args.processId;
		const expectedActions = isDifferentProcess ? args.responses || [] : [args.action, ...(args.responses || [])];

		if (process.env.NODE_ENV === 'development') {
			console.log('[messageResults] Querying results from process:', resultProcessId);
			console.log('[messageResults] Looking for actions:', expectedActions);
			console.log('[messageResults] Is different process:', isDifferentProcess);
		}

		// Retry logic for rate limiting (429 errors) and for finding responses
		let messageResults = null;
		let retries = 3;
		let delay = 1000; // Start with 1 second delay

		while (retries > 0) {
			try {
				messageResults = await results({
					process: resultProcessId,
					sort: 'DESC',
					limit: 100,
				});

				// For claim operations, check if we found the expected response
				if (isClaimOperation && messageResults?.edges) {
					const expectedActions =
						args.resultProcessId && args.resultProcessId !== args.processId
							? args.responses || []
							: [args.action, ...(args.responses || [])];

					let foundResponse = false;
					for (const edge of messageResults.edges) {
						if (edge.node?.Messages) {
							for (const msg of edge.node.Messages) {
								const action = getTagValue(msg.Tags, 'Action');
								if (action && expectedActions.includes(action)) {
									foundResponse = true;
									break;
								}
							}
						}
						if (foundResponse) break;
					}

					// If we didn't find the response and have retries left, wait and retry
					if (!foundResponse && retries > 1) {
						if (process.env.NODE_ENV === 'development') {
							console.log(
								`[messageResults] Claim response not found yet, retrying in ${delay}ms... (${retries - 1} retries left)`
							);
						}
						await new Promise((resolve) => setTimeout(resolve, delay));
						delay *= 1.5; // Gradual backoff
						retries--;
						continue;
					}
				}

				break; // Success, exit retry loop
			} catch (error: any) {
				retries--;
				if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
					if (retries > 0) {
						if (process.env.NODE_ENV === 'development') {
							console.log(`[messageResults] Rate limited, retrying in ${delay}ms... (${retries} retries left)`);
						}
						await new Promise((resolve) => setTimeout(resolve, delay));
						delay *= 2; // Exponential backoff
					} else {
						throw error; // Re-throw if out of retries
					}
				} else {
					throw error; // Re-throw non-rate-limit errors immediately
				}
			}
		}

		if (process.env.NODE_ENV === 'development') {
			console.log('[messageResults] Found', messageResults?.edges?.length || 0, 'result edges');
			if (messageResults?.edges?.length > 0) {
				console.log('[messageResults] First edge node:', JSON.stringify(messageResults.edges[0].node, null, 2));
			}
		}

		if (!messageResults) {
			if (process.env.NODE_ENV === 'development') {
				console.warn('[messageResults] No results returned after retries');
			}
			return null;
		}

		if (messageResults.edges && messageResults.edges.length) {
			const response = {};

			for (const result of messageResults.edges) {
				if (result.node && result.node.Messages && result.node.Messages.length) {
					if (process.env.NODE_ENV === 'development') {
						console.log('[messageResults] Processing result node with', result.node.Messages.length, 'messages');
					}
					// When querying results from a different process (Zone Profile forwarding),
					// don't include the original action in the resultSet since it won't be in those results
					const resultSet: string[] = [];
					if (args.resultProcessId && args.resultProcessId !== args.processId) {
						// Querying from different process - only look for response actions
						if (args.responses) resultSet.push(...args.responses);
					} else {
						// Querying from same process - include original action
						resultSet.push(args.action);
						if (args.responses) resultSet.push(...args.responses);
					}

					for (const message of result.node.Messages) {
						const action = getTagValue(message.Tags, 'Action');

						if (process.env.NODE_ENV === 'development') {
							console.log('[messageResults] Processing message:', {
								action: action,
								allTags: message.Tags,
								hasData: !!message.Data,
								resultSet: resultSet,
								isInResultSet: action ? resultSet.includes(action) : false,
							});
						}

						if (action) {
							let responseData = null;
							const messageData = message.Data;

							if (messageData) {
								try {
									responseData = JSON.parse(messageData);
								} catch {
									responseData = messageData;
								}
							}

							const responseStatus = getTagValue(message.Tags, 'Status');
							const responseMessage = getTagValue(message.Tags, 'Message');

							if (process.env.NODE_ENV === 'development') {
								console.log('[messageResults] Message details:', {
									action: action,
									status: responseStatus,
									message: responseMessage,
									data: responseData,
								});
							}

							if (action === 'Action-Response') {
								const responseHandler = getTagValue(message.Tags, 'Handler');
								if (args.handler && args.handler === responseHandler) {
									response[action] = {
										status: responseStatus,
										message: responseMessage,
										data: responseData,
									};
								}
							} else {
								if (resultSet.includes(action)) {
									response[action] = {
										status: responseStatus,
										message: responseMessage,
										data: responseData,
									};
								}
							}

							// Break if we found all expected responses (or at least one if we're only looking for responses)
							if (resultSet.length > 0 && Object.keys(response).length >= resultSet.length) {
								if (process.env.NODE_ENV === 'development') {
									console.log('[messageResults] Found all expected responses, breaking');
								}
								break;
							}
							// If we found any response action, that's good enough
							if (Object.keys(response).length > 0 && isDifferentProcess) {
								if (process.env.NODE_ENV === 'development') {
									console.log('[messageResults] Found response action for different process, breaking');
								}
								break;
							}
						}
					}
				}
			}

			if (process.env.NODE_ENV === 'development') {
				console.log('[messageResults] Final response object:', response);
			}
			return response;
		}

		if (process.env.NODE_ENV === 'development') {
			console.warn('[messageResults] No messages found in results edges');
		}
		return null;
	} catch (e) {
		console.error('[messageResults] Error:', e);
		throw e;
	}
}

export async function readHandler(args: {
	processId: string;
	action: string;
	tags?: TagType[];
	data?: any;
}): Promise<any> {
	// Try HyperBEAM first for Get-Campaign-Stats, Get-Claim-Status, and Get-Balance (faster, avoids CU rate limits)
	if (args.action === 'Get-Campaign-Stats' || args.action === 'Get-Claim-Status' || args.action === 'Get-Balance') {
		try {
			const { HB } = await import('helpers/config');

			// Build list of nodes to try: primary first, then fallbacks
			const nodesToTry = [HB.defaultNode, ...(HB.fallbackNodes || [])];

			const headers = {
				'require-codec': 'application/json',
				'accept-bundle': 'true',
			};

			// Increase timeout to 10 seconds - HyperBEAM can take 4-8 seconds to respond
			const timeoutMs = 10000;

			let res: Response | undefined;
			let state: any;
			let lastError: Error | null = null;

			// Try each node in sequence
			for (const node of nodesToTry) {
				try {
					const nodeUrl = `${node}/${args.processId}~process@1.0/now`;

					const controller = new AbortController();
					const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

					try {
						// Try /asset path first (where patch@1.0 exports campaign state with key 'asset')
						const assetUrl = `${nodeUrl}/asset`;
						res = await fetch(assetUrl, { headers, signal: controller.signal });

						if (res.ok) {
							state = await res.json();
							clearTimeout(timeoutId);
							break; // Success! Exit the loop
						} else {
							// Fallback to full state at /now
							res = await fetch(nodeUrl, { headers, signal: controller.signal });
							if (res.ok) {
								state = await res.json();
								clearTimeout(timeoutId);
								break; // Success! Exit the loop
							}
						}
						clearTimeout(timeoutId);
					} catch (fetchError: any) {
						clearTimeout(timeoutId);
						if (fetchError.name === 'AbortError') {
							lastError = new Error(`HyperBEAM request to ${node} timed out after ${timeoutMs}ms`);
							console.warn(`[${new Date().toISOString()}] [readHandler] Node ${node} timed out, trying next node...`);
							continue; // Try next node
						}
						lastError = fetchError;
						console.warn(`[${new Date().toISOString()}] [readHandler] Node ${node} failed:`, fetchError.message);
						continue; // Try next node
					}
				} catch (nodeError: any) {
					lastError = nodeError;
					console.warn(`[${new Date().toISOString()}] [readHandler] Node ${node} error:`, nodeError.message);
					continue; // Try next node
				}
			}

			// If we didn't get a successful response from any node, throw the last error
			if (!res || !res.ok || !state) {
				if (lastError) {
					throw lastError;
				}
				throw new Error(`All HyperBEAM nodes failed. Last node tried: ${nodesToTry[nodesToTry.length - 1]}`);
			}

			if (res.ok && state) {
				// HyperBEAM may wrap the state in different structures - try to extract the actual state
				// The state from patch@1.0 is sent as JSON-encoded, so it might be in 'body' as a string
				let actualState = state;

				// First, check if state is directly accessible (has Claims or CampaignConfig)
				if (state.Claims || state.CampaignConfig || (state.Balances && state.Token)) {
					actualState = state;
				}
				// Check body field (most common location for patch@1.0 exports)
				else if (state.body) {
					if (typeof state.body === 'string') {
						try {
							const parsedBody = JSON.parse(state.body);
							if (parsedBody.Claims || parsedBody.CampaignConfig || parsedBody.Balances || parsedBody.Token) {
								actualState = parsedBody;
							} else {
								// Body might contain the state nested further - try using it anyway
								actualState = parsedBody;
							}
						} catch (e) {
							console.warn(`[readHandler] Failed to parse body as JSON:`, e);
						}
					} else if (typeof state.body === 'object') {
						if (state.body.Claims || state.body.CampaignConfig || state.body.Balances || state.body.Token) {
							actualState = state.body;
						} else {
							// Try using body anyway
							actualState = state.body;
						}
					}
				}
				// Check ao-result field
				else if (state['ao-result'] && typeof state['ao-result'] === 'object') {
					if (
						state['ao-result'].Claims ||
						state['ao-result'].CampaignConfig ||
						(state['ao-result'].Balances && state['ao-result'].Token)
					) {
						actualState = state['ao-result'];
					}
				}
				// Check asset field
				else if (state.asset && typeof state.asset === 'object') {
					if (state.asset.Claims || state.asset.CampaignConfig || (state.asset.Balances && state.asset.Token)) {
						actualState = state.asset;
					}
				}

				// If still not found, try parsing the entire state as JSON string
				if (!actualState.Claims && !actualState.CampaignConfig && typeof state === 'string') {
					try {
						actualState = JSON.parse(state);
					} catch (e) {
						console.warn(`[readHandler] Failed to parse state as JSON:`, e);
					}
				}

				// Handle Get-Claim-Status by reading Claims table from state
				if (args.action === 'Get-Claim-Status') {
					const walletAddress = args.tags?.find((t) => t.name === 'Wallet-Address')?.value;

					// Claims table is exported via patch@1.0, accessible at various paths
					const claims =
						actualState.Claims ||
						actualState.claims ||
						state.Claims ||
						state.claims ||
						state.asset?.Claims ||
						state.asset?.claims ||
						{};
					const claimsCount = Object.keys(claims).length;
					const totalSupply =
						actualState.CampaignConfig?.TotalSupply ||
						actualState.CampaignConfig?.totalSupply ||
						state.CampaignConfig?.TotalSupply ||
						state.asset?.CampaignConfig?.TotalSupply ||
						1984;

					if (walletAddress && claims[walletAddress]) {
						return {
							Status: 'Already-Claimed',
							ClaimedAt: claims[walletAddress].Timestamp?.toString() || claims[walletAddress].timestamp?.toString(),
						};
					}

					// Check if sold out
					if (claimsCount >= totalSupply) {
						return {
							Status: 'Sold-Out',
							Message: 'All 1984 assets have been claimed',
						};
					}

					// Available
					return {
						Status: 'Available',
						Remaining: (totalSupply - claimsCount).toString(),
						Total: totalSupply.toString(),
					};
				}

				// Handle Get-Balance by reading balance from state
				if (args.action === 'Get-Balance') {
					const walletAddress = args.tags?.find((t) => t.name === 'Wallet-Address')?.value;
					const profileId = args.tags?.find((t) => t.name === 'Profile-Id')?.value;

					// Token.Balances might be at various paths
					const tokenBalances =
						actualState.Token?.Balances ||
						actualState.Token?.balances ||
						actualState.Balances ||
						actualState.balances ||
						state.Token?.Balances ||
						state.Token?.balances ||
						state.Balances ||
						state.balances ||
						state.asset?.Balances ||
						state.asset?.balances ||
						{};

					// Check Claims table
					const claims =
						actualState.Claims ||
						actualState.claims ||
						state.Claims ||
						state.claims ||
						state.asset?.Claims ||
						state.asset?.claims ||
						{};

					const walletBalance = walletAddress ? tokenBalances[walletAddress] || '0' : '0';
					const profileBalance = profileId ? tokenBalances[profileId] || '0' : '0';
					const hasBalance = Number(walletBalance) > 0 || Number(profileBalance) > 0;
					const hasClaimed = walletAddress ? !!claims[walletAddress] : false;

					return {
						walletAddress,
						profileId,
						walletBalance,
						profileBalance,
						hasBalance,
						hasClaimed: hasClaimed || hasBalance,
					};
				}

				// Handle Get-Campaign-Stats by reading state
				if (args.action === 'Get-Campaign-Stats') {
					// Claims table is exported via patch@1.0, accessible at various paths
					const claims =
						actualState.Claims ||
						actualState.claims ||
						state.Claims ||
						state.claims ||
						state.asset?.Claims ||
						state.asset?.claims ||
						{};
					const claimsCount = Object.keys(claims).length;
					const totalSupply =
						actualState.CampaignConfig?.TotalSupply ||
						actualState.CampaignConfig?.totalSupply ||
						state.CampaignConfig?.TotalSupply ||
						state.asset?.CampaignConfig?.TotalSupply ||
						1984;

					// Token.Balances might be at various paths
					const tokenBalances =
						actualState.Token?.Balances ||
						actualState.Token?.balances ||
						actualState.Balances ||
						actualState.balances ||
						state.Token?.Balances ||
						state.Token?.balances ||
						state.Balances ||
						state.balances ||
						state.asset?.Balances ||
						state.asset?.balances ||
						{};
					const owner =
						actualState.Owner ||
						actualState.owner ||
						actualState.Token?.Creator ||
						actualState.Token?.creator ||
						state.Owner ||
						state.owner ||
						state.Token?.Creator ||
						state.Token?.creator ||
						state.asset?.Creator ||
						state.asset?.creator;
					const ownerBalance = owner && tokenBalances[owner] ? tokenBalances[owner] : '0';

					return {
						TotalSupply: totalSupply,
						Claimed: claimsCount,
						Remaining: totalSupply - claimsCount,
						OwnerBalance: ownerBalance,
					};
				}
			}
		} catch (error) {
			// For claim status checks, prefer HyperBEAM only - don't fall back to dry-run
			// Dry-runs are slow and rate-limited. HyperBEAM is more reliable even if slower.
			if (args.action === 'Get-Claim-Status' || args.action === 'Get-Balance' || args.action === 'Get-Campaign-Stats') {
				console.warn(`[readHandler] HyperBEAM-only action failed, not falling back to dry-run to avoid rate limits`);
				throw error; // Re-throw to let caller handle it
			}

			// For other actions, fall through to dryrun
		}
	}

	// Fallback to dryrun (CU) if HyperBEAM fails or for other actions

	const tags = [{ name: 'Action', value: args.action }];
	if (args.tags) tags.push(...args.tags);
	let data = JSON.stringify(args.data || {});

	try {
		// Add 10 second timeout for CU/dryrun
		const timeoutMs = 10000;
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error(`Dryrun request timed out after ${timeoutMs}ms`)), timeoutMs);
		});

		const response = (await Promise.race([
			dryrun({
				process: args.processId,
				tags: tags,
				data: data,
			}),
			timeoutPromise,
		])) as any;

		if (response.Messages && response.Messages.length) {
			if (response.Messages[0].Data) {
				const parsed = JSON.parse(response.Messages[0].Data);
				return parsed;
			} else {
				if (response.Messages[0].Tags) {
					const result = response.Messages[0].Tags.reduce((acc: any, item: any) => {
						acc[item.name] = item.value;
						return acc;
					}, {});
					return result;
				}
			}
		}
	} catch (error) {
		console.error('[readHandler] Dryrun failed:', error);
		throw error;
	}
}

export * from './assets';
export * from './collections';
export * from './profiles';
export * as stamps from './stamps';
export * from './vouch';
