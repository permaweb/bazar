import { getAssetById } from 'api/assets';

export interface RoyaltyInfo {
	hasRoyalties: boolean;
	royaltyPercentage: number;
	creatorAddress: string;
}

export interface RoyaltySplit {
	creatorAmount: number;
	sellerAmount: number;
	totalAmount: number;
	royaltyPercentage: number;
}

export interface RoyaltyTransaction {
	id: string;
	assetId: string;
	saleTransactionId: string;
	creatorAddress: string;
	sellerAddress: string;
	buyerAddress: string;
	totalAmount: number;
	royaltyAmount: number;
	royaltyPercentage: number;
	timestamp: number;
	status: 'pending' | 'completed' | 'failed';
}

/**
 * Get royalty information for an asset
 */
export async function getAssetRoyaltyInfo(assetId: string, libs: any): Promise<RoyaltyInfo | null> {
	try {
		const asset = await getAssetById({ id: assetId, libs });

		if (!asset || !asset.state?.metadata) {
			return null;
		}

		const metadata = asset.state.metadata;

		if (metadata.HasRoyalties && metadata.RoyaltyPercentage) {
			return {
				hasRoyalties: true,
				royaltyPercentage: metadata.RoyaltyPercentage,
				creatorAddress: asset.data.creator,
			};
		}

		return null;
	} catch (error) {
		console.error('Error fetching asset royalty info:', error);
		return null;
	}
}

/**
 * Calculate royalty split for a sale
 */
export function calculateRoyaltySplit(totalAmount: number, royaltyInfo: RoyaltyInfo | null): RoyaltySplit {
	if (!royaltyInfo || !royaltyInfo.hasRoyalties) {
		return {
			creatorAmount: 0,
			sellerAmount: totalAmount,
			totalAmount,
			royaltyPercentage: 0,
		};
	}

	const creatorAmount = (totalAmount * royaltyInfo.royaltyPercentage) / 100;
	const sellerAmount = totalAmount - creatorAmount;

	return {
		creatorAmount: Math.floor(creatorAmount), // Round down to avoid fractional tokens
		sellerAmount: Math.floor(sellerAmount),
		totalAmount,
		royaltyPercentage: royaltyInfo.royaltyPercentage,
	};
}

/**
 * Process royalty payment for a sale
 */
export async function processRoyaltyPayment(
	assetId: string,
	saleTransactionId: string,
	royaltySplit: RoyaltySplit,
	creatorAddress: string,
	sellerAddress: string,
	buyerAddress: string,
	libs: any
): Promise<RoyaltyTransaction> {
	const transaction: RoyaltyTransaction = {
		id: `${saleTransactionId}-royalty-${Date.now()}`,
		assetId,
		saleTransactionId,
		creatorAddress,
		sellerAddress,
		buyerAddress,
		totalAmount: royaltySplit.totalAmount,
		royaltyAmount: royaltySplit.creatorAmount,
		royaltyPercentage: royaltySplit.royaltyPercentage,
		timestamp: Date.now(),
		status: 'pending',
	};

	try {
		// If there's a royalty to pay, send it to the creator
		if (royaltySplit.creatorAmount > 0) {
			// Send royalty payment to creator
			await libs.sendMessage({
				processId: creatorAddress,
				action: 'Royalty-Payment',
				data: {
					assetId,
					amount: royaltySplit.creatorAmount,
					saleTransactionId,
					buyerAddress,
					sellerAddress,
				},
			});

			transaction.status = 'completed';
		} else {
			transaction.status = 'completed';
		}

		// Record the transaction (in a real implementation, this would go to a database)
		console.log('Royalty transaction processed:', transaction);

		return transaction;
	} catch (error) {
		console.error('Error processing royalty payment:', error);
		transaction.status = 'failed';
		throw error;
	}
}

/**
 * Enhanced order creation with royalty support
 */
export async function createOrderWithRoyalties(
	originalCreateOrder: Function,
	deps: any,
	orderData: any,
	callback: (args: { processing: boolean; success: boolean; message: string }) => void
): Promise<string> {
	// Check if this is a sell order (we only need royalties for sales)
	if (orderData.dominantToken !== 'PIXL' && orderData.swapToken === 'PIXL') {
		// This is a sell order - check for royalties
		const royaltyInfo = await getAssetRoyaltyInfo(orderData.dominantToken, deps.libs);

		if (royaltyInfo && royaltyInfo.hasRoyalties) {
			// Calculate the total sale amount
			const totalAmount = Number(orderData.quantity) * Number(orderData.unitPrice || 1);
			const royaltySplit = calculateRoyaltySplit(totalAmount, royaltyInfo);

			// Update callback to show royalty information
			callback({
				processing: true,
				success: false,
				message: `Processing sale with ${royaltySplit.royaltyPercentage}% royalty (${royaltySplit.creatorAmount} to creator)`,
			});

			// Create the original order (this goes to UCM)
			const orderId = await originalCreateOrder(deps, orderData, callback);

			// Process royalty payment after order is created
			try {
				await processRoyaltyPayment(
					orderData.dominantToken,
					orderId,
					royaltySplit,
					royaltyInfo.creatorAddress,
					orderData.creatorId, // seller
					orderData.creatorId, // buyer (this would need to be the actual buyer)
					deps.libs
				);

				callback({
					processing: false,
					success: true,
					message: `Sale completed! ${royaltySplit.royaltyPercentage}% royalty sent to creator.`,
				});
			} catch (error) {
				console.error('Royalty payment failed:', error);
				// Order was created successfully, but royalty payment failed
				callback({
					processing: false,
					success: true,
					message: `Sale completed, but royalty payment failed. Please contact support.`,
				});
			}

			return orderId;
		}
	}

	// No royalties or not a sell order - proceed normally
	return await originalCreateOrder(deps, orderData, callback);
}

/**
 * Get royalty statistics for an asset
 */
export async function getAssetRoyaltyStats(assetId: string): Promise<{
	totalRoyaltiesPaid: number;
	totalSales: number;
	averageRoyaltyPercentage: number;
}> {
	// This would typically query a database
	// For now, return mock data
	return {
		totalRoyaltiesPaid: 0,
		totalSales: 0,
		averageRoyaltyPercentage: 0,
	};
}

/**
 * Get creator's royalty earnings
 */
export async function getCreatorRoyaltyEarnings(creatorAddress: string): Promise<{
	totalEarnings: number;
	totalAssets: number;
	recentTransactions: RoyaltyTransaction[];
}> {
	// This would typically query a database
	// For now, return mock data
	return {
		totalEarnings: 0,
		totalAssets: 0,
		recentTransactions: [],
	};
}
