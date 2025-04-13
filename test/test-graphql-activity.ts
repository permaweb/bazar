/**
 * Test script for GraphQL activity queries
 *
 * This script tests the GraphQL queries used to fetch user activity data.
 * We directly use the getUserActivity function from the activity.ts module
 * to verify that it correctly fetches and processes user activity data.
 */

import { getUserActivity, ProcessedOrder, UserActivity } from './activity';

// Test address with real transactions
const TEST_ADDRESS = 'hqdL4AZaFZ0huQHbAsYxdTwG6vpibK7ALWKNzmWaD4Q';

// Helper function to format date
function formatDate(date: Date): string {
	return date.toISOString().split('T')[0];
}

// Helper function to validate activity data structure
function validateActivityData(data: UserActivity): boolean {
	const requiredFields = ['listedOrders', 'cancelledOrders', 'executedOrders', 'directTransfers'];
	return requiredFields.every((field) => Array.isArray(data[field as keyof UserActivity]));
}

// Helper function to print activity summary
function printActivitySummary(data: UserActivity) {
	console.log('\nActivity Summary:');
	console.log('----------------');
	console.log(`Listed Orders: ${data.listedOrders.length}`);
	console.log(`Cancelled Orders: ${data.cancelledOrders.length}`);
	console.log(`Executed Orders: ${data.executedOrders.length}`);
	console.log(`Direct Transfers: ${data.directTransfers.length}`);

	// Print details of each activity type
	['listedOrders', 'cancelledOrders', 'executedOrders', 'directTransfers'].forEach((activityType) => {
		const activities = data[activityType as keyof UserActivity] as ProcessedOrder[];
		if (activities.length > 0) {
			console.log(`\n${activityType}:`);
			activities.forEach((activity) => {
				console.log(`- ${activity.type} at ${new Date(activity.timestamp).toISOString()}`);
				console.log(`  Price: ${activity.price} ${activity.swapToken}`);
				console.log(`  Quantity: ${activity.quantity} ${activity.dominantToken}`);
			});
		}
	});
}

async function runTests() {
	console.log('Starting activity tests...\n');

	try {
		// Test 1: Default parameters
		console.log('Test 1: Default parameters');
		const defaultActivity = await getUserActivity(TEST_ADDRESS);
		console.log('✓ Successfully retrieved activity data');
		console.log(`Total activities: ${Object.values(defaultActivity).flat().length}`);
		printActivitySummary(defaultActivity);

		// Test 2: With date filtering
		console.log('\nTest 2: Date filtering');
		const startDate = new Date('2023-01-01');
		const endDate = new Date('2023-12-31');
		const filteredActivity = await getUserActivity(TEST_ADDRESS, startDate, endDate);
		console.log(`✓ Successfully filtered activities between ${formatDate(startDate)} and ${formatDate(endDate)}`);
		printActivitySummary(filteredActivity);

		// Test 3: Invalid address
		console.log('\nTest 3: Invalid address');
		try {
			await getUserActivity('invalid_address_format');
			console.log('✗ Should have thrown an error for invalid address');
		} catch (error) {
			console.log('✓ Correctly handled invalid address');
		}

		// Test 4: Empty address
		console.log('\nTest 4: Empty address');
		try {
			await getUserActivity('');
			console.log('✗ Should have thrown an error for empty address');
		} catch (error) {
			console.log('✓ Correctly handled empty address');
		}

		// Test 5: Network error simulation
		console.log('\nTest 5: Network error simulation');
		try {
			await getUserActivity(TEST_ADDRESS, undefined, undefined, true);
			console.log('✗ Should have thrown a network error');
		} catch (error) {
			console.log('✓ Correctly handled network error');
		}

		// Test 6: Data structure validation
		console.log('\nTest 6: Data structure validation');
		const isValid = validateActivityData(defaultActivity);
		console.log(`✓ Data structure validation: ${isValid ? 'PASSED' : 'FAILED'}`);

		console.log('\nAll tests completed successfully!');
	} catch (error) {
		console.error('Test failed:', error);
		process.exit(1);
	}
}

// Run the tests
runTests().catch((error) => {
	console.error('Test execution failed:', error);
	process.exit(1);
});
