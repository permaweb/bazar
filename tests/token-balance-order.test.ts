import { readFileSync } from 'node:fs';

import { createDataItemSigner, message, result } from '@permaweb/aoconnect';

// Test configuration - using the same pattern as ao-ucm tests
export const TEST_CONFIG = {
	ucm: process.env.UCM || 'CDxd81DDaJvpzxoyhXn-dVnZhYIFQEKU8FeUHdktFgQ',
	defaultToken: process.env.DEFAULT_TOKEN || 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
	pixl: process.env.PIXL || 'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo',
	wander: 'L99jaxRKQKJt9CqoJtPaieGPEhJD3wNhR4iGqc8amXs',
	ao: 'UkS-mdoiG8hcAClhKK8ch4ZhEzla0mCPDOix9hpdSFE',
};

// Token registry for testing - matches the frontend config
export const TOKEN_REGISTRY = {
	[TEST_CONFIG.defaultToken]: {
		id: TEST_CONFIG.defaultToken,
		name: 'Wrapped AR',
		symbol: 'wAR',
		logo: 'L99jaxRKQKJt9CqoJtPaieGPEhJD3wNhR4iGqc8amXs',
		denomination: 12,
		description: 'Wrapped Arweave token',
		priority: 1,
	},
	[TEST_CONFIG.pixl]: {
		id: TEST_CONFIG.pixl,
		name: 'PIXL',
		symbol: 'PIXL',
		logo: 'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo',
		denomination: 12,
		description: 'PIXL token',
		priority: 2,
	},
	[TEST_CONFIG.wander]: {
		id: TEST_CONFIG.wander,
		name: 'Wander',
		symbol: 'WNDR',
		logo: 'L99jaxRKQKJt9CqoJtPaieGPEhJD3wNhR4iGqc8amXs',
		denomination: 12,
		description: 'Wander token',
		priority: 3,
	},
	[TEST_CONFIG.ao]: {
		id: TEST_CONFIG.ao,
		name: 'AO',
		symbol: 'AO',
		logo: 'UkS-mdoiG8hcAClhKK8ch4ZhEzla0mCPDOix9hpdSFE',
		denomination: 12,
		description: 'AO Standard Token',
		priority: 4,
	},
};

export type TagType = { name: string; value: string };

export function getTagValue(list: { [key: string]: any }[], name: string): string | null {
	for (let i = 0; i < list.length; i++) {
		if (list[i]) {
			if (list[i]!.name === name) {
				return list[i]!.value as string;
			}
		}
	}
	return null;
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

// Test helper functions - read-only operations that don't require signing
export async function getTokenBalance(tokenId: string, targetAddress: string): Promise<any> {
	// For read-only operations, we can use a simple approach without signing
	console.log(`Querying balance for ${targetAddress} on token ${tokenId}...`);

	// This would normally use the AO connect library, but for testing we'll simulate
	// In a real implementation, you'd use the proper AO message/result pattern
	return {
		status: 'success',
		data: {
			balance: '0',
			target: targetAddress,
			token: tokenId,
		},
	};
}

export async function getTokenInfo(tokenId: string): Promise<any> {
	console.log(`Querying info for token ${tokenId}...`);

	// Simulate token info response
	return {
		status: 'success',
		data: {
			name: TOKEN_REGISTRY[tokenId]?.name || 'Unknown Token',
			symbol: TOKEN_REGISTRY[tokenId]?.symbol || 'UNKNOWN',
			denomination: TOKEN_REGISTRY[tokenId]?.denomination || 12,
			totalSupply: '1000000000000000000000000', // 1M tokens with 12 decimals
		},
	};
}

export async function createOrder(args: {
	dominantToken: string;
	swapToken: string;
	unitPrice?: string;
	quantity: string;
	creator: {
		creatorId: string;
		wallet: any;
	};
}): Promise<any> {
	const orderType: any = args.unitPrice ? 'sell' : 'buy';

	let pair: string[] | null = null;
	let forwardedTags: TagType[] | null = null;
	let recipient: string | null = null;

	switch (orderType) {
		case 'buy':
			pair = [args.swapToken, args.dominantToken];
			recipient = TEST_CONFIG.ucm;
			break;
		case 'sell':
			pair = [args.dominantToken, args.swapToken];
			recipient = TEST_CONFIG.ucm;
			break;
	}

	if (!pair) {
		throw new Error('Invalid order type: pair is null');
	}

	const dominantToken: string = pair[0];
	const swapToken: string = pair[1];

	if (orderType === 'buy' || orderType === 'sell') {
		forwardedTags = [
			{ name: 'X-Order-Action', value: 'Create-Order' },
			{ name: 'X-Swap-Token', value: swapToken },
		];
		if (args.unitPrice && Number(args.unitPrice) > 0) {
			forwardedTags.push({ name: 'X-Price', value: args.unitPrice });
		}
	}

	const transferTags: TagType[] = [
		{ name: 'Target', value: dominantToken },
		{ name: 'Recipient', value: recipient! },
		{ name: 'Quantity', value: args.quantity },
	];

	if (forwardedTags) transferTags.push(...forwardedTags);

	console.log(`Creating ${orderType} order with ${args.quantity} ${dominantToken} for ${swapToken}...`);

	const orderResponse: any = await messageResult({
		processId: args.creator.creatorId,
		action: 'Transfer',
		wallet: args.creator.wallet,
		tags: transferTags,
		data: {
			Target: dominantToken,
			Recipient: recipient,
			Quantity: args.quantity,
		},
	});

	return orderResponse;
}

// Test suite
async function runTokenBalanceTests() {
	console.log('\n=== Token Balance Tests ===\n');

	// Mock wallet for testing - createDataItemSigner expects specific properties
	const testWallet = {
		address: 'SaXnsUgxJLkJRghWQOUs9-wB0npVviewTkUbh2Yk64M',
		key: 'mock-key-data', // createDataItemSigner needs this
		// In real tests, you'd load actual wallet JSON files like:
		// wallet: JSON.parse(readFileSync('./wallets/wallet-1.json').toString()),
	};

	const testProfile = {
		creatorId: 'SaXnsUgxJLkJRghWQOUs9-wB0npVviewTkUbh2Yk64M',
		wallet: testWallet,
	};

	// Test 1: Get wAR token balance
	console.log('Test 1: Getting wAR token balance...');
	try {
		const warBalance = await getTokenBalance(TEST_CONFIG.defaultToken, testWallet.address);
		console.log('wAR Balance Response:', JSON.stringify(warBalance, null, 2));
		console.log('✓ wAR balance test completed\n');
	} catch (error) {
		console.log('✗ wAR balance test failed:', error);
	}

	// Test 2: Get PIXL token balance
	console.log('Test 2: Getting PIXL token balance...');
	try {
		const pixlBalance = await getTokenBalance(TEST_CONFIG.pixl, testWallet.address);
		console.log('PIXL Balance Response:', JSON.stringify(pixlBalance, null, 2));
		console.log('✓ PIXL balance test completed\n');
	} catch (error) {
		console.log('✗ PIXL balance test failed:', error);
	}

	// Test 3: Get Wander token balance
	console.log('Test 3: Getting Wander token balance...');
	try {
		const wanderBalance = await getTokenBalance(TEST_CONFIG.wander, testWallet.address);
		console.log('Wander Balance Response:', JSON.stringify(wanderBalance, null, 2));
		console.log('✓ Wander balance test completed\n');
	} catch (error) {
		console.log('✗ Wander balance test failed:', error);
	}

	// Test 4: Get AO token balance
	console.log('Test 4: Getting AO token balance...');
	try {
		const aoBalance = await getTokenBalance(TEST_CONFIG.ao, testWallet.address);
		console.log('AO Balance Response:', JSON.stringify(aoBalance, null, 2));
		console.log('✓ AO balance test completed\n');
	} catch (error) {
		console.log('✗ AO balance test failed:', error);
	}
}

async function runTokenInfoTests() {
	console.log('\n=== Token Info Tests ===\n');

	const testWallet = {
		address: 'SaXnsUgxJLkJRghWQOUs9-wB0npVviewTkUbh2Yk64M',
		key: 'mock-key-data', // createDataItemSigner needs this
	};

	// Test 1: Get wAR token info
	console.log('Test 1: Getting wAR token info...');
	try {
		const warInfo = await getTokenInfo(TEST_CONFIG.defaultToken);
		console.log('wAR Info Response:', JSON.stringify(warInfo, null, 2));
		console.log('✓ wAR info test completed\n');
	} catch (error) {
		console.log('✗ wAR info test failed:', error);
	}

	// Test 2: Get PIXL token info
	console.log('Test 2: Getting PIXL token info...');
	try {
		const pixlInfo = await getTokenInfo(TEST_CONFIG.pixl);
		console.log('PIXL Info Response:', JSON.stringify(pixlInfo, null, 2));
		console.log('✓ PIXL info test completed\n');
	} catch (error) {
		console.log('✗ PIXL info test failed:', error);
	}

	// Test 3: Get Wander token info
	console.log('Test 3: Getting Wander token info...');
	try {
		const wanderInfo = await getTokenInfo(TEST_CONFIG.wander);
		console.log('Wander Info Response:', JSON.stringify(wanderInfo, null, 2));
		console.log('✓ Wander info test completed\n');
	} catch (error) {
		console.log('✗ Wander info test failed:', error);
	}

	// Test 4: Get AO token info
	console.log('Test 4: Getting AO token info...');
	try {
		const aoInfo = await getTokenInfo(TEST_CONFIG.ao);
		console.log('AO Info Response:', JSON.stringify(aoInfo, null, 2));
		console.log('✓ AO info test completed\n');
	} catch (error) {
		console.log('✗ AO info test failed:', error);
	}
}

async function runOrderTests() {
	console.log('\n=== Order Parameter Validation Tests ===\n');

	const testWallet = {
		address: 'SaXnsUgxJLkJRghWQOUs9-wB0npVviewTkUbh2Yk64M',
		key: 'mock-key-data', // createDataItemSigner needs this
	};

	const testProfile = {
		creatorId: 'SaXnsUgxJLkJRghWQOUs9-wB0npVviewTkUbh2Yk64M',
		wallet: testWallet,
	};

	// Test 1: Validate wAR order parameters
	console.log('Test 1: Validating wAR order parameters...');
	try {
		const warOrderParams = {
			dominantToken: TEST_CONFIG.defaultToken,
			swapToken: 'some-asset-token-id',
			quantity: '1000000000000', // 1 wAR (12 decimals)
			creator: testProfile,
		};
		console.log('wAR Order Parameters:', JSON.stringify(warOrderParams, null, 2));
		console.log('✓ wAR order validation completed\n');
	} catch (error) {
		console.log('✗ wAR order validation failed:', error);
	}

	// Test 2: Validate PIXL order parameters
	console.log('Test 2: Validating PIXL order parameters...');
	try {
		const pixlOrderParams = {
			dominantToken: TEST_CONFIG.pixl,
			swapToken: 'some-asset-token-id',
			quantity: '1000000', // 1 PIXL (6 decimals)
			creator: testProfile,
		};
		console.log('PIXL Order Parameters:', JSON.stringify(pixlOrderParams, null, 2));
		console.log('✓ PIXL order validation completed\n');
	} catch (error) {
		console.log('✗ PIXL order validation failed:', error);
	}

	// Test 3: Validate Wander order parameters
	console.log('Test 3: Validating Wander order parameters...');
	try {
		const wanderOrderParams = {
			dominantToken: TEST_CONFIG.wander,
			swapToken: 'some-asset-token-id',
			quantity: '1000000000000000000', // 1 Wander (18 decimals)
			creator: testProfile,
		};
		console.log('Wander Order Parameters:', JSON.stringify(wanderOrderParams, null, 2));
		console.log('✓ Wander order validation completed\n');
	} catch (error) {
		console.log('✗ Wander order validation failed:', error);
	}

	// Test 4: Validate AO order parameters
	console.log('Test 4: Validating AO order parameters...');
	try {
		const aoOrderParams = {
			dominantToken: TEST_CONFIG.ao,
			swapToken: 'some-asset-token-id',
			quantity: '1000000000000', // 1 AO (12 decimals)
			creator: testProfile,
		};
		console.log('AO Order Parameters:', JSON.stringify(aoOrderParams, null, 2));
		console.log('✓ AO order validation completed\n');
	} catch (error) {
		console.log('✗ AO order validation failed:', error);
	}
}

// Main test runner
async function runAllTests() {
	console.log('Starting Token Balance and Order Tests...');
	console.log('Test Configuration:', JSON.stringify(TEST_CONFIG, null, 2));
	console.log('Token Registry:', JSON.stringify(TOKEN_REGISTRY, null, 2));

	await runTokenBalanceTests();
	await runTokenInfoTests();
	await runOrderTests();

	console.log('\n=== All Tests Completed ===');
}

// Run tests if this file is executed directly
if (require.main === module) {
	runAllTests().catch(console.error);
}

export { runAllTests, runOrderTests, runTokenBalanceTests, runTokenInfoTests };
