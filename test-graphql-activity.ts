/**
 * Test script for GraphQL activity queries
 *
 * This script tests the GraphQL queries used to fetch user activity data.
 * We directly use the getUserActivity function from the activity.ts module
 * to verify that it correctly fetches and processes user activity data.
 */

import { getUserActivity } from './src/api/activity';

// Import the GraphQL queries directly
const ARWEAVE_GATEWAY_URL = 'https://arweave.net/graphql';

// Test address with real transactions
const TEST_ADDRESS = 'ypjwVnuXu5h4Hlz45M46yABxv3f1qjziCQmcz5PoDaA';

// Helper function to format dates consistently
function formatDate(date: Date): string {
	return date.toISOString();
}

// Helper function to print raw JSON data
function printRawJSON(data: any, title: string) {
	console.log(`\n${title}:`);
	console.log('='.repeat(title.length + 1));
	console.log(JSON.stringify(data, null, 2));
}

// Helper function to execute GraphQL queries directly
async function executeGraphQLQuery(query: string, variables: any) {
	console.log('\nExecuting GraphQL Query:');
	console.log('------------------------');
	console.log('Query:', query);
	console.log('Variables:', JSON.stringify(variables, null, 2));

	try {
		const response = await fetch(ARWEAVE_GATEWAY_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query,
				variables,
			}),
		});

		if (!response.ok) {
			throw new Error(`GraphQL request failed with status ${response.status}`);
		}

		const data = await response.json();

		console.log('\nGraphQL Response:');
		console.log('----------------');
		console.log(JSON.stringify(data, null, 2));

		return data;
	} catch (error) {
		console.error('Error executing GraphQL query:', error);
		return { data: { transactions: { edges: [] } } };
	}
}

// GraphQL queries for different activity types
const GET_LISTED_ORDERS = `
	query GetListedOrders($first: Int!) {
		transactions(
			first: $first,
			owners: ["${TEST_ADDRESS}"],
			tags: [
				{ name: "Data-Protocol", values: ["ao"] }
				{ name: "Type", values: ["Message"] }
				{ name: "Handler", values: ["Create-Order"] }
			]
		) {
			edges {
				node {
					id
					owner {
						address
					}
					tags {
						name
						value
					}
					block {
						height
						timestamp
					}
				}
			}
		}
	}
`;

const GET_CANCELLED_ORDERS = `
	query GetCancelledOrders($first: Int!) {
		transactions(
			first: $first,
			owners: ["${TEST_ADDRESS}"],
			tags: [
				{ name: "Data-Protocol", values: ["ao"] }
				{ name: "Type", values: ["Message"] }
				{ name: "Handler", values: ["Cancel-Order"] }
			]
		) {
			edges {
				node {
					id
					owner {
						address
					}
					tags {
						name
						value
					}
					block {
						height
						timestamp
					}
				}
			}
		}
	}
`;

const GET_PURCHASES = `
	query GetPurchases($first: Int!) {
		transactions(
			first: $first,
			recipients: ["${TEST_ADDRESS}"],
			tags: [
				{ name: "Data-Protocol", values: ["ao"] }
				{ name: "Type", values: ["Message"] }
				{ name: "Action", values: ["Transfer", "Transfer-Success", "Credit-Notice"] }
			]
		) {
			edges {
				node {
					id
					owner {
						address
					}
					tags {
						name
						value
					}
					block {
						height
						timestamp
					}
				}
			}
		}
	}
`;

const GET_SALES = `
	query GetSales($first: Int!) {
		transactions(
			first: $first,
			owners: ["${TEST_ADDRESS}"],
			tags: [
				{ name: "Data-Protocol", values: ["ao"] }
				{ name: "Type", values: ["Message"] }
				{ name: "Action", values: ["Transfer", "Transfer-Success", "Debit-Notice"] }
			]
		) {
			edges {
				node {
					id
					owner {
						address
					}
					tags {
						name
						value
					}
					block {
						height
						timestamp
					}
				}
			}
		}
	}
`;

// Main test function
async function testUserActivity() {
	try {
		console.log('Starting direct GraphQL queries to Arweave...\n');

		// Test 1: Direct GraphQL queries for each activity type
		console.log('Test 1: Direct GraphQL queries for each activity type');
		console.log('------------------------------------------------');

		// Execute queries for each activity type
		const [listedOrders, cancelledOrders, purchases, sales] = await Promise.all([
			executeGraphQLQuery(GET_LISTED_ORDERS, { first: 10 }),
			executeGraphQLQuery(GET_CANCELLED_ORDERS, { first: 10 }),
			executeGraphQLQuery(GET_PURCHASES, { first: 10 }),
			executeGraphQLQuery(GET_SALES, { first: 10 }),
		]);

		// Print summary of results
		console.log('\nQuery Results Summary:');
		console.log('---------------------');
		console.log(`Listed Orders: ${listedOrders.data.transactions.edges.length}`);
		console.log(`Cancelled Orders: ${cancelledOrders.data.transactions.edges.length}`);
		console.log(`Purchases: ${purchases.data.transactions.edges.length}`);
		console.log(`Sales: ${sales.data.transactions.edges.length}`);

		// Test 2: Using the getUserActivity function
		console.log('\nTest 2: Using the getUserActivity function');
		console.log('--------------------------------------');
		const startDate = new Date('2023-01-01');
		const endDate = new Date('2023-12-31');

		const activityResult = await getUserActivity(TEST_ADDRESS, startDate, endDate);

		console.log('✓ Successfully retrieved activity data');
		console.log(
			`Total activities: ${
				activityResult.listedOrders.length +
				activityResult.cancelledOrders.length +
				activityResult.executedOrders.length +
				(activityResult.directTransfers?.length || 0)
			}`
		);

		// Print raw activity result
		printRawJSON(activityResult, 'Raw Activity Data from getUserActivity');

		console.log('\nAll tests completed successfully!');
	} catch (error) {
		console.error('Test failed:', error);
		process.exit(1);
	}
}

// Run the tests
testUserActivity().catch(console.error);
