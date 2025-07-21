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

// Real AO network integration functions
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

		console.log(`Sending message to ${args.processId}:`, {
			action: args.action,
			tags: tags,
			data: data ? 'present' : 'null',
		});

		const txId = await message({
			process: args.processId,
			signer: createDataItemSigner(args.wallet),
			tags: tags,
			data: data,
		});

		console.log(`Message sent, txId: ${txId}`);

		// Wait a bit for the message to be processed
		await new Promise((resolve) => setTimeout(resolve, 2000));

		const { Messages } = await result({ message: txId, process: args.processId });

		console.log(`Received ${Messages?.length || 0} messages from ${args.processId}`);

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
		console.error('Error in messageResult:', e);
		throw e;
	}
}

// Real token balance fetching
export async function getTokenBalance(tokenId: string, wallet: any, targetAddress: string): Promise<any> {
	console.log(`\n🔍 Fetching balance for ${targetAddress} on token ${tokenId}...`);

	try {
		const response = await messageResult({
			processId: tokenId,
			wallet: wallet,
			action: 'Balance',
			tags: [{ name: 'Target', value: targetAddress }],
			data: null,
		});

		console.log(`✅ Balance response for ${tokenId}:`, JSON.stringify(response, null, 2));
		return response;
	} catch (error) {
		console.error(`❌ Failed to get balance for ${tokenId}:`, error);
		throw error;
	}
}

// Real token info fetching
export async function getTokenInfo(tokenId: string, wallet: any): Promise<any> {
	console.log(`\n🔍 Fetching info for token ${tokenId}...`);

	try {
		const response = await messageResult({
			processId: tokenId,
			wallet: wallet,
			action: 'Info',
			tags: null,
			data: null,
		});

		console.log(`✅ Info response for ${tokenId}:`, JSON.stringify(response, null, 2));
		return response;
	} catch (error) {
		console.error(`❌ Failed to get info for ${tokenId}:`, error);
		throw error;
	}
}

// Real order creation
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

	console.log(`\n🔄 Creating ${orderType} order with ${args.quantity} ${dominantToken} for ${swapToken}...`);

	try {
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

		console.log(`✅ Order response:`, JSON.stringify(orderResponse, null, 2));
		return orderResponse;
	} catch (error) {
		console.error(`❌ Order creation failed:`, error);
		throw error;
	}
}

// Load test wallet
function loadTestWallet(walletPath: string): any {
	try {
		const walletData = readFileSync(walletPath, 'utf8');
		return JSON.parse(walletData);
	} catch (error) {
		console.error(`Failed to load wallet from ${walletPath}:`, error);
		throw new Error(`Wallet file not found: ${walletPath}. Please create test wallet files first.`);
	}
}

// Real integration tests
async function runRealTokenBalanceTests() {
	console.log('\n=== Real Token Balance Tests ===\n');

	// Try to load test wallet, fall back to mock if not available
	let testWallet;
	try {
		testWallet = loadTestWallet('./wallets/wallet-1.json');
		console.log('✅ Loaded real test wallet');
	} catch (error) {
		console.log('⚠️  Using mock wallet for testing (no real wallet file found)');
		testWallet = {
			address: 'SaXnsUgxJLkJRghWQOUs9-wB0npVviewTkUbh2Yk64M',
			key: 'mock-key-data',
		};
	}

	const testAddress = testWallet.address;

	// Test 1: Get wAR token balance
	console.log('Test 1: Getting wAR token balance...');
	try {
		const warBalance = await getTokenBalance(TEST_CONFIG.defaultToken, testWallet, testAddress);
		console.log('✓ wAR balance test completed\n');
	} catch (error) {
		console.log('✗ wAR balance test failed:', error);
	}

	// Test 2: Get PIXL token balance
	console.log('Test 2: Getting PIXL token balance...');
	try {
		const pixlBalance = await getTokenBalance(TEST_CONFIG.pixl, testWallet, testAddress);
		console.log('✓ PIXL balance test completed\n');
	} catch (error) {
		console.log('✗ PIXL balance test failed:', error);
	}

	// Test 3: Get Wander token balance
	console.log('Test 3: Getting Wander token balance...');
	try {
		const wanderBalance = await getTokenBalance(TEST_CONFIG.wander, testWallet, testAddress);
		console.log('✓ Wander balance test completed\n');
	} catch (error) {
		console.log('✗ Wander balance test failed:', error);
	}

	// Test 4: Get AO token balance
	console.log('Test 4: Getting AO token balance...');
	try {
		const aoBalance = await getTokenBalance(TEST_CONFIG.ao, testWallet, testAddress);
		console.log('✓ AO balance test completed\n');
	} catch (error) {
		console.log('✗ AO balance test failed:', error);
	}
}

async function runRealTokenInfoTests() {
	console.log('\n=== Real Token Info Tests ===\n');

	let testWallet;
	try {
		testWallet = loadTestWallet('./wallets/wallet-1.json');
	} catch (error) {
		testWallet = {
			address: 'SaXnsUgxJLkJRghWQOUs9-wB0npVviewTkUbh2Yk64M',
			key: 'mock-key-data',
		};
	}

	// Test 1: Get wAR token info
	console.log('Test 1: Getting wAR token info...');
	try {
		const warInfo = await getTokenInfo(TEST_CONFIG.defaultToken, testWallet);
		console.log('✓ wAR info test completed\n');
	} catch (error) {
		console.log('✗ wAR info test failed:', error);
	}

	// Test 2: Get PIXL token info
	console.log('Test 2: Getting PIXL token info...');
	try {
		const pixlInfo = await getTokenInfo(TEST_CONFIG.pixl, testWallet);
		console.log('✓ PIXL info test completed\n');
	} catch (error) {
		console.log('✗ PIXL info test failed:', error);
	}

	// Test 3: Get Wander token info
	console.log('Test 3: Getting Wander token info...');
	try {
		const wanderInfo = await getTokenInfo(TEST_CONFIG.wander, testWallet);
		console.log('✓ Wander info test completed\n');
	} catch (error) {
		console.log('✗ Wander info test failed:', error);
	}

	// Test 4: Get AO token info
	console.log('Test 4: Getting AO token info...');
	try {
		const aoInfo = await getTokenInfo(TEST_CONFIG.ao, testWallet);
		console.log('✓ AO info test completed\n');
	} catch (error) {
		console.log('✗ AO info test failed:', error);
	}
}

async function runRealOrderTests() {
	console.log('\n=== Real Order Creation Tests ===\n');

	let testWallet;
	try {
		testWallet = loadTestWallet('./wallets/wallet-1.json');
	} catch (error) {
		testWallet = {
			address: 'SaXnsUgxJLkJRghWQOUs9-wB0npVviewTkUbh2Yk64M',
			key: 'mock-key-data',
		};
	}

	const testProfile = {
		creatorId: testWallet.address,
		wallet: testWallet,
	};

	// Use a test asset token ID (you can replace this with a real asset)
	const testAssetToken = 'some-test-asset-token-id';

	// Test 1: Create buy order with wAR
	console.log('Test 1: Creating buy order with wAR...');
	try {
		const warBuyOrder = await createOrder({
			dominantToken: TEST_CONFIG.defaultToken,
			swapToken: testAssetToken,
			quantity: '1000000000000', // 1 wAR (12 decimals)
			creator: testProfile,
		});
		console.log('✓ wAR buy order test completed\n');
	} catch (error) {
		console.log('✗ wAR buy order test failed:', error);
	}

	// Test 2: Create buy order with PIXL
	console.log('Test 2: Creating buy order with PIXL...');
	try {
		const pixlBuyOrder = await createOrder({
			dominantToken: TEST_CONFIG.pixl,
			swapToken: testAssetToken,
			quantity: '1000000', // 1 PIXL (6 decimals)
			creator: testProfile,
		});
		console.log('✓ PIXL buy order test completed\n');
	} catch (error) {
		console.log('✗ PIXL buy order test failed:', error);
	}

	// Test 3: Create buy order with Wander
	console.log('Test 3: Creating buy order with Wander...');
	try {
		const wanderBuyOrder = await createOrder({
			dominantToken: TEST_CONFIG.wander,
			swapToken: testAssetToken,
			quantity: '1000000000000000000', // 1 Wander (18 decimals)
			creator: testProfile,
		});
		console.log('✓ Wander buy order test completed\n');
	} catch (error) {
		console.log('✗ Wander buy order test failed:', error);
	}

	// Test 4: Create buy order with AO
	console.log('Test 4: Creating buy order with AO...');
	try {
		const aoBuyOrder = await createOrder({
			dominantToken: TEST_CONFIG.ao,
			swapToken: testAssetToken,
			quantity: '1000000000000', // 1 AO (12 decimals)
			creator: testProfile,
		});
		console.log('✓ AO buy order test completed\n');
	} catch (error) {
		console.log('✗ AO buy order test failed:', error);
	}
}

// Main test runner
async function runAllRealTests() {
	console.log('🚀 Starting Real AO Network Integration Tests...');
	console.log('Test Configuration:', JSON.stringify(TEST_CONFIG, null, 2));
	console.log('Token Registry:', JSON.stringify(TOKEN_REGISTRY, null, 2));

	await runRealTokenBalanceTests();
	await runRealTokenInfoTests();
	await runRealOrderTests();

	console.log('\n=== All Real Integration Tests Completed ===');
}

// Run tests if this file is executed directly
if (require.main === module) {
	runAllRealTests().catch(console.error);
}

export { runAllRealTests, runRealOrderTests, runRealTokenBalanceTests, runRealTokenInfoTests };
