/**
 * Test GraphQL Activity Data Fetch
 *
 * This script tests the GraphQL-based activity data fetching for user profiles
 * We directly use the getUserActivity function from the activity.ts module
 */

const { getUserActivity } = require('./src/api/activity');

// Test address - replace with a known active wallet address
const TEST_ADDRESS = 'D5f-YauICIy3tVyGZKXiKxErKTZT7L7z941d1VlsIao'; // Example address, replace if needed

// Mock console.groupCollapsed for cleaner output
const originalGroupCollapsed = console.groupCollapsed;
console.groupCollapsed = console.log;

async function testUserActivity() {
	console.log('========= BAZAR USER ACTIVITY TEST =========');
	console.log(`Testing activity data fetching for address: ${TEST_ADDRESS}`);
	console.log('Using GraphQL approach');

	try {
		// Call the getUserActivity function with different parameters
		console.log('\n----- TEST 1: Basic Query (Default Parameters) -----');
		const result1 = await getUserActivity(TEST_ADDRESS);
		logActivityResults(result1);

		console.log('\n----- TEST 2: Higher Limit (200 Records) -----');
		const result2 = await getUserActivity(TEST_ADDRESS, 200);
		logActivityResults(result2);

		console.log('\n----- TEST 3: With Date Range (Last 7 Days) -----');
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - 7);
		const result3 = await getUserActivity(TEST_ADDRESS, 100, startDate);
		logActivityResults(result3);

		console.log('\n----- TEST 4: With Different Query Variations -----');
		// This will exercise different query fallbacks
		const result4 = await getUserActivity(TEST_ADDRESS, 50);

		// Test the direct transfers specifically
		if (result4.directTransfers && result4.directTransfers.length > 0) {
			console.log('\nSample Direct Transfer:', result4.directTransfers[0]);
		} else {
			console.log('\nNo direct transfers found');
		}

		console.log('\n✅ All tests completed!');
	} catch (error) {
		console.error('Test failure:', error);
	}
}

function logActivityResults(result) {
	const listedCount = result?.listedOrders?.length || 0;
	const cancelledCount = result?.cancelledOrders?.length || 0;
	const executedCount = result?.executedOrders?.length || 0;
	const transfersCount = result?.directTransfers?.length || 0;

	console.log(`\nActivity results summary:`);
	console.log(`- Listed orders: ${listedCount}`);
	console.log(`- Cancelled orders: ${cancelledCount}`);
	console.log(`- Executed orders: ${executedCount}`);
	console.log(`- Direct transfers: ${transfersCount}`);
	console.log(`- Total activity items: ${listedCount + cancelledCount + executedCount + transfersCount}`);

	// Log sample data if available
	if (listedCount > 0) {
		console.log('\nSample Listed Order:');
		console.log(JSON.stringify(result.listedOrders[0], null, 2));
	}

	if (executedCount > 0) {
		console.log('\nSample Executed Order:');
		console.log(JSON.stringify(result.executedOrders[0], null, 2));
	}
}

// Run the tests
testUserActivity();
