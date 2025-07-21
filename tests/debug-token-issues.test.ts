import { readFileSync } from 'node:fs';

import { createDataItemSigner, message, result } from '@permaweb/aoconnect';

// Test configuration
export const TEST_CONFIG = {
	ucm: process.env.UCM || 'CDxd81DDaJvpzxoyhXn-dVnZhYIFQEKU8FeUHdktFgQ',
	defaultToken: process.env.DEFAULT_TOKEN || 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
	pixl: process.env.PIXL || 'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo',
	wander: 'L99jaxRKQKJt9CqoJtPaieGPEhJD3wNhR4iGqc8amXs',
	ao: 'UkS-mdoiG8hcAClhKK8ch4ZhEzla0mCPDOix9hpdSFE',
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

// Load test wallet
function loadTestWallet(walletPath: string): any {
	try {
		const walletData = readFileSync(walletPath, 'utf8');
		return JSON.parse(walletData);
	} catch (error) {
		console.log('⚠️  Using mock wallet (no real wallet file found)');
		// Create a proper mock wallet structure that AO connect expects
		return {
			address: 'SaXnsUgxJLkJRghWQOUs9-wB0npVviewTkUbh2Yk64M',
			key: 'mock-key-data-for-testing-purposes-only',
			// Add other fields that might be expected
			n: 2,
			e: 'AQAB',
			d: 'mock-private-key-data',
			p: 'mock-p-prime',
			q: 'mock-q-prime',
			dp: 'mock-dp',
			dq: 'mock-dq',
			qi: 'mock-qi',
		};
	}
}

// Debug-focused message function with better error handling
export async function debugMessage(args: {
	processId: string;
	wallet: any;
	action: string;
	tags: TagType[] | null;
	data: any;
	description: string;
}): Promise<any> {
	console.log(`\n🔍 DEBUG: ${args.description}`);
	console.log(`   Process: ${args.processId}`);
	console.log(`   Action: ${args.action}`);
	console.log(`   Tags:`, args.tags);
	console.log(`   Data:`, args.data ? 'present' : 'null');

	try {
		// Check if we have a real wallet with proper key data
		if (!args.wallet.key || args.wallet.key === 'mock-key-data-for-testing-purposes-only') {
			console.log(`   ⚠️  Using mock wallet - skipping actual network call`);
			console.log(`   📋 Would send message with:`);
			console.log(`      Process: ${args.processId}`);
			console.log(`      Action: ${args.action}`);
			console.log(`      Tags:`, args.tags);
			console.log(`      Data:`, args.data);
			console.log(`   ✅ Mock test completed (no network call)`);
			return {
				mock: true,
				description: args.description,
				processId: args.processId,
				action: args.action,
				tags: args.tags,
				data: args.data,
			};
		}

		const tags = [{ name: 'Action', value: args.action }];
		if (args.tags) tags.push(...args.tags);

		const data = args.data ? JSON.stringify(args.data) : null;

		const txId = await message({
			process: args.processId,
			signer: createDataItemSigner(args.wallet),
			tags: tags,
			data: data,
		});

		console.log(`   ✅ Message sent, txId: ${txId}`);

		// Wait for processing
		await new Promise((resolve) => setTimeout(resolve, 3000));

		const { Messages } = await result({ message: txId, process: args.processId });

		console.log(`   📨 Received ${Messages?.length || 0} messages`);

		if (Messages && Messages.length) {
			const responses = [];

			Messages.forEach((message: any, index: number) => {
				const action = getTagValue(message.Tags, 'Action') || args.action;
				const status = getTagValue(message.Tags, 'Status');
				const messageText = getTagValue(message.Tags, 'Message');

				let responseData = null;
				if (message.Data) {
					try {
						responseData = JSON.parse(message.Data);
					} catch {
						responseData = message.Data;
					}
				}

				const response = {
					index,
					action,
					status,
					message: messageText,
					data: responseData,
					rawData: message.Data,
				};

				responses.push(response);

				console.log(`   📋 Message ${index + 1}:`);
				console.log(`      Action: ${action}`);
				console.log(`      Status: ${status}`);
				console.log(`      Message: ${messageText}`);
				console.log(`      Data:`, responseData);
			});

			return responses;
		} else {
			console.log(`   ⚠️  No messages received`);
			return null;
		}
	} catch (e) {
		console.error(`   ❌ Error:`, e);
		throw e;
	}
}

// Issue 1: Debug token balance loading problems
async function debugTokenBalanceIssues() {
	console.log('\n=== DEBUG: Token Balance Loading Issues ===\n');

	let testWallet;
	try {
		testWallet = loadTestWallet('./wallets/wallet-1.json');
	} catch (error) {
		testWallet = {
			address: 'SaXnsUgxJLkJRghWQOUs9-wB0npVviewTkUbh2Yk64M',
			key: 'mock-key-data',
		};
	}

	const testAddress = testWallet.address;

	// Test wAR balance (should work)
	console.log('🔍 Testing wAR balance (should work)...');
	try {
		const warResponse = await debugMessage({
			processId: TEST_CONFIG.defaultToken,
			wallet: testWallet,
			action: 'Balance',
			tags: [{ name: 'Target', value: testAddress }],
			data: null,
			description: 'wAR Balance Query',
		});
		console.log('✅ wAR balance test completed\n');
	} catch (error) {
		console.log('❌ wAR balance test failed:', error);
	}

	// Test PIXL balance (might show loading issue)
	console.log('🔍 Testing PIXL balance (might show loading issue)...');
	try {
		const pixlResponse = await debugMessage({
			processId: TEST_CONFIG.pixl,
			wallet: testWallet,
			action: 'Balance',
			tags: [{ name: 'Target', value: testAddress }],
			data: null,
			description: 'PIXL Balance Query',
		});
		console.log('✅ PIXL balance test completed\n');
	} catch (error) {
		console.log('❌ PIXL balance test failed:', error);
	}

	// Test Wander balance (likely to show loading issue)
	console.log('🔍 Testing Wander balance (likely to show loading issue)...');
	try {
		const wanderResponse = await debugMessage({
			processId: TEST_CONFIG.wander,
			wallet: testWallet,
			action: 'Balance',
			tags: [{ name: 'Target', value: testAddress }],
			data: null,
			description: 'Wander Balance Query',
		});
		console.log('✅ Wander balance test completed\n');
	} catch (error) {
		console.log('❌ Wander balance test failed:', error);
	}

	// Test AO balance
	console.log('🔍 Testing AO balance...');
	try {
		const aoResponse = await debugMessage({
			processId: TEST_CONFIG.ao,
			wallet: testWallet,
			action: 'Balance',
			tags: [{ name: 'Target', value: testAddress }],
			data: null,
			description: 'AO Balance Query',
		});
		console.log('✅ AO balance test completed\n');
	} catch (error) {
		console.log('❌ AO balance test failed:', error);
	}
}

// Issue 2: Debug Wander token metadata problem
async function debugWanderMetadataIssue() {
	console.log('\n=== DEBUG: Wander Token Metadata Issue ===\n');

	let testWallet;
	try {
		testWallet = loadTestWallet('./wallets/wallet-1.json');
	} catch (error) {
		testWallet = {
			address: 'SaXnsUgxJLkJRghWQOUs9-wB0npVviewTkUbh2Yk64M',
			key: 'mock-key-data',
		};
	}

	// Test wAR Info (should return proper JSON)
	console.log('🔍 Testing wAR Info (should return proper JSON)...');
	try {
		const warInfo = await debugMessage({
			processId: TEST_CONFIG.defaultToken,
			wallet: testWallet,
			action: 'Info',
			tags: null,
			data: null,
			description: 'wAR Info Query',
		});
		console.log('✅ wAR info test completed\n');
	} catch (error) {
		console.log('❌ wAR info test failed:', error);
	}

	// Test Wander Info (likely returns Data: null)
	console.log('🔍 Testing Wander Info (likely returns Data: null)...');
	try {
		const wanderInfo = await debugMessage({
			processId: TEST_CONFIG.wander,
			wallet: testWallet,
			action: 'Info',
			tags: null,
			data: null,
			description: 'Wander Info Query',
		});
		console.log('✅ Wander info test completed\n');
	} catch (error) {
		console.log('❌ Wander info test failed:', error);
	}

	// Test PIXL Info
	console.log('🔍 Testing PIXL Info...');
	try {
		const pixlInfo = await debugMessage({
			processId: TEST_CONFIG.pixl,
			wallet: testWallet,
			action: 'Info',
			tags: null,
			data: null,
			description: 'PIXL Info Query',
		});
		console.log('✅ PIXL info test completed\n');
	} catch (error) {
		console.log('❌ PIXL info test failed:', error);
	}

	// Test AO Info
	console.log('🔍 Testing AO Info...');
	try {
		const aoInfo = await debugMessage({
			processId: TEST_CONFIG.ao,
			wallet: testWallet,
			action: 'Info',
			tags: null,
			data: null,
			description: 'AO Info Query',
		});
		console.log('✅ AO info test completed\n');
	} catch (error) {
		console.log('❌ AO info test failed:', error);
	}
}

// Issue 3: Debug order creation failures
async function debugOrderCreationIssues() {
	console.log('\n=== DEBUG: Order Creation Issues ===\n');

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

	// Use a test asset token ID
	const testAssetToken = 'some-test-asset-token-id';

	// Test wAR order (should work)
	console.log('🔍 Testing wAR order creation (should work)...');
	try {
		const warOrder = await debugMessage({
			processId: testProfile.creatorId,
			wallet: testWallet,
			action: 'Transfer',
			tags: [
				{ name: 'Target', value: TEST_CONFIG.defaultToken },
				{ name: 'Recipient', value: TEST_CONFIG.ucm },
				{ name: 'Quantity', value: '1000000000000' },
				{ name: 'X-Order-Action', value: 'Create-Order' },
				{ name: 'X-Swap-Token', value: testAssetToken },
			],
			data: {
				Target: TEST_CONFIG.defaultToken,
				Recipient: TEST_CONFIG.ucm,
				Quantity: '1000000000000',
			},
			description: 'wAR Order Creation',
		});
		console.log('✅ wAR order test completed\n');
	} catch (error) {
		console.log('❌ wAR order test failed:', error);
	}

	// Test PIXL order (likely to fail with Order-Error)
	console.log('🔍 Testing PIXL order creation (likely to fail with Order-Error)...');
	try {
		const pixlOrder = await debugMessage({
			processId: testProfile.creatorId,
			wallet: testWallet,
			action: 'Transfer',
			tags: [
				{ name: 'Target', value: TEST_CONFIG.pixl },
				{ name: 'Recipient', value: TEST_CONFIG.ucm },
				{ name: 'Quantity', value: '1000000000000' },
				{ name: 'X-Order-Action', value: 'Create-Order' },
				{ name: 'X-Swap-Token', value: testAssetToken },
			],
			data: {
				Target: TEST_CONFIG.pixl,
				Recipient: TEST_CONFIG.ucm,
				Quantity: '1000000000000',
			},
			description: 'PIXL Order Creation',
		});
		console.log('✅ PIXL order test completed\n');
	} catch (error) {
		console.log('❌ PIXL order test failed:', error);
	}

	// Test Wander order (likely to fail)
	console.log('🔍 Testing Wander order creation (likely to fail)...');
	try {
		const wanderOrder = await debugMessage({
			processId: testProfile.creatorId,
			wallet: testWallet,
			action: 'Transfer',
			tags: [
				{ name: 'Target', value: TEST_CONFIG.wander },
				{ name: 'Recipient', value: TEST_CONFIG.ucm },
				{ name: 'Quantity', value: '1000000000000' },
				{ name: 'X-Order-Action', value: 'Create-Order' },
				{ name: 'X-Swap-Token', value: testAssetToken },
			],
			data: {
				Target: TEST_CONFIG.wander,
				Recipient: TEST_CONFIG.ucm,
				Quantity: '1000000000000',
			},
			description: 'Wander Order Creation',
		});
		console.log('✅ Wander order test completed\n');
	} catch (error) {
		console.log('❌ Wander order test failed:', error);
	}

	// Test AO order
	console.log('🔍 Testing AO order creation...');
	try {
		const aoOrder = await debugMessage({
			processId: testProfile.creatorId,
			wallet: testWallet,
			action: 'Transfer',
			tags: [
				{ name: 'Target', value: TEST_CONFIG.ao },
				{ name: 'Recipient', value: TEST_CONFIG.ucm },
				{ name: 'Quantity', value: '1000000000000' },
				{ name: 'X-Order-Action', value: 'Create-Order' },
				{ name: 'X-Swap-Token', value: testAssetToken },
			],
			data: {
				Target: TEST_CONFIG.ao,
				Recipient: TEST_CONFIG.ucm,
				Quantity: '1000000000000',
			},
			description: 'AO Order Creation',
		});
		console.log('✅ AO order test completed\n');
	} catch (error) {
		console.log('❌ AO order test failed:', error);
	}
}

// Main debug runner
async function runAllDebugTests() {
	console.log('🐛 Starting Token Issue Debug Tests...');
	console.log('This will help identify why:');
	console.log('1. Token balances show "Loading..." instead of zero');
	console.log('2. Orders work with wAR but fail with PIXL/Wander/AO');
	console.log('3. Wander token metadata returns Data: null');
	console.log('');

	await debugTokenBalanceIssues();
	await debugWanderMetadataIssue();
	await debugOrderCreationIssues();

	console.log('\n=== Debug Tests Completed ===');
	console.log('Check the output above to identify the root causes of your token issues.');
}

// Run tests if this file is executed directly
if (require.main === module) {
	runAllDebugTests().catch(console.error);
}

export { debugOrderCreationIssues, debugTokenBalanceIssues, debugWanderMetadataIssue, runAllDebugTests };
