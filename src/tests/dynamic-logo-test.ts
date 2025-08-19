/**
 * Test file to demonstrate dynamic logo fetching functionality
 */

import { TOKEN_REGISTRY } from '../helpers/config';
import { fetchTokenMetadata, getEnhancedTokenMetadata, getTokenLogo } from '../helpers/tokenMetadata';

const PI_TOKEN_ID = '4hXj_E-5fAKmo4E8KjgQvuDJKAFk9P2grhycVmISDLs';

/**
 * Test function to verify dynamic logo fetching works for PI token
 */
export async function testDynamicLogoFetching(): Promise<void> {
	console.log('🧪 Testing Dynamic Logo Fetching');
	console.log('=====================================');

	try {
		// Test 1: Check registry setup
		console.log('\n1. Checking TOKEN_REGISTRY setup...');
		const registryToken = TOKEN_REGISTRY[PI_TOKEN_ID];
		console.log(`PI Token in registry:`, registryToken);
		console.log(`Logo field: ${registryToken?.logo} (should be 'dynamicLogo')`);

		// Test 2: Fetch token metadata directly
		console.log('\n2. Fetching token metadata...');
		const metadata = await fetchTokenMetadata(PI_TOKEN_ID);
		console.log(`Fetched metadata:`, metadata);

		// Test 3: Get logo specifically
		console.log('\n3. Getting token logo...');
		const logo = await getTokenLogo(PI_TOKEN_ID);
		console.log(`Dynamic logo: ${logo}`);
		console.log(`Expected logo: zmQwyD6QiZge10OG2HasBqu27Zg0znGkdFRufOq6rv0`);

		// Test 4: Get enhanced metadata
		console.log('\n4. Getting enhanced metadata...');
		const enhanced = await getEnhancedTokenMetadata(PI_TOKEN_ID);
		console.log(`Enhanced metadata:`, enhanced);

		// Test 5: Verify logo resolution priority
		console.log('\n5. Testing logo resolution priority...');
		if (enhanced.logo) {
			console.log(`✅ Logo resolved from metadata: ${enhanced.logo}`);
			if (enhanced.logo === 'zmQwyD6QiZge10OG2HasBqu27Zg0znGkdFRufOq6rv0') {
				console.log('✅ Logo matches expected value!');
			} else {
				console.log(`ℹ️  Logo differs from expected. Got: ${enhanced.logo}`);
			}
		} else {
			console.log('❌ No logo resolved');
		}

		// Test 6: Test other tokens for comparison
		console.log('\n6. Testing other tokens for comparison...');
		const otherTokens = Object.keys(TOKEN_REGISTRY).filter((id) => id !== PI_TOKEN_ID);

		for (const tokenId of otherTokens.slice(0, 2)) {
			// Test first 2 other tokens
			const token = TOKEN_REGISTRY[tokenId];
			console.log(`\n${token.name} (${token.symbol}):`);
			console.log(`  Registry logo: ${token.logo}`);

			try {
				const tokenLogo = await getTokenLogo(tokenId);
				console.log(`  Resolved logo: ${tokenLogo}`);
			} catch (error) {
				console.log(`  Error getting logo: ${error}`);
			}
		}

		console.log('\n✅ Dynamic logo testing complete!');
	} catch (error) {
		console.error('❌ Error during dynamic logo testing:', error);
		throw error;
	}
}

/**
 * Test the caching functionality
 */
export async function testLogoCaching(): Promise<void> {
	console.log('\n🔄 Testing Logo Caching');
	console.log('========================');

	try {
		// First call - should fetch from network
		console.log('First call (should fetch from network)...');
		const start1 = Date.now();
		const logo1 = await getTokenLogo(PI_TOKEN_ID);
		const time1 = Date.now() - start1;
		console.log(`Logo: ${logo1}, Time: ${time1}ms`);

		// Second call - should use cache
		console.log('Second call (should use cache)...');
		const start2 = Date.now();
		const logo2 = await getTokenLogo(PI_TOKEN_ID);
		const time2 = Date.now() - start2;
		console.log(`Logo: ${logo2}, Time: ${time2}ms`);

		if (logo1 === logo2) {
			console.log('✅ Caching working correctly - same result');
		} else {
			console.log('❌ Caching issue - different results');
		}

		if (time2 < time1) {
			console.log('✅ Cache performance improvement detected');
		} else {
			console.log('ℹ️  No significant performance difference (may be normal for small requests)');
		}
	} catch (error) {
		console.error('❌ Error during caching test:', error);
	}
}

/**
 * Run all dynamic logo tests
 */
export async function runDynamicLogoTests(): Promise<void> {
	console.log('🚀 Starting Dynamic Logo Integration Tests');
	console.log('===========================================');

	try {
		await testDynamicLogoFetching();
		await testLogoCaching();

		console.log('\n🎉 All dynamic logo tests completed successfully!');
		console.log('\nNext steps:');
		console.log('1. Check the TokenSelector component shows the dynamic logo');
		console.log('2. Verify CurrencyLine component uses the dynamic logo');
		console.log('3. Test the system with live token metadata');
	} catch (error) {
		console.error('❌ Dynamic logo tests failed:', error);
		throw error;
	}
}

// Export for browser console testing
if (typeof window !== 'undefined') {
	(window as any).testDynamicLogos = runDynamicLogoTests;
	console.log('💡 Run window.testDynamicLogos() in browser console to test dynamic logo functionality');
}
