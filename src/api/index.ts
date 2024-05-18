import Arweave from 'arweave';
import { ArweaveWebIrys } from '@irys/sdk/build/esm/web/tokens/arweave';
import { createDataItemSigner, dryrun, message, result, results } from '@permaweb/aoconnect';

import { CONTENT_TYPES, CURSORS, GATEWAYS, PAGINATORS, UPLOAD_CONFIG } from 'helpers/config';
import {
	BatchAGQLResponseType,
	BatchGQLArgsType,
	DefaultGQLResponseType,
	GQLArgsType,
	GQLNodeResponseType,
	QueryBodyGQLArgsType,
	TagType,
	UploadMethodType,
} from 'helpers/types';
import { getByteSize, getTagValue } from 'helpers/utils';

export async function getGQLData(args: GQLArgsType): Promise<DefaultGQLResponseType> {
	const paginator = args.paginator ? args.paginator : PAGINATORS.default;

	let data: GQLNodeResponseType[] = [];
	let count: number = 0;
	let nextCursor: string | null = null;

	if (args.ids && !args.ids.length) {
		return { data: data, count: count, nextCursor: nextCursor, previousCursor: null };
	}

	try {
		let queryBody: string = getQueryBody(args);
		const response = await getResponse({ gateway: args.gateway, query: getQuery(queryBody) });

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
		const response = await fetch(`https://${args.gateway}/graphql`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: args.query,
		});
		return await response.json();
	} catch (e: any) {
		throw e;
	}
}

export async function createTransaction(args: {
	content: any;
	contentType: string;
	tags: TagType[];
	uploadMethod?: UploadMethodType;
}) {
	let finalContent: any;
	switch (args.contentType) {
		case CONTENT_TYPES.json as any:
			finalContent = JSON.stringify(args.content);
			break;
		default:
			finalContent = args.content;
			break;
	}

	const contentSize: number = getByteSize(finalContent);

	if (contentSize < Number(UPLOAD_CONFIG.dispatchUploadSize)) {
		const txRes = await Arweave.init({}).createTransaction({ data: finalContent }, 'use_wallet');
		args.tags.forEach((tag: TagType) => txRes.addTag(tag.name, tag.value));
		const response = await global.window.arweaveWallet.dispatch(txRes);
		return response.id;
	} else {
		try {
			const uploadUrl = args.uploadMethod && args.uploadMethod === 'turbo' ? UPLOAD_CONFIG.node2 : UPLOAD_CONFIG.node1;
			const irys = new ArweaveWebIrys({
				url: uploadUrl,
				wallet: { provider: global.window.arweaveWallet },
			});
			await irys.ready();

			if (args.contentType.includes('image') || args.contentType.includes('video')) {
				const uploader = irys.uploader.chunkedUploader;
				uploader.setBatchSize(UPLOAD_CONFIG.batchSize);
				uploader.setChunkSize(UPLOAD_CONFIG.chunkSize);

				uploader.on('chunkUpload', (chunkInfo: any) => {
					console.log(`Upload status: ${Math.floor((chunkInfo.totalUploaded / contentSize) * 100)}%`);
				});

				uploader.on('chunkError', (e: any) => {
					console.error(`Upload error: ${e}`);
				});

				const response = await uploader.uploadData(finalContent as any, { tags: args.tags } as any);
				return response.data.id;
			} else {
				const response = await irys.upload(finalContent as any, { tags: args.tags } as any);
				return response.id;
			}
		} catch (e: any) {
			throw new Error(e);
		}
	}
}

export async function messageResult(args: {
	processId: string;
	wallet: any;
	action: string;
	data: any;
	useRawData?: boolean;
}): Promise<any> {
	try {
		const data = args.useRawData ? args.data : JSON.stringify(args.data);

		const txId = await message({
			process: args.processId,
			signer: createDataItemSigner(args.wallet),
			tags: [{ name: 'Action', value: args.action }],
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
	tags: any;
	data: any;
	responses?: string[];
	handler?: string;
}): Promise<any> {
	try {
		const tags = [{ name: 'Action', value: args.action }];
		if (args.tags) tags.push(...args.tags);

		await message({
			process: args.processId,
			signer: createDataItemSigner(args.wallet),
			tags: tags,
			data: JSON.stringify(args.data),
		});

		const messageResults = await results({
			process: args.processId,
			sort: 'DESC',
			limit: 5,
		});

		if (messageResults && messageResults.edges && messageResults.edges.length) {
			const response = {};

			for (const result of messageResults.edges) {
				if (result.node && result.node.Messages && result.node.Messages.length) {
					const resultSet = [args.action];
					if (args.responses) resultSet.push(...args.responses);

					for (const message of result.node.Messages) {
						const action = getTagValue(message.Tags, 'Action');

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

							if (Object.keys(response).length === resultSet.length) break;
						}
					}
				}
			}

			return response;
		}

		return null;
	} catch (e) {
		console.error(e);
	}
}

export async function readHandler(args: { processId: string; action: string; data?: any }): Promise<any> {
	const response = await dryrun({
		process: args.processId,
		tags: [{ name: 'Action', value: args.action }],
		data: JSON.stringify(args.data || {}),
	});

	if (response.Messages && response.Messages.length && response.Messages[0].Data) {
		return JSON.parse(response.Messages[0].Data);
	}
}

export * from './assets';
export * from './collections';
export * from './profiles';
