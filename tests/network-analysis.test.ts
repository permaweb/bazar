import { dryrun } from '@permaweb/aoconnect';

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

// Network analysis function that doesn't require signing
async function analyzeTokenContract(tokenId: string, description: string): Promise<any> {
	console.log(`\n🔍 NETWORK ANALYSIS: ${description}`);
	console.log(`   Token ID: ${tokenId}`);

	try {
		// Try to dry run an Info action to test the token contract
		// This is a read-only operation that doesn't require signing
		const dryrunResult = await dryrun({
			process: tokenId,
			tags: [{ name: 'Action', value: 'Info' }],
			data: null,
		});

		console.log(`   📋 Dry run completed successfully`);
		console.log(`   📊 Messages returned: ${dryrunResult.Messages?.length || 0}`);

		if (dryrunResult.Messages && dryrunResult.Messages.length > 0) {
			console.log(`   📋 Response analysis:`);
			dryrunResult.Messages.forEach((message: any, index: number) => {
				const action = getTagValue(message.Tags, 'Action');
				const status = getTagValue(message.Tags, 'Status');
				const messageText = getTagValue(message.Tags, 'Message');

				console.log(`      Message ${index + 1}:`);
				console.log(`         Action: ${action || 'unknown'}`);
				console.log(`         Status: ${status || 'unknown'}`);
				console.log(`         Message: ${messageText || 'none'}`);

				if (message.Data) {
					try {
						const data = JSON.parse(message.Data);
						console.log(`         Data:`, data);
					} catch {
						console.log(`         Data: ${message.Data}`);
					}
				} else {
					console.log(`         Data: null`);
				}
			});
		}

		return {
			tokenId,
			description,
			dryrunCompleted: true,
			messageCount: dryrunResult.Messages?.length || 0,
			messages: dryrunResult.Messages,
		};
	} catch (e) {
		console.error(`   ❌ Error analyzing token:`, e);
		return {
			tokenId,
			description,
			error: e instanceof Error ? e.message : String(e),
		};
	}
}

// Analyze token balance responses
async function analyzeTokenBalanceResponses() {
	console.log('\n=== NETWORK ANALYSIS: Token Balance Responses ===\n');

	const testAddress = 'SaXnsUgxJLkJRghWQOUs9-wB0npVviewTkUbh2Yk64M';

	// Analyze wAR token
	await analyzeTokenContract(TEST_CONFIG.defaultToken, 'wAR Token Contract Analysis');

	// Analyze PIXL token
	await analyzeTokenContract(TEST_CONFIG.pixl, 'PIXL Token Contract Analysis');

	// Analyze Wander token
	await analyzeTokenContract(TEST_CONFIG.wander, 'Wander Token Contract Analysis');

	// Analyze AO token
	await analyzeTokenContract(TEST_CONFIG.ao, 'AO Token Contract Analysis');
}

// Analyze UCM contract for order support
async function analyzeUCMContract() {
	console.log('\n=== NETWORK ANALYSIS: UCM Contract Analysis ===\n');

	await analyzeTokenContract(TEST_CONFIG.ucm, 'UCM Contract Analysis (Order Processing)');
}

// Analyze token info responses using dry run
async function analyzeTokenInfoResponses() {
	console.log('\n=== NETWORK ANALYSIS: Token Info Responses ===\n');

	console.log('📋 Analyzing token Info action responses using dry run...');

	// Analyze each token for Info action responses
	const tokens = [
		{ id: TEST_CONFIG.defaultToken, name: 'wAR' },
		{ id: TEST_CONFIG.pixl, name: 'PIXL' },
		{ id: TEST_CONFIG.wander, name: 'Wander' },
		{ id: TEST_CONFIG.ao, name: 'AO' },
	];

	for (const token of tokens) {
		console.log(`\n🔍 Analyzing ${token.name} token Info action...`);

		try {
			const dryrunResult = await dryrun({
				process: token.id,
				tags: [{ name: 'Action', value: 'Info' }],
				data: null,
			});

			if (dryrunResult.Messages && dryrunResult.Messages.length > 0) {
				const infoMessage = dryrunResult.Messages[0];
				const status = getTagValue(infoMessage.Tags, 'Status');
				const messageText = getTagValue(infoMessage.Tags, 'Message');

				console.log(`   Info response:`);
				console.log(`      Status: ${status || 'unknown'}`);
				console.log(`      Message: ${messageText || 'none'}`);

				if (infoMessage.Data) {
					try {
						const data = JSON.parse(infoMessage.Data);
						console.log(`      Data:`, data);
					} catch {
						console.log(`      Data: ${infoMessage.Data}`);
					}
				} else {
					console.log(`      Data: null`);
				}
			} else {
				console.log(`   No Info response received`);
			}
		} catch (e) {
			console.error(`   ❌ Error:`, e instanceof Error ? e.message : String(e));
		}
	}
}

// Main analysis runner
async function runNetworkAnalysis() {
	console.log('🌐 Starting Network Analysis for Token Issues...');
	console.log('This will analyze token contracts without requiring wallet signing.');
	console.log('');

	await analyzeTokenBalanceResponses();
	await analyzeTokenInfoResponses();
	await analyzeUCMContract();

	console.log('\n=== Network Analysis Completed ===');
	console.log('Check the output above to understand:');
	console.log('1. Which token contracts are active and responding');
	console.log('2. What Info action responses look like for each token');
	console.log('3. How the UCM contract handles different tokens');
}

// Run analysis if this file is executed directly
if (require.main === module) {
	runNetworkAnalysis().catch(console.error);
}

export {
	analyzeTokenBalanceResponses,
	analyzeTokenContract,
	analyzeTokenInfoResponses,
	analyzeUCMContract,
	runNetworkAnalysis,
};
