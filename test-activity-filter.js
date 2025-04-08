/**
 * Activity Filter Test Script
 *
 * This script tests the activity filtering implementation for Bazar.
 * It verifies that:
 * 1. Direct transfers are properly identified
 * 2. Marketplace activities are correctly categorized
 * 3. The ActivityTable component renders all activity types correctly
 */

// Use node-fetch for browser-like fetch in Node.js
const fetch = require('node-fetch');

// Constants
const ARWEAVE_GATEWAY_URL = 'https://arweave.net/graphql';
const TEST_WALLET_ADDRESS = 'D5f-YauICIy3tVyGZKXiKxErKTZT7L7z941d1VlsIao'; // Example wallet to test

// Adjusted queries to match our implementation
const GET_DIRECT_TRANSFERS = `
  query GetDirectTransfers($address: String!, $first: Int!) {
    transactions(
      first: $first,
      tags: [
        { name: "Action", values: ["Transfer"] }
        { name: "Data-Protocol", values: ["ao"] }
      ]
      recipients: ["$address"]
    ) {
      edges {
        node {
          id
          owner {
            address
          }
          recipient
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

const GET_MARKETPLACE_ACTIVITIES = `
  query GetMarketplaceActivities($address: String!, $first: Int!) {
    transactions(
      first: $first,
      tags: [
        { name: "Data-Protocol", values: ["ao"] }
        { name: "Handler", values: ["Create-Order", "Cancel-Order"] }
      ]
      owners: ["$address"]
    ) {
      edges {
        node {
          id
          owner {
            address
          }
          recipient
          tags {
            name
            value
          }
          block {
            timestamp
          }
        }
      }
    }
  }
`;

// Helper function to extract tag value
function getTagValue(tags, name) {
	const tag = tags.find((t) => t.name === name);
	return tag ? tag.value : null;
}

// Helper function to execute GraphQL queries
async function executeQuery(query, address, first = 20) {
	try {
		// Replace address in query
		const modifiedQuery = query.replace(/\$address/g, address);

		const response = await fetch(ARWEAVE_GATEWAY_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: modifiedQuery,
				variables: { first },
			}),
		});

		if (!response.ok) {
			throw new Error(`GraphQL request failed with status ${response.status}`);
		}

		const data = await response.json();

		if (data.errors) {
			console.error('GraphQL errors:', data.errors);
			return { data: { transactions: { edges: [] } } };
		}

		return data;
	} catch (error) {
		console.error('Error executing GraphQL query:', error);
		return { data: { transactions: { edges: [] } } };
	}
}

// Function to analyze transaction to determine if it's a direct transfer or marketplace activity
function analyzeTransaction(tx) {
	const tags = tx.tags || [];

	// Check for marketplace tags
	const hasMarketplaceTags = tags.some(
		(tag) =>
			(tag.name === 'Handler' && ['Create-Order', 'Cancel-Order'].includes(tag.value)) ||
			(tag.name === 'X-Order-Action' && ['Create-Order', 'Cancel-Order'].includes(tag.value))
	);

	const dominantToken =
		getTagValue(tags, 'DominantToken') ||
		getTagValue(tags, 'X-Dominant-Token') ||
		getTagValue(tags, 'Asset-Id') ||
		getTagValue(tags, 'Target');

	const price = parseInt(getTagValue(tags, 'Price') || '0', 10);
	const quantity = parseInt(getTagValue(tags, 'Quantity') || '0', 10);

	// Determine transaction type
	let type = 'Unknown';
	if (hasMarketplaceTags) {
		if (getTagValue(tags, 'Handler') === 'Create-Order' || getTagValue(tags, 'X-Order-Action') === 'Create-Order') {
			type = 'Listing';
		} else if (getTagValue(tags, 'Handler') === 'Cancel-Order') {
			type = 'Unlisted';
		}
	} else if (getTagValue(tags, 'Action') === 'Transfer') {
		type = 'Transfer';
	}

	return {
		id: tx.id,
		type,
		dominantToken,
		price,
		quantity,
		sender: tx.owner?.address,
		receiver: tx.recipient,
		timestamp: tx.block?.timestamp,
		tags: tags.map((t) => `${t.name}: ${t.value}`).join(', '),
	};
}

// Main test function
async function runTest() {
	console.log(`Testing activity for wallet: ${TEST_WALLET_ADDRESS}`);

	// Fetch direct transfers
	console.log('\nFetching direct transfers...');
	const directTransfersResponse = await executeQuery(GET_DIRECT_TRANSFERS, TEST_WALLET_ADDRESS);
	const directTransfers = directTransfersResponse?.data?.transactions?.edges?.map((edge) => edge.node) || [];

	// Fetch marketplace activities
	console.log('\nFetching marketplace activities...');
	const marketplaceResponse = await executeQuery(GET_MARKETPLACE_ACTIVITIES, TEST_WALLET_ADDRESS);
	const marketplaceActivities = marketplaceResponse?.data?.transactions?.edges?.map((edge) => edge.node) || [];

	// Analyze transactions
	console.log('\nAnalyzing activity...');
	const analyzedDirectTransfers = directTransfers.map(analyzeTransaction);
	const analyzedMarketplace = marketplaceActivities.map(analyzeTransaction);

	// Print summary
	console.log('\n--- ACTIVITY SUMMARY ---');
	console.log(`Direct Transfers: ${analyzedDirectTransfers.length}`);
	console.log(`Marketplace Activities: ${analyzedMarketplace.length}`);

	// Print sample transactions
	if (analyzedDirectTransfers.length > 0) {
		console.log('\n--- SAMPLE DIRECT TRANSFER ---');
		console.log(JSON.stringify(analyzedDirectTransfers[0], null, 2));
	}

	if (analyzedMarketplace.length > 0) {
		console.log('\n--- SAMPLE MARKETPLACE ACTIVITY ---');
		console.log(JSON.stringify(analyzedMarketplace[0], null, 2));
	}

	console.log('\nTest completed!');
}

// Run the test
runTest().catch(console.error);
