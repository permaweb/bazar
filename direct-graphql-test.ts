// Direct GraphQL Test for Arweave
// This script directly queries Arweave's GraphQL API to see the raw data

const ARWEAVE_GATEWAY_URL = 'https://arweave.net/graphql';

// Test address with real transactions
const TEST_ADDRESS = 'ypjwVnuXu5h4Hlz45M46yABxv3f1qjziCQmcz5PoDaA';

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
async function testDirectGraphQL() {
	try {
		console.log('Starting direct GraphQL queries to Arweave...\n');
		console.log('Test Address:', TEST_ADDRESS);

		// Execute queries for each activity type
		console.log('\n1. Querying Listed Orders:');
		const listedOrders = await executeGraphQLQuery(GET_LISTED_ORDERS, { first: 10 });

		console.log('\n2. Querying Cancelled Orders:');
		const cancelledOrders = await executeGraphQLQuery(GET_CANCELLED_ORDERS, { first: 10 });

		console.log('\n3. Querying Purchases:');
		const purchases = await executeGraphQLQuery(GET_PURCHASES, { first: 10 });

		console.log('\n4. Querying Sales:');
		const sales = await executeGraphQLQuery(GET_SALES, { first: 10 });

		// Print summary of results
		console.log('\nQuery Results Summary:');
		console.log('---------------------');
		console.log(`Listed Orders: ${listedOrders.data.transactions.edges.length}`);
		console.log(`Cancelled Orders: ${cancelledOrders.data.transactions.edges.length}`);
		console.log(`Purchases: ${purchases.data.transactions.edges.length}`);
		console.log(`Sales: ${sales.data.transactions.edges.length}`);

		// Print detailed tag information for each transaction
		console.log('\nDetailed Tag Information:');
		console.log('------------------------');

		const allTransactions = [
			...listedOrders.data.transactions.edges.map((edge) => ({ ...edge.node, type: 'LISTED' })),
			...cancelledOrders.data.transactions.edges.map((edge) => ({ ...edge.node, type: 'CANCELLED' })),
			...purchases.data.transactions.edges.map((edge) => ({ ...edge.node, type: 'PURCHASE' })),
			...sales.data.transactions.edges.map((edge) => ({ ...edge.node, type: 'SALE' })),
		];

		allTransactions.forEach((tx, index) => {
			console.log(`\nTransaction #${index + 1} (${tx.type}):`);
			console.log(`ID: ${tx.id}`);
			console.log(`Owner: ${tx.owner.address}`);
			console.log(`Timestamp: ${new Date(tx.block.timestamp * 1000).toISOString()}`);
			console.log('Tags:');
			tx.tags.forEach((tag) => {
				console.log(`  ${tag.name}: ${tag.value}`);
			});
		});

		console.log('\nAll tests completed successfully!');
	} catch (error) {
		console.error('Test failed:', error);
		process.exit(1);
	}
}

// Run the tests
testDirectGraphQL().catch(console.error);
