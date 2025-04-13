import { getGQLData } from 'api';

// Constants
const ARWEAVE_GATEWAY_URL = 'https://arweave.net/graphql';
const DEBUG_MODE = true; // Enable debug mode to help troubleshoot
const UCM_ORDERBOOK_ADDRESS = 'fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY';

// Helper function to execute GraphQL queries with enhanced logging
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

		console.log('🚀 Executing GraphQL query:', {
			query: modifiedQuery,
			variables: formattedVariables,
			userAddress,
		});

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
			console.error('❌ GraphQL request failed:', {
				status: response.status,
				statusText: response.statusText,
			});
			throw new Error(`GraphQL request failed with status ${response.status}`);
		}

		const data = await response.json();

		if (data.errors) {
			console.error('❌ GraphQL errors:', data.errors);
			return { data: { transactions: { edges: [] } } };
		}

		console.log('✅ GraphQL response:', {
			transactionCount: data?.data?.transactions?.edges?.length || 0,
			sampledTransaction: data?.data?.transactions?.edges?.[0]?.node || null,
		});

		return data;
	} catch (error) {
		console.error('❌ Error executing GraphQL query:', error);
		return { data: { transactions: { edges: [] } } };
	}
}

// Helper function to safely process GraphQL response with enhanced logging
function safelyProcessGraphQLResponse(response: any, type: string): any[] {
	console.log(`🔍 Processing ${type} response:`, {
		hasData: !!response?.data,
		hasTransactions: !!response?.data?.transactions,
		edgeCount: response?.data?.transactions?.edges?.length || 0,
	});

	if (!response?.data?.transactions?.edges) {
		console.warn(`⚠️ No ${type} found in response:`, response);
		return [];
	}

	const transactions = response.data.transactions.edges.map((edge: any) => edge.node).filter(Boolean);

	console.log(`✅ Processed ${transactions.length} ${type} transactions`);
	if (transactions.length > 0) {
		console.log('📝 Sample transaction:', {
			id: transactions[0].id,
			tags: transactions[0].tags,
			owner: transactions[0].owner,
			recipient: transactions[0].recipient,
		});
	}

	return transactions;
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

// Query strings for activity
const TRANSACTIONS_PER_PAGE = 500; // Increased from 100
const MAX_PAGES = 10; // This will give us up to 5000 transactions

// Add cursor to queries for pagination
const GET_LISTED_ORDERS = `
  query GetListedOrders($first: Int!, $after: String) {
    transactions(
      first: $first,
      after: $after,
      owners: [$address],
      tags: [
        { name: "Data-Protocol", values: ["ao"] },
        { name: "X-Order-Action", values: ["Create-Order"] }
      ]
    ) {
      edges {
        cursor
        node {
          ${ACTIVITY_TRANSACTION_FIELDS}
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

const GET_EXECUTED_ORDERS = `
  query GetExecutedOrders($first: Int!) {
    transactions(
      first: $first,
      tags: [
        { name: "Data-Protocol", values: ["ao"] },
        { name: "Action", values: ["Transfer"] }
      ]
    ) {
      edges {
        node {
          ${ACTIVITY_TRANSACTION_FIELDS}
        }
      }
    }
  }
`;

const GET_CANCELLED_ORDERS = `
  query GetCancelledOrders($first: Int!, $after: String) {
    transactions(
      first: $first,
      after: $after,
      owners: [$address],
      tags: [
        { name: "Data-Protocol", values: ["ao"] },
        { name: "Handler", values: ["Cancel-Order"] }
      ]
    ) {
      edges {
        cursor
        node {
          ${ACTIVITY_TRANSACTION_FIELDS}
        }
      }
      pageInfo {
        hasNextPage
    }
  }
`;

// Helper function to extract asset ID from transaction
function extractAssetId(tx: any): string | null {
	const tags = tx.tags || [];
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

// Update the GET_PURCHASES query
const GET_PURCHASES = `
  query GetPurchases($first: Int!) {
    transactions(
      first: $first,
      recipients: [$address],
      tags: [
        { name: "Action", values: ["Transfer", "Transfer-Success"] },
        { name: "Data-Protocol", values: ["ao"] }
      ]
    ) {
      edges {
        node {
          ${ACTIVITY_TRANSACTION_FIELDS}
        }
      }
    }
  }
`;

// Update the GET_PURCHASES_ALT query
const GET_PURCHASES_ALT = `
  query GetPurchasesAlt($first: Int!) {
    transactions(
      first: $first,
      recipients: [$address],
      tags: [
        { name: "Type", values: ["Message"] },
        { name: "Action", values: ["Transfer"] },
        { name: "Data-Protocol", values: ["ao"] }
      ]
    ) {
      edges {
        node {
          ${ACTIVITY_TRANSACTION_FIELDS}
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
        { name: "Action", values: ["Debit-Notice", "Transfer-Success"] }
      ]
    ) {
      edges {
        node {
          ${ACTIVITY_TRANSACTION_FIELDS}
        }
      }
    }
  }
`;

const GET_SALES_WITH_X_SELLER = `
  query GetSalesWithXSeller($first: Int!) {
    transactions(
      first: $first,
      owners: [$address],
      tags: [
        { name: "Data-Protocol", values: ["ao"] }
        { name: "X-Seller", values: ["*"] }
      ]
    ) {
      edges {
        node {
          ${ACTIVITY_TRANSACTION_FIELDS}
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
        { name: "Data-Protocol", values: ["ao"] },
        { name: "Action", values: ["Transfer"] }
      ],
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

// New queries for micro orderbooks
const GET_MICRO_LISTED_ORDERS = `
  query GetMicroListedOrders($first: Int!) {
    transactions(
      first: $first,
      owners: [$address],
      tags: [
        { name: "Data-Protocol", values: ["ao"] }
        { name: "Type", values: ["Message"] }
        { name: "Handler", values: ["Create-Order"] }
        { name: "Variant", values: ["ao.TN.1"] }
      ]
    ) {
      edges {
        node {
          ${ACTIVITY_TRANSACTION_FIELDS}
        }
      }
    }
  }
`;

const GET_MICRO_CANCELLED_ORDERS = `
  query GetMicroCancelledOrders($first: Int!) {
    transactions(
      first: $first,
      owners: [$address],
      tags: [
        { name: "Data-Protocol", values: ["ao"] }
        { name: "Type", values: ["Message"] }
        { name: "Handler", values: ["Cancel-Order"] }
        { name: "Variant", values: ["ao.TN.1"] }
      ]
    ) {
      edges {
        node {
          ${ACTIVITY_TRANSACTION_FIELDS}
        }
      }
    }
  }
`;

const GET_MICRO_PURCHASES = `
  query GetMicroPurchases($first: Int!) {
    transactions(
      first: $first,
      recipients: [$address],
      tags: [
        { name: "Data-Protocol", values: ["ao"] }
        { name: "Type", values: ["Message"] }
        { name: "Action", values: ["Transfer", "Transfer-Success", "Credit-Notice"] }
        { name: "Variant", values: ["ao.TN.1"] }
      ]
    ) {
      edges {
        node {
          ${ACTIVITY_TRANSACTION_FIELDS}
        }
      }
    }
  }
`;

const GET_MICRO_SALES = `
  query GetMicroSales($first: Int!) {
    transactions(
      first: $first,
      owners: [$address],
      tags: [
        { name: "Data-Protocol", values: ["ao"] }
        { name: "Type", values: ["Message"] }
        { name: "Action", values: ["Transfer", "Transfer-Success", "Debit-Notice"] }
        { name: "Variant", values: ["ao.TN.1"] }
      ]
    ) {
      edges {
        node {
          ${ACTIVITY_TRANSACTION_FIELDS}
        }
      }
    }
  }
`;

const GET_WALLET_TRANSFERS = `
  query GetWalletTransfers($first: Int!) {
    transactions(
      first: $first,
      tags: [
        { name: "Action", values: ["Transfer"] }
        { name: "Data-Protocol", values: ["ao"] }
      ],
      owners: [$address]
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
	TransactionType?: 'WALLET_TRANSFER' | 'UCM_LISTING' | 'UCM_UNLISTING' | 'DIRECT_TRANSFER';
	RelatedTxs?: string[];
	originalQuantity: string | number;
	originalPrice: string | number;
}

// Helper function to get tag value with debug logging
function getTagValue(tags: any[], name: string): string | null {
	if (!Array.isArray(tags)) {
		if (DEBUG_MODE) {
			console.warn('Invalid tags array:', tags);
		}
		return null;
	}

	const tag = tags.find((t) => t.name === name);
	if (DEBUG_MODE && tag) {
		console.log(`Found tag ${name}:`, tag.value);
	}
	return tag ? tag.value : null;
}

// Helper function to get unique transaction key
function getTransactionKey(tx: any): string {
	const tags = tx.tags || [];
	const dominantToken = getTagValue(tags, 'Target') || getTagValue(tags, 'Asset-Id');
	const timestamp = tx.block?.timestamp || Date.now() / 1000;
	// Round timestamp to nearest minute to catch near-simultaneous transactions
	const roundedTimestamp = Math.floor(timestamp / 60) * 60;
	return `${dominantToken}_${roundedTimestamp}`;
}

// Helper function to identify transaction type
function identifyTransactionType(tx: any, userAddress: string, userProfileId?: string): string {
	const tags = tx.tags || [];
	const action = getTagValue(tags, 'Action');
	const handler = getTagValue(tags, 'Handler');

	// Get the correct sender (ao profile) and receiver
	const fromProcess = getTagValue(tags, 'From-Process');
	const sender = fromProcess || getTagValue(tags, 'From') || tx.owner?.address;
	const recipient = getTagValue(tags, 'Recipient') || tx.recipient;

	// Log for debugging
	console.log('Transaction identification:', {
		id: tx.id,
		action,
		handler,
		fromProcess,
		sender,
		recipient,
		userAddress,
		userProfileId,
	});

	// Check if transaction involves UCM orderbook
	const isUCMTransaction = recipient === UCM_ORDERBOOK_ADDRESS || sender === UCM_ORDERBOOK_ADDRESS;

	// Check if user is sender using ao profile ID first
	const userIsSender = [userProfileId, fromProcess, userAddress].includes(sender);
	const userIsReceiver = [userProfileId, fromProcess, userAddress].includes(recipient);

	if (isUCMTransaction) {
		if (userIsSender && recipient === UCM_ORDERBOOK_ADDRESS) {
			return 'LISTED';
		}
		if (userIsReceiver && sender === UCM_ORDERBOOK_ADDRESS) {
			return handler === 'Cancel-Order' ? 'CANCELLED' : 'PURCHASED';
		}
	}

	// For non-UCM transactions
	return userIsReceiver ? 'TRANSFER-IN' : 'TRANSFER-OUT';
}

// Helper function to get the correct sender/receiver
function getSenderReceiver(tx: any): { sender: string; receiver: string } {
	const tags = tx.tags || [];

	// Try to get the ao profile ID first
	const sender = getTagValue(tags, 'From-Process') || getTagValue(tags, 'From') || tx.owner?.address || '';

	const receiver = getTagValue(tags, 'Recipient') || tx.recipient || '';

	return { sender, receiver };
}

// Helper function to process timestamp
function processTimestamp(timestamp: any): number {
	if (!timestamp) return Date.now() / 1000;

	const parsed = parseInt(timestamp, 10);
	// Check if timestamp is in milliseconds (13 digits) and convert to seconds if needed
	if (parsed > 1e12) {
		return Math.floor(parsed / 1000);
	}
	// If timestamp is too small (before 2020), use current time
	if (parsed < 1577836800) {
		// 2020-01-01
		return Date.now() / 1000;
	}
	return parsed;
}

// Helper function to convert token amounts based on denomination
function convertTokenAmount(amount: string | number, tokenType: string): number {
	if (!amount) return 0;

	const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
	if (isNaN(numericAmount)) return 0;

	// All tokens use 12 decimal places
	const convertedAmount = numericAmount / 1e12;

	// Format the number to avoid scientific notation and limit decimal places
	return parseFloat(convertedAmount.toFixed(12));
}

// Process listed orders
function processListedOrders(transactions: any[]): ProcessedOrder[] {
	return transactions
		.map((tx) => {
			try {
				const tags = tx.tags || [];
				const timestamp = tx.block?.timestamp || Math.floor(Date.now() / 1000);
				const dominantToken = getTagValue(tags, 'Target') || getTagValue(tags, 'Asset-Id');
				const swapToken = getTagValue(tags, 'X-Swap-Token') || 'AR';
				const quantity = getTagValue(tags, 'Quantity');
				const price = getTagValue(tags, 'X-Price');

				// Get the actual sender (your ao profile)
				const sender = getTagValue(tags, 'From') || tx.owner?.address;
				// For listings, recipient should be UCM
				const recipient = getTagValue(tags, 'Recipient') || tx.recipient;

				if (!dominantToken || !quantity) {
					console.warn('Missing required fields:', { dominantToken, quantity, tx });
					return null;
				}

				const convertedQuantity = convertTokenAmount(quantity, dominantToken);
				const convertedPrice = price ? convertTokenAmount(price, swapToken) : 0;

				// Check if this is a transfer to UCM (listing)
				const isListing = recipient?.includes('UCM');

				return {
					id: tx.id,
					orderId: tx.id,
					timestamp,
					type: isListing ? 'LISTED' : 'TRANSFER',
					status: isListing ? 'LISTED' : 'EXECUTED',
					price: convertedPrice,
					quantity: convertedQuantity,
					dominantToken,
					swapToken,
					sender,
					receiver: recipient,
					isSender: true,
					isReceiver: false,
					isPurchase: false,
					originalQuantity: quantity,
					originalPrice: price,
				};
			} catch (e) {
				console.error('Error processing listed order:', e);
				return null;
			}
		})
		.filter(Boolean) as ProcessedOrder[];
}

// Process executed orders
function processExecutedOrders(transactions: any[], userAddress: string, userProfileId?: string): ProcessedOrder[] {
	return transactions
		.map((tx) => {
			try {
				const tags = tx.tags || [];
				const timestamp = tx.block?.timestamp || Math.floor(Date.now() / 1000);
				const dominantToken = extractAssetId(tx);
				const swapToken = getTagValue(tags, 'X-Swap-Token') || 'AR';
				const quantity = getTagValue(tags, 'Quantity');
				const price = getTagValue(tags, 'X-Price');

				// Prioritize ao profile ID for sender
				const fromProcess = getTagValue(tags, 'From-Process');
				const sender = fromProcess || getTagValue(tags, 'From') || tx.owner?.address;
				const recipient = getTagValue(tags, 'Recipient') || tx.recipient;

				if (!dominantToken || !quantity) {
					console.warn('Missing required fields:', { dominantToken, quantity, tx });
					return null;
				}

				const convertedQuantity = convertTokenAmount(quantity, dominantToken);
				const convertedPrice = price ? convertTokenAmount(price, swapToken) : 0;

				// Determine transaction type
				const type = identifyTransactionType(tx, userAddress, userProfileId);

				// Skip if type is unknown
				if (type === 'UNKNOWN') return null;

				// Determine if this is a direct transfer
				const isDirectTransfer = type === 'TRANSFER-IN' || type === 'TRANSFER-OUT';
				// Add appropriate transaction type
				const transactionType = isDirectTransfer ? 'DIRECT_TRANSFER' : undefined;

				return {
					id: tx.id,
					orderId: tx.id,
					timestamp,
					type,
					status: 'EXECUTED',
					price: convertedPrice,
					quantity: convertedQuantity,
					dominantToken,
					swapToken,
					sender, // This will now be the ao profile ID when available
					receiver: recipient,
					isSender: [userProfileId, fromProcess, userAddress].includes(sender),
					isReceiver: [userProfileId, fromProcess, userAddress].includes(recipient),
					isPurchase: type === 'PURCHASED',
					isDirectTransfer,
					originalQuantity: quantity,
					originalPrice: price,
				};
			} catch (e) {
				console.error('Error processing executed order:', e);
				return null;
			}
		})
		.filter(Boolean) as ProcessedOrder[];
}

// Process cancelled orders
function processCancelledOrders(transactions: any[]): ProcessedOrder[] {
	return transactions
		.map((transaction) => {
			try {
				const timestamp = transaction.block?.timestamp || Math.floor(Date.now() / 1000);
				const orderId = transaction.id;
				const dominantToken = getTagValue(transaction.tags, 'Target');
				const swapToken = getTagValue(transaction.tags, 'X-Swap-Token') || 'AR';
				const quantity = getTagValue(transaction.tags, 'Quantity');
				const price = getTagValue(transaction.tags, 'X-Price');
				const denomination = getTagValue(transaction.tags, 'X-Transfer-Denomination');
				const sender = transaction.owner?.address || '';

				if (!dominantToken || !quantity) {
					if (DEBUG_MODE) {
						console.warn('Missing required fields:', { dominantToken, quantity, transaction });
					}
					return null;
				}

				// Convert quantity based on denomination
				const convertedQuantity = denomination ? convertTokenAmount(quantity, denomination) : parseFloat(quantity);

				// Convert price if present
				const convertedPrice = price ? convertTokenAmount(price, swapToken) : 0;

				return {
					id: transaction.id,
					orderId,
					timestamp,
					type: 'CANCELLED' as const,
					status: 'CANCELLED' as const,
					price: convertedPrice,
					quantity: convertedQuantity,
					dominantToken,
					swapToken,
					sender,
					receiver: '',
					isSender: true,
					isReceiver: false,
					isPurchase: false,
					originalQuantity: quantity,
					originalPrice: price,
				};
			} catch (e) {
				console.error('Error processing cancelled order:', e);
				return null;
			}
		})
		.filter(Boolean) as ProcessedOrder[];
}

// Process direct transfers
function processDirectTransfers(transactions: any[], userAddress: string): ProcessedOrder[] {
	return transactions
		.map((tx) => {
			try {
				const timestamp = tx.block?.timestamp || Math.floor(Date.now() / 1000);
				const dominantToken = getTagValue(tx.tags, 'Target') || getTagValue(tx.tags, 'Asset-Id');
				const quantity = getTagValue(tx.tags, 'Quantity');
				const sender = tx.owner?.address || '';
				const recipient = getTagValue(tx.tags, 'Recipient') || tx.recipient || '';

				if (!dominantToken || !quantity) {
					if (DEBUG_MODE) {
						console.warn('Missing required fields:', { dominantToken, quantity, tx });
					}
					return null;
				}

				const isIncoming = recipient === userAddress;
				const convertedQuantity = convertTokenAmount(quantity, dominantToken);

				return {
					id: tx.id,
					orderId: tx.id,
					timestamp,
					type: isIncoming ? 'TRANSFER-IN' : 'TRANSFER-OUT',
					status: 'EXECUTED',
					price: 0,
					quantity: convertedQuantity,
					dominantToken,
					swapToken: '',
					sender,
					receiver: recipient,
					isSender: sender === userAddress,
					isReceiver: isIncoming,
					isPurchase: false,
					isDirectTransfer: true,
					originalQuantity: quantity,
					originalPrice: '0',
				};
			} catch (e) {
				console.error('Error processing direct transfer:', e);
				return null;
			}
		})
		.filter(Boolean) as ProcessedOrder[];
}

// Print sample transaction for debugging
function printSampleTransaction(transactions: any[], category: string) {
	if (transactions.length > 0) {
		console.log(`Sample ${category} transaction:`, transactions[0]);
		console.log('Tags:', transactions[0].tags);
	} else {
		console.log(`No ${category} transactions found`);
	}
}

// Helper function to deduplicate transactions by ID
function deduplicateTransactions(transactions: any[]): any[] {
	const seen = new Set();
	return transactions.filter((tx) => {
		const duplicate = seen.has(tx.OrderId);
		seen.add(tx.OrderId);
		return !duplicate;
	});
}

// Helper function to determine if a transaction is a transfer
function isTransferTransaction(tx: any): boolean {
	const action = tx.tags?.find((tag: any) => tag.name === 'Action')?.value;
	return (
		action === 'Transfer' &&
		!tx.tags?.find(
			(tag: any) => tag.name === 'Handler' && (tag.value === 'Create-Order' || tag.value === 'Cancel-Order')
		)
	);
}

// Helper function to group related transfers
function groupRelatedTransfers(transfers: any[]): any[] {
	const groups = new Map();

	transfers.forEach((tx) => {
		// Only group transactions if they share the same:
		// 1. Asset (DominantToken)
		// 2. Transaction type
		// 3. Sender and receiver
		// 4. Occur within the same minute
		const timestamp = parseInt(tx.Timestamp);
		const key = `${tx.DominantToken}_${tx.TransactionType}_${tx.Sender}_${tx.Receiver}_${Math.floor(timestamp / 60)}`;

		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key).push(tx);
	});

	return Array.from(groups.values()).map((group) => {
		if (group.length === 1) return group[0];

		// Only combine if there are actually related transactions
		const firstTx = group[0];
		const totalQuantity = group.reduce((sum: number, tx: any) => sum + parseFloat(tx.Quantity || '0'), 0);

		if (DEBUG_MODE) {
			console.log('Grouping transactions:', {
				dominantToken: firstTx.DominantToken,
				type: firstTx.TransactionType,
				count: group.length,
				totalQuantity,
			});
		}

		return {
			...firstTx,
			RelatedTxs: group.slice(1).map((tx: any) => tx.OrderId),
			Quantity: totalQuantity.toString(),
		};
	});
}

// Main function to get user activity
export async function getUserActivity(
	userAddress: string,
	userProfileId?: string,
	startDate?: Date,
	endDate?: Date
): Promise<any> {
	if (!userAddress) {
		console.error('❌ No user address provided');
		return {
			ListedOrders: [],
			CancelledOrders: [],
			ExecutedOrders: [],
			DirectTransfers: [],
		};
	}

	console.log('🔍 Fetching activity for user:', userAddress);

	// Execute all queries in parallel
	const [listedResponse, purchasesResponse, purchasesAltResponse, cancelledResponse] = await Promise.allSettled([
		executeQuery(GET_LISTED_ORDERS, { first: 100 }, userAddress),
		executeQuery(GET_PURCHASES, { first: 100 }, userAddress),
		executeQuery(GET_PURCHASES_ALT, { first: 100 }, userAddress),
		executeQuery(GET_CANCELLED_ORDERS, { first: 100 }, userAddress),
	]);

	// Process responses
	const processResponse = (response: PromiseSettledResult<any>, type: string) => {
		if (response.status === 'rejected') {
			console.error(`❌ Error fetching ${type}:`, response.reason);
			return [];
		}
		return safelyProcessGraphQLResponse(response.value, type);
	};

	// Process listed orders
	const listedOrders = processResponse(listedResponse, 'listed').map((tx) => {
		const tags = tx.tags || [];
		// Get the ao profile ID for sender
		const fromProcess = getTagValue(tags, 'From-Process');
		const sender = fromProcess || getTagValue(tags, 'From') || tx.owner?.address;

		return {
			id: tx.id,
			orderId: tx.id,
			timestamp: tx.block?.timestamp || Date.now() / 1000,
			type: 'LISTED',
			status: 'LISTED',
			price: getTagValue(tags, 'X-Price') || '0',
			quantity: getTagValue(tags, 'Quantity') || '0',
			dominantToken: getTagValue(tags, 'Target') || getTagValue(tags, 'Asset-Id'),
			swapToken: getTagValue(tags, 'X-Swap-Token') || 'AR',
			sender, // Use the ao profile ID when available
			receiver: getTagValue(tags, 'Recipient') || tx.recipient || '',
			isSender: [userProfileId, fromProcess, userAddress].includes(sender),
			isReceiver: false,
			isPurchase: false,
		};
	});

	// Process purchases from both queries
	const purchases = processResponse(purchasesResponse, 'purchases');
	const purchasesAlt = processResponse(purchasesAltResponse, 'purchases-alt');

	// Combine purchases, removing duplicates
	const combinedPurchases = [...purchases];
	purchasesAlt.forEach((tx) => {
		if (!combinedPurchases.some((existing) => existing.id === tx.id)) {
			combinedPurchases.push(tx);
		}
	});

	// Process executed orders
	const executedOrders = combinedPurchases
		.map((tx) => {
			const tags = tx.tags || [];
			const type = identifyTransactionType(tx, userAddress, userProfileId);

			// Skip unknown transactions
			if (type === 'UNKNOWN') return null;

			// Get the ao profile ID for sender
			const fromProcess = getTagValue(tags, 'From-Process');
			const sender = fromProcess || getTagValue(tags, 'From') || tx.owner?.address;

			return {
				id: tx.id,
				orderId: tx.id,
				timestamp: tx.block?.timestamp || Date.now() / 1000,
				type,
				status: 'EXECUTED',
				price: getTagValue(tags, 'X-Price') || '0',
				quantity: getTagValue(tags, 'Quantity') || '0',
				dominantToken: getTagValue(tags, 'Target') || getTagValue(tags, 'Asset-Id'),
				swapToken: getTagValue(tags, 'X-Swap-Token') || 'AR',
				sender, // Use the ao profile ID when available
				receiver: getTagValue(tags, 'Recipient') || tx.recipient || '',
				isSender: [userProfileId, fromProcess, userAddress].includes(sender),
				isReceiver: [userProfileId, fromProcess, userAddress].includes(
					getTagValue(tags, 'Recipient') || tx.recipient || ''
				),
				isPurchase: type === 'PURCHASED',
				isDirectTransfer: type === 'TRANSFER-IN' || type === 'TRANSFER-OUT',
				TransactionType: type === 'TRANSFER-IN' || type === 'TRANSFER-OUT' ? 'DIRECT_TRANSFER' : undefined,
			};
		})
		.filter(Boolean);

	// Process cancelled orders
	const cancelledOrders = processResponse(cancelledResponse, 'cancelled').map((tx) => {
		const tags = tx.tags || [];
		// Get the ao profile ID for sender
		const fromProcess = getTagValue(tags, 'From-Process');
		const sender = fromProcess || getTagValue(tags, 'From') || tx.owner?.address;

		return {
			id: tx.id,
			orderId: tx.id,
			timestamp: tx.block?.timestamp || Date.now() / 1000,
			type: 'CANCELLED',
			status: 'CANCELLED',
			price: getTagValue(tags, 'X-Price') || '0',
			quantity: getTagValue(tags, 'Quantity') || '0',
			dominantToken: getTagValue(tags, 'Target') || getTagValue(tags, 'Asset-Id'),
			swapToken: getTagValue(tags, 'X-Swap-Token') || 'AR',
			sender, // Use the ao profile ID when available
			receiver: getTagValue(tags, 'Recipient') || tx.recipient || '',
			isSender: [userProfileId, fromProcess, userAddress].includes(sender),
			isReceiver: false,
			isPurchase: false,
		};
	});

	// Format and filter by date
	const formatAndFilter = (orders: any[]) => {
		return orders
			.filter((order) => {
				if (!startDate && !endDate) return true;
				const orderDate = new Date(order.timestamp * 1000);
				if (startDate && orderDate < startDate) return false;
				if (endDate && orderDate > endDate) return false;
				return true;
			})
			.map((order) => ({
				...order,
				OrderId: order.orderId,
				DominantToken: order.dominantToken,
				SwapToken: order.swapToken,
				Price: order.price,
				Quantity: order.quantity,
				Sender: order.sender,
				Receiver: order.receiver,
				Timestamp: Math.floor(order.timestamp).toString(),
				Type: order.type,
			}));
	};

	const result = {
		ListedOrders: formatAndFilter(listedOrders),
		ExecutedOrders: formatAndFilter(executedOrders),
		CancelledOrders: formatAndFilter(cancelledOrders),
		DirectTransfers: [],
	};

	console.log('📊 Activity Summary:', {
		Listed: result.ListedOrders.length,
		Executed: result.ExecutedOrders.length,
		Cancelled: result.CancelledOrders.length,
		'Regular Purchases': purchases.length,
		'Alt Purchases': purchasesAlt.length,
	});

	return result;
}
