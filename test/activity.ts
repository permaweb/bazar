// Types
export interface UserActivity {
	listedOrders: ProcessedOrder[];
	cancelledOrders: ProcessedOrder[];
	executedOrders: ProcessedOrder[];
	directTransfers: ProcessedOrder[];
}

export interface ProcessedOrder {
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

// Mock implementation for testing
export async function getUserActivity(
	userAddress: string,
	startDate?: Date,
	endDate?: Date,
	simulateNetworkError: boolean = false
): Promise<UserActivity> {
	// Input validation
	if (!userAddress) {
		throw new Error('User address is required');
	}

	if (userAddress === 'invalid_address_format') {
		throw new Error('Invalid address format');
	}

	// Simulate network error if requested
	if (simulateNetworkError) {
		throw new Error('Network error: Failed to connect to Arweave gateway');
	}

	// Create base timestamp for consistent testing
	const baseTimestamp = new Date('2023-06-01').getTime();

	// Create mock data with proper typing
	const mockData: UserActivity = {
		listedOrders: [
			{
				id: 'tx_listed_1',
				orderId: 'order_1',
				timestamp: baseTimestamp,
				type: 'LISTED' as const,
				status: 'LISTED' as const,
				price: 0.5,
				quantity: 1,
				dominantToken: 'U_TOKEN',
				swapToken: 'AR',
				sender: userAddress,
				receiver: '',
				isSender: true,
				isReceiver: false,
				isPurchase: false,
			},
		],
		cancelledOrders: [
			{
				id: 'tx_cancelled_1',
				orderId: 'order_2',
				timestamp: baseTimestamp + 86400000, // One day later
				type: 'CANCELLED' as const,
				status: 'CANCELLED' as const,
				price: 1.2,
				quantity: 2,
				dominantToken: 'U_TOKEN',
				swapToken: 'AR',
				sender: userAddress,
				receiver: '',
				isSender: true,
				isReceiver: false,
				isPurchase: false,
			},
		],
		executedOrders: [
			{
				id: 'tx_executed_1',
				orderId: 'order_3',
				timestamp: baseTimestamp + 172800000, // Two days later
				type: 'PURCHASED' as const,
				status: 'EXECUTED' as const,
				price: 0.8,
				quantity: 1,
				dominantToken: 'U_TOKEN',
				swapToken: 'AR',
				sender: 'other_address',
				receiver: userAddress,
				isSender: false,
				isReceiver: true,
				isPurchase: true,
			},
		],
		directTransfers: [
			{
				id: 'tx_transfer_1',
				orderId: 'transfer_1',
				timestamp: baseTimestamp + 259200000, // Three days later
				type: 'TRANSFER-IN' as const,
				status: 'EXECUTED' as const,
				price: 0,
				quantity: 5,
				dominantToken: 'U_TOKEN',
				swapToken: '',
				sender: 'other_address',
				receiver: userAddress,
				isSender: false,
				isReceiver: true,
				isPurchase: false,
				isDirectTransfer: true,
			},
		],
	};

	// Apply date filtering if provided
	if (startDate || endDate) {
		const filterData = (orders: ProcessedOrder[]) => {
			return orders.filter((order) => {
				const orderDate = new Date(order.timestamp);
				if (startDate && orderDate < startDate) return false;
				if (endDate && orderDate > endDate) return false;
				return true;
			});
		};

		return {
			listedOrders: filterData(mockData.listedOrders),
			cancelledOrders: filterData(mockData.cancelledOrders),
			executedOrders: filterData(mockData.executedOrders),
			directTransfers: filterData(mockData.directTransfers),
		};
	}

	return mockData;
}
