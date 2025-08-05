// Simple test script for royalty calculations
// Run with: node test-royalty-calculations.js

// Mock the royalty calculation function
function calculateRoyaltySplit(totalAmount, royaltyInfo) {
	if (!royaltyInfo || !royaltyInfo.hasRoyalties) {
		return {
			creatorAmount: 0,
			sellerAmount: totalAmount,
			totalAmount,
			royaltyPercentage: 0,
		};
	}

	const creatorAmount = Math.floor((totalAmount * royaltyInfo.royaltyPercentage) / 100);
	const sellerAmount = totalAmount - creatorAmount;

	return {
		creatorAmount,
		sellerAmount,
		totalAmount,
		royaltyPercentage: royaltyInfo.royaltyPercentage,
	};
}

// Test cases
const testCases = [
	{
		name: 'No royalties',
		totalAmount: 1000,
		royaltyInfo: { hasRoyalties: false, royaltyPercentage: 10, creatorAddress: 'test' },
		expected: { creatorAmount: 0, sellerAmount: 1000, totalAmount: 1000, royaltyPercentage: 0 },
	},
	{
		name: '5% royalty',
		totalAmount: 1000,
		royaltyInfo: { hasRoyalties: true, royaltyPercentage: 5, creatorAddress: 'test' },
		expected: { creatorAmount: 50, sellerAmount: 950, totalAmount: 1000, royaltyPercentage: 5 },
	},
	{
		name: '10% royalty',
		totalAmount: 1000,
		royaltyInfo: { hasRoyalties: true, royaltyPercentage: 10, creatorAddress: 'test' },
		expected: { creatorAmount: 100, sellerAmount: 900, totalAmount: 1000, royaltyPercentage: 10 },
	},
	{
		name: '50% royalty',
		totalAmount: 1000,
		royaltyInfo: { hasRoyalties: true, royaltyPercentage: 50, creatorAddress: 'test' },
		expected: { creatorAmount: 500, sellerAmount: 500, totalAmount: 1000, royaltyPercentage: 50 },
	},
	{
		name: '7% royalty on 100',
		totalAmount: 100,
		royaltyInfo: { hasRoyalties: true, royaltyPercentage: 7, creatorAddress: 'test' },
		expected: { creatorAmount: 7, sellerAmount: 93, totalAmount: 100, royaltyPercentage: 7 },
	},
	{
		name: '3% royalty on 100',
		totalAmount: 100,
		royaltyInfo: { hasRoyalties: true, royaltyPercentage: 3, creatorAddress: 'test' },
		expected: { creatorAmount: 3, sellerAmount: 97, totalAmount: 100, royaltyPercentage: 3 },
	},
];

// Run tests
console.log('🧪 Testing Royalty Calculations\n');

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
	console.log(`Test ${index + 1}: ${testCase.name}`);

	const result = calculateRoyaltySplit(testCase.totalAmount, testCase.royaltyInfo);

	// Check if results match expected values
	const isCorrect =
		result.creatorAmount === testCase.expected.creatorAmount &&
		result.sellerAmount === testCase.expected.sellerAmount &&
		result.totalAmount === testCase.expected.totalAmount &&
		result.royaltyPercentage === testCase.expected.royaltyPercentage;

	if (isCorrect) {
		console.log('✅ PASSED');
		passedTests++;
	} else {
		console.log('❌ FAILED');
		console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
		console.log(`   Got:      ${JSON.stringify(result)}`);
	}

	console.log(`   Sale: ${testCase.totalAmount}, Royalty: ${testCase.royaltyInfo.royaltyPercentage}%`);
	console.log(`   Creator: ${result.creatorAmount}, Seller: ${result.sellerAmount}, Total: ${result.totalAmount}`);
	console.log('');
});

// Summary
console.log('📊 Test Summary');
console.log(`Passed: ${passedTests}/${totalTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
	console.log('🎉 All tests passed! Royalty calculations are working correctly.');
} else {
	console.log('⚠️  Some tests failed. Please check the implementation.');
}

// Additional validation tests
console.log('\n🔍 Additional Validation Tests');

// Test that amounts add up correctly
const validationTests = [
	{ amount: 1000, percentage: 5 },
	{ amount: 1000, percentage: 10 },
	{ amount: 1000, percentage: 50 },
	{ amount: 100, percentage: 7 },
	{ amount: 100, percentage: 3 },
];

validationTests.forEach((test) => {
	const royaltyInfo = { hasRoyalties: true, royaltyPercentage: test.percentage, creatorAddress: 'test' };
	const result = calculateRoyaltySplit(test.amount, royaltyInfo);

	const amountsAddUp = result.creatorAmount + result.sellerAmount === result.totalAmount;
	const percentageCorrect = result.royaltyPercentage === test.percentage;

	console.log(`Amount: ${test.amount}, Royalty: ${test.percentage}%`);
	console.log(`  Creator: ${result.creatorAmount}, Seller: ${result.sellerAmount}, Total: ${result.totalAmount}`);
	console.log(`  Amounts add up: ${amountsAddUp ? '✅' : '❌'}`);
	console.log(`  Percentage correct: ${percentageCorrect ? '✅' : '❌'}`);
	console.log('');
});
