import { getGQLData } from 'api';

// Constants
const ARWEAVE_GATEWAY_URL = 'https://arweave.net/graphql';
const DEBUG_MODE = true; // Enable debug mode to help troubleshoot

// Helper function to execute GraphQL queries
async function executeQuery(query: string, variables: any, userAddress?: string): Promise<any> {
	try {
		// Format variables
		const formattedVariables = { ...variables };
		Object.keys(formattedVariables).forEach((key) => {
			if (typeof formattedVariables[key] === 'string' && !isNaN(Number(formattedVariables[key]))) {
				formattedVariables[key] = parseInt(formattedVariables[key], 10);
			}
		});

		// If userAddress is provided, replace $address in the query
		let modifiedQuery = query;
		if (userAddress) {
			modifiedQuery = query.replace(/\$address/g, `"${userAddress}"`);
		}

		if (DEBUG_MODE) {
			console.log('Executing GraphQL query:', {
				query: modifiedQuery,
				variables: formattedVariables,
			});
		}

		const response = await fetch(ARWEAVE_GATEWAY_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: modifiedQuery,
				variables: formattedVariables,
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

// Helper function to safely process GraphQL response
function safelyProcessGraphQLResponse(response: any, type: string): any[] {
	if (!response?.data?.transactions?.edges) {
		if (DEBUG_MODE) {
			console.warn(`No ${type} found in response:`, response);
		}
		return [];
	}

	return response.data.transactions.edges.map((edge: any) => edge.node).filter(Boolean);
}

// Query strings
const ACTIVITY_TRANSACTION_FIELDS = `
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
`;

const GET_LISTED_ORDERS = `
  query GetListedOrders($first: Int!) {
    transactions(
      first: $first,
      owners: [$address],
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
            timestamp
          }
        }
      }
    }
  }
`;

const GET_LISTED_ORDERS_ALT = `
  query GetListedOrdersAlt($first: Int!) {
    transactions(
      first: $first,
      owners: [$address],
      tags: [
        { name: "Data-Protocol", values: ["ao"] }
        { name: "X-Order-Action", values: ["Create-Order"] }
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
      owners: [$address],
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
      recipients: [$address],
      tags: [
        { name: "Data-Protocol", values: ["ao"] }
        { name: "Type", values: ["Message"] }
        { name: "Action", values: ["Transfer", "Transfer-Success"] }
      ]
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

const GET_SALES = `
  query GetSales($first: Int!) {
    transactions(
      first: $first,
      owners: [$address],
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

const GET_DIRECT_TRANSFERS = `
  query GetDirectTransfers($first: Int!) {
    transactions(
      first: $first,
      tags: [
        { name: "Action", values: ["Transfer"] }
        { name: "Data-Protocol", values: ["ao"] }
      ]
      recipients: [$address]
    ) {
      edges {
        node {
          ${ACTIVITY_TRANSACTION_FIELDS}
        }
      }
    }
  }
`;

// Interfaces
interface UserActivity {
	listedOrders: ProcessedOrder[];
	cancelledOrders: ProcessedOrder[];
	executedOrders: ProcessedOrder[];
	directTransfers: ProcessedOrder[]; // Add this property
}

interface ProcessedOrder {
	id: string;
	orderId: string;
	timestamp: number;
	type: 'LISTED' | 'CANCELLED' | 'PURCHASED' | 'SOLD' | 'TRANSFER-IN' | 'TRANSFER-OUT';
	status: 'LISTED' | 'CANCELLED' | 'EXECUTED';
	price: number;
	quantity: number;
	dominantToken: string;
	swapToken: string;
	sender: string;
	receiver: string;
	isSender: boolean;
	isReceiver: boolean;
	isPurchase: boolean;
	isDirectTransfer?: boolean;
}

// Helper function to extract tag value
function getTagValue(tags: any[], name: string): string | null {
	const tag = tags.find((t) => t.name === name);
	return tag ? tag.value : null;
}

// Helper function to extract asset ID from transaction
function extractAssetId(transaction: any): string | null {
	const tags = transaction.tags || [];

	// Try all possible tag names for asset ID
	return (
		getTagValue(tags, 'DominantToken') ||
		getTagValue(tags, 'X-Dominant-Token') ||
		getTagValue(tags, 'Asset-Id') ||
		getTagValue(tags, 'Asset') ||
		getTagValue(tags, 'Data-Source') ||
		getTagValue(tags, 'Target') ||
		getTagValue(tags, 'Contract') ||
		getTagValue(tags, 'Token-Id') ||
		getTagValue(tags, 'Id') ||
		null
	);
}

// Helper function to try matching assets
function tryMatchAsset(assetId: string, dominantToken: string): boolean {
	// Try exact match first
	if (assetId === dominantToken) {
		return true;
	}

	// Try normalized versions (lowercase)
	if (assetId.toLowerCase() === dominantToken.toLowerCase()) {
		return true;
	}

	// Try prefix match
	if (assetId.startsWith(dominantToken) || dominantToken.startsWith(assetId)) {
		return true;
	}

	return false;
}

// Helper function to process listed orders
function processListedOrders(transactions: any[]): ProcessedOrder[] {
	if (DEBUG_MODE) {
		console.log('Processing listed orders:', transactions.length);
	}

	return transactions.map((tx) => {
		const tags = tx.tags || [];
		const orderId = getTagValue(tags, 'OrderId') || tx.id;
		const dominantToken = getTagValue(tags, 'DominantToken') || extractAssetId(tx);
		const swapToken = getTagValue(tags, 'SwapToken') || '';
		const price = parseInt(getTagValue(tags, 'Price') || '0', 10);
		const quantity = parseInt(getTagValue(tags, 'Quantity') || '0', 10);
		const sender = tx.owner?.address || '';
		const receiver = tx.recipient || '';
		const timestamp = tx.block?.timestamp || 0;

		return {
			id: tx.id,
			orderId,
			timestamp,
			type: 'LISTED',
			status: 'LISTED',
			price,
			quantity,
			dominantToken,
			swapToken,
			sender,
			receiver,
			isSender: true,
			isReceiver: false,
			isPurchase: false,
		};
	});
}

// Helper function to process cancelled orders
function processCancelledOrders(transactions: any[]): ProcessedOrder[] {
	if (DEBUG_MODE) {
		console.log('Processing cancelled orders:', transactions.length);
	}

	return transactions.map((tx) => {
		const tags = tx.tags || [];
		const orderId = getTagValue(tags, 'OrderId') || tx.id;
		const dominantToken = getTagValue(tags, 'DominantToken') || extractAssetId(tx);
		const swapToken = getTagValue(tags, 'SwapToken') || '';
		const price = parseInt(getTagValue(tags, 'Price') || '0', 10);
		const quantity = parseInt(getTagValue(tags, 'Quantity') || '0', 10);
		const sender = tx.owner?.address || '';
		const receiver = tx.recipient || '';
		const timestamp = tx.block?.timestamp || 0;

		return {
			id: tx.id,
			orderId,
			timestamp,
			type: 'CANCELLED',
			status: 'CANCELLED',
			price,
			quantity,
			dominantToken,
			swapToken,
			sender,
			receiver,
			isSender: true,
			isReceiver: false,
			isPurchase: false,
		};
	});
}

// Helper function to process executed orders
function processExecutedOrders(transactions: any[]): ProcessedOrder[] {
	if (DEBUG_MODE) {
		console.log('Processing executed orders:', transactions.length);
	}

	return transactions.map((tx) => {
		const tags = tx.tags || [];
		const orderId = getTagValue(tags, 'OrderId') || tx.id;
		const dominantToken = getTagValue(tags, 'DominantToken') || extractAssetId(tx);
		const swapToken = getTagValue(tags, 'SwapToken') || '';
		const price = parseInt(getTagValue(tags, 'Price') || '0', 10);
		const quantity = parseInt(getTagValue(tags, 'Quantity') || '0', 10);
		const sender = tx.owner?.address || '';
		const receiver = tx.recipient || '';
		const timestamp = tx.block?.timestamp || 0;
		const isPurchase = receiver === tx.owner?.address;

		return {
			id: tx.id,
			orderId,
			timestamp,
			type: isPurchase ? 'PURCHASED' : 'SOLD',
			status: 'EXECUTED',
			price,
			quantity,
			dominantToken,
			swapToken,
			sender,
			receiver,
			isSender: !isPurchase,
			isReceiver: isPurchase,
			isPurchase,
		};
	});
}

// Helper function to print sample transaction for debugging
function printSampleTransaction(transactions: any[], category: string) {
	if (!DEBUG_MODE) return;

	if (transactions.length > 0) {
		const sample = transactions[0];
		console.log(`\nSample ${category} transaction:`, {
			id: sample.id,
			sender: sample.owner?.address,
			recipient: sample.recipient,
			tags: sample.tags.map((t: any) => `${t.name}: ${t.value}`).join(', '),
		});
	}
}

function processDirectTransfers(transactions: any[], userAddress: string): ProcessedOrder[] {
	return transactions
		.map((tx) => {
			// Extract necessary data
			const tags = tx.tags || [];

			// Check if this is a marketplace transaction
			const hasMarketplaceTags = tags.some(
				(tag) =>
					(tag.name === 'Handler' && ['Create-Order', 'Cancel-Order'].includes(tag.value)) ||
					(tag.name === 'X-Order-Action' && ['Create-Order', 'Cancel-Order'].includes(tag.value))
			);

			if (hasMarketplaceTags) {
				return null; // Skip marketplace transactions
			}

			const dominantToken = getTagValue(tags, 'Token') || extractAssetId(tx);
			const quantity = parseInt(getTagValue(tags, 'Quantity') || '0', 10);
			const sender = tx.owner?.address || '';
			const receiver = tx.recipient || '';
			const isOutgoing = sender === userAddress;

			// Use type assertion to satisfy TypeScript
			const transferType = isOutgoing ? ('TRANSFER-OUT' as const) : ('TRANSFER-IN' as const);

			return {
				id: tx.id,
				orderId: tx.id,
				timestamp: tx.block?.timestamp || 0,
				type: transferType,
				status: 'EXECUTED',
				price: 0, // Direct transfers don't have a price
				quantity,
				dominantToken,
				swapToken: '',
				sender,
				receiver,
				isSender: isOutgoing,
				isReceiver: !isOutgoing,
				isPurchase: false,
				isDirectTransfer: true, // Flag to identify direct transfers
			};
		})
		.filter(Boolean) as ProcessedOrder[]; // Remove null entries and properly type the result
}

// Main function to get user activity
export async function getUserActivity(userAddress: string, startDate?: Date, endDate?: Date): Promise<UserActivity> {
	if (DEBUG_MODE) {
		console.log('Fetching activity for user:', userAddress);
	}

	// Fetch all types of orders in parallel
	const [listedResponse, listedAltResponse, cancelledResponse, executedResponse, directTransferResponse] =
		await Promise.all([
			executeQuery(GET_LISTED_ORDERS, { first: 100 }, userAddress),
			executeQuery(GET_LISTED_ORDERS_ALT, { first: 100 }, userAddress),
			executeQuery(GET_CANCELLED_ORDERS, { first: 100 }, userAddress),
			executeQuery(GET_PURCHASES, { first: 100 }, userAddress),
			executeQuery(GET_DIRECT_TRANSFERS, { first: 100 }, userAddress),
		]);

	// Process each type of order
	const listedOrders = processListedOrders(safelyProcessGraphQLResponse(listedResponse, 'listed orders'));
	const listedOrdersAlt = processListedOrders(
		safelyProcessGraphQLResponse(listedAltResponse, 'alternative listed orders')
	);
	const cancelledOrders = processCancelledOrders(safelyProcessGraphQLResponse(cancelledResponse, 'cancelled orders'));
	const executedOrders = processExecutedOrders(safelyProcessGraphQLResponse(executedResponse, 'executed orders'));

	// Combine listed orders from both queries, removing duplicates
	const combinedListedOrders = [...listedOrders];
	listedOrdersAlt.forEach((order) => {
		if (!combinedListedOrders.some((existing) => existing.orderId === order.orderId)) {
			combinedListedOrders.push(order);
		}
	});

	// Filter by date if specified
	const filterByDate = (orders: ProcessedOrder[]) => {
		if (!startDate && !endDate) return orders;
		return orders.filter((order) => {
			const orderDate = new Date(order.timestamp * 1000);
			if (startDate && orderDate < startDate) return false;
			if (endDate && orderDate > endDate) return false;
			return true;
		});
	};

	if (DEBUG_MODE) {
		console.log('Activity summary:', {
			listed: combinedListedOrders.length,
			cancelled: cancelledOrders.length,
			executed: executedOrders.length,
		});
	}

	// Process direct transfers
	const directTransfers = processDirectTransfers(
		safelyProcessGraphQLResponse(directTransferResponse, 'direct transfers'),
		userAddress
	);

	if (DEBUG_MODE) {
		console.log('Activity summary with direct transfers:', {
			listed: combinedListedOrders.length,
			cancelled: cancelledOrders.length,
			executed: executedOrders.length,
			directTransfers: directTransfers.length,
		});
	}

	return {
		listedOrders: filterByDate(combinedListedOrders),
		cancelledOrders: filterByDate(cancelledOrders),
		executedOrders: filterByDate(executedOrders),
		directTransfers: filterByDate(directTransfers),
	};
}
