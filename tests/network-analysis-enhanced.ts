import { connect } from '@permaweb/aoconnect';

// Define token registry for testing
const TOKEN_REGISTRY = {
	xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10: {
		id: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
		name: 'Wrapped AR',
		symbol: 'wAR',
		logo: 'L99jaxRKQKJt9CqoJtPaieGPEhJD3wNhR4iGqc8amXs',
		denomination: 12,
		description: 'Wrapped Arweave token',
		priority: 1,
	},
	'7GoQfmSOct_aUOWKM4xbKGg6DzAmOgdKwg8Kf-CbHm4': {
		id: '7GoQfmSOct_aUOWKM4xbKGg6DzAmOgdKwg8Kf-CbHm4',
		name: 'Wander Token',
		symbol: 'WANDER',
		logo: 'xUO2tQglSYsW89aLYN8ErGivZqezoDaEn95JniaCBZk',
		denomination: 12,
		description: 'Wander protocol token',
		priority: 2,
	},
	'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo': {
		id: 'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo',
		name: 'PIXL Token',
		symbol: 'PIXL',
		logo: 'czR2tJmSr7upPpReXu6IuOc2H7RuHRRAhI7DXAUlszU',
		denomination: 6,
		description: 'PIXL protocol token',
		priority: 3,
	},
	'UkS-mdoiG8hcAClhKK8ch4ZhEzla0mCPDOix9hpdSFE': {
		id: 'UkS-mdoiG8hcAClhKK8ch4ZhEzla0mCPDOix9hpdSFE',
		name: 'AO',
		symbol: 'AO',
		logo: 'UkS-mdoiG8hcAClhKK8ch4ZhEzla0mCPDOix9hpdSFE',
		denomination: 12,
		description: 'AO Standard Token',
		priority: 4,
	},
};

// Simplified token alternatives functions
function getAlternativeTokenIds(tokenId: string): string[] {
	const token = TOKEN_REGISTRY[tokenId];
	if (!token) return [];

	const symbol = token.symbol.toLowerCase();

	if (symbol.includes('wander')) {
		return ['wander-token-v2', 'wander-token-mainnet', 'wander-protocol-token'];
	} else if (symbol.includes('ao')) {
		return ['ao-standard-token', 'ao-protocol-token', 'ao-mainnet-token'];
	} else if (symbol.includes('pixl')) {
		return ['pixl-token-v2', 'pixl-protocol-token'];
	} else if (symbol.includes('war')) {
		return ['wrapped-ar-token', 'war-token-mainnet'];
	}

	return [];
}

function getFallbackToken(tokenId: string): string {
	const token = TOKEN_REGISTRY[tokenId];
	if (!token) return 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10';

	const symbol = token.symbol.toLowerCase();

	if (symbol.includes('wander') || symbol.includes('ao') || symbol.includes('pixl')) {
		return 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10';
	}

	return 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10';
}

function getTokenSuggestions(failedTokenId: string): {
	alternatives: string[];
	fallback: string;
	reason: string;
} {
	const alternatives = getAlternativeTokenIds(failedTokenId);
	const fallback = getFallbackToken(failedTokenId);
	const token = TOKEN_REGISTRY[failedTokenId];

	let reason = 'Token contract not responding';
	if (token) {
		reason = `${token.name} (${token.symbol}) contract is not responding. Try alternatives or use ${
			TOKEN_REGISTRY[fallback]?.name || 'wAR'
		} as fallback.`;
	}

	return {
		alternatives,
		fallback,
		reason,
	};
}

const ao = connect({ MODE: 'legacy' });

interface TokenAnalysisResult {
	tokenId: string;
	tokenName: string;
	status: 'working' | 'partial' | 'not_working' | 'network_error';
	balanceResponse: any;
	infoResponse: any;
	error?: string;
	alternatives: string[];
	fallback: string;
	recommendations: string[];
}

interface EnhancedAnalysisResult {
	summary: {
		totalTokens: number;
		workingTokens: number;
		partialTokens: number;
		notWorkingTokens: number;
		networkErrors: number;
	};
	results: TokenAnalysisResult[];
	recommendations: {
		immediate: string[];
		shortTerm: string[];
		longTerm: string[];
	};
}

async function testTokenContract(tokenId: string, tokenName: string): Promise<TokenAnalysisResult> {
	const result: TokenAnalysisResult = {
		tokenId,
		tokenName,
		status: 'not_working',
		balanceResponse: null,
		infoResponse: null,
		alternatives: getAlternativeTokenIds(tokenId),
		fallback: getFallbackToken(tokenId) || 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
		recommendations: [],
	};

	try {
		// Test Balance action
		console.log(`Testing Balance action for ${tokenName} (${tokenId})...`);
		const balanceResponse = await ao.dryrun({
			process: tokenId,
			action: 'Balance',
			tags: [{ name: 'Recipient', value: 'test-address' }],
		});
		result.balanceResponse = balanceResponse;

		// Test Info action
		console.log(`Testing Info action for ${tokenName} (${tokenId})...`);
		const infoResponse = await ao.dryrun({
			process: tokenId,
			action: 'Info',
		});
		result.infoResponse = infoResponse;

		// Determine status based on responses
		if (balanceResponse && infoResponse) {
			// Check if we got any response (even if it's an error)
			const hasBalanceResponse = balanceResponse && typeof balanceResponse === 'object';
			const hasInfoResponse = infoResponse && typeof infoResponse === 'object';

			if (hasBalanceResponse && hasInfoResponse) {
				result.status = 'working';
				result.recommendations.push('Token is fully functional');
			} else if (hasBalanceResponse || hasInfoResponse) {
				result.status = 'partial';
				result.recommendations.push('Token has limited functionality');
			} else {
				result.status = 'not_working';
				result.recommendations.push('Token responds but returns null data');
			}
		} else {
			result.status = 'not_working';
			result.recommendations.push('Token does not respond to standard actions');
		}
	} catch (error: any) {
		result.status = 'network_error';
		result.error = error.message;
		result.recommendations.push(`Network error: ${error.message}`);
	}

	// Add specific recommendations based on status
	if (result.status === 'not_working' || result.status === 'network_error') {
		result.recommendations.push(`Use fallback token: ${TOKEN_REGISTRY[result.fallback]?.name || 'wAR'}`);
		result.recommendations.push('Consider alternative process IDs');
	}

	return result;
}

async function testAlternativeTokenIds(tokenId: string, alternatives: string[]): Promise<TokenAnalysisResult[]> {
	const results: TokenAnalysisResult[] = [];

	for (const altId of alternatives.slice(0, 3)) {
		// Test first 3 alternatives
		try {
			console.log(`Testing alternative: ${altId}`);
			const result = await testTokenContract(altId, `Alternative for ${TOKEN_REGISTRY[tokenId]?.name || 'Unknown'}`);
			results.push(result);
		} catch (error) {
			console.log(`Alternative ${altId} failed: ${error}`);
		}
	}

	return results;
}

async function runEnhancedNetworkAnalysis(): Promise<EnhancedAnalysisResult> {
	console.log('🔍 Starting Enhanced Network Analysis...\n');

	const results: TokenAnalysisResult[] = [];
	const alternativeResults: TokenAnalysisResult[] = [];

	// Test all tokens in registry
	for (const [tokenId, token] of Object.entries(TOKEN_REGISTRY)) {
		console.log(`\n📊 Analyzing ${token.name} (${token.symbol})...`);

		const result = await testTokenContract(tokenId, token.name);
		results.push(result);

		// If token is not working, test alternatives
		if (result.status === 'not_working' || result.status === 'network_error') {
			console.log(`🔍 Testing alternatives for ${token.name}...`);
			const altResults = await testAlternativeTokenIds(tokenId, result.alternatives);
			alternativeResults.push(...altResults);
		}
	}

	// Compile summary
	const summary = {
		totalTokens: results.length,
		workingTokens: results.filter((r) => r.status === 'working').length,
		partialTokens: results.filter((r) => r.status === 'partial').length,
		notWorkingTokens: results.filter((r) => r.status === 'not_working').length,
		networkErrors: results.filter((r) => r.status === 'network_error').length,
	};

	// Generate recommendations
	const recommendations = {
		immediate: [] as string[],
		shortTerm: [] as string[],
		longTerm: [] as string[],
	};

	// Immediate recommendations
	if (summary.workingTokens === 0) {
		recommendations.immediate.push('No tokens are working - implement emergency fallback to wAR');
	}
	if (summary.notWorkingTokens > 0) {
		recommendations.immediate.push('Implement graceful fallbacks for non-working tokens');
	}

	// Short-term recommendations
	if (summary.partialTokens > 0) {
		recommendations.shortTerm.push('Investigate partial token functionality and implement workarounds');
	}
	if (alternativeResults.length > 0) {
		recommendations.shortTerm.push('Test and validate alternative token process IDs');
	}

	// Long-term recommendations
	recommendations.longTerm.push('Establish token health monitoring system');
	recommendations.longTerm.push('Create token contract validation framework');
	recommendations.longTerm.push('Implement automatic token discovery and validation');

	return {
		summary,
		results: [...results, ...alternativeResults],
		recommendations,
	};
}

function printAnalysisResults(analysis: EnhancedAnalysisResult) {
	console.log('\n' + '='.repeat(80));
	console.log('🔍 ENHANCED NETWORK ANALYSIS RESULTS');
	console.log('='.repeat(80));

	// Summary
	console.log('\n📊 SUMMARY:');
	console.log(`Total Tokens: ${analysis.summary.totalTokens}`);
	console.log(`✅ Working: ${analysis.summary.workingTokens}`);
	console.log(`⚠️  Partial: ${analysis.summary.partialTokens}`);
	console.log(`❌ Not Working: ${analysis.summary.notWorkingTokens}`);
	console.log(`🌐 Network Errors: ${analysis.summary.networkErrors}`);

	// Detailed Results
	console.log('\n📋 DETAILED RESULTS:');
	analysis.results.forEach((result, index) => {
		console.log(`\n${index + 1}. ${result.tokenName} (${result.tokenId})`);
		console.log(`   Status: ${result.status.toUpperCase()}`);
		if (result.error) {
			console.log(`   Error: ${result.error}`);
		}
		console.log(`   Balance Response: ${result.balanceResponse ? 'Received' : 'None'}`);
		console.log(`   Info Response: ${result.infoResponse ? 'Received' : 'None'}`);
		console.log(`   Fallback: ${TOKEN_REGISTRY[result.fallback]?.name || 'Unknown'}`);
		console.log(`   Recommendations:`);
		result.recommendations.forEach((rec) => console.log(`     - ${rec}`));
	});

	// Recommendations
	console.log('\n💡 RECOMMENDATIONS:');

	console.log('\n🚨 IMMEDIATE ACTIONS:');
	analysis.recommendations.immediate.forEach((rec) => console.log(`   • ${rec}`));

	console.log('\n⏰ SHORT-TERM ACTIONS:');
	analysis.recommendations.shortTerm.forEach((rec) => console.log(`   • ${rec}`));

	console.log('\n🎯 LONG-TERM ACTIONS:');
	analysis.recommendations.longTerm.forEach((rec) => console.log(`   • ${rec}`));

	// Token Suggestions
	console.log('\n🔧 TOKEN SUGGESTIONS:');
	const nonWorkingTokens = analysis.results.filter((r) => r.status === 'not_working' || r.status === 'network_error');

	nonWorkingTokens.forEach((token) => {
		const suggestions = getTokenSuggestions(token.tokenId);
		console.log(`\n   ${token.tokenName}:`);
		console.log(`     Reason: ${suggestions.reason}`);
		console.log(`     Fallback: ${TOKEN_REGISTRY[suggestions.fallback]?.name || 'Unknown'}`);
		if (suggestions.alternatives.length > 0) {
			console.log(`     Alternatives: ${suggestions.alternatives.slice(0, 3).join(', ')}`);
		}
	});

	console.log('\n' + '='.repeat(80));
}

// Main execution
async function main() {
	try {
		const analysis = await runEnhancedNetworkAnalysis();
		printAnalysisResults(analysis);

		// Save results to file
		const fs = require('fs');
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filename = `network-analysis-enhanced-${timestamp}.json`;

		fs.writeFileSync(filename, JSON.stringify(analysis, null, 2));
		console.log(`\n💾 Results saved to: ${filename}`);
	} catch (error) {
		console.error('❌ Analysis failed:', error);
		process.exit(1);
	}
}

// Run if called directly
if (require.main === module) {
	main();
}

export { runEnhancedNetworkAnalysis, testAlternativeTokenIds, testTokenContract };
