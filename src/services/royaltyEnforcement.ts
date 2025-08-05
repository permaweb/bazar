import { createOrder } from '@permaweb/ucm';

import { getAssetById } from 'api/assets';

import { calculateRoyaltySplit, RoyaltyInfo } from './royaltyService';

export interface RoyaltyEnforcementResult {
	success: boolean;
	orderId?: string;
	royaltyPaid?: number;
	creatorAddress?: string;
	error?: string;
}

/**
 * Enhanced order creation with royalty enforcement
 * This intercepts the order creation process and handles royalty payments
 */
export async function createOrderWithRoyaltyEnforcement(
	deps: any,
	orderData: any,
	callback: (args: { processing: boolean; success: boolean; message: string }) => void
): Promise<RoyaltyEnforcementResult> {
	try {
		// Check if this is a sell order (we only need royalties for sales)
		if (orderData.dominantToken !== 'PIXL' && orderData.swapToken === 'PIXL') {
			// This is a sell order - check for royalties
			const asset = await getAssetById({ id: orderData.dominantToken, libs: deps.libs });

			if (asset?.state?.metadata?.HasRoyalties) {
				const royaltyInfo: RoyaltyInfo = {
					hasRoyalties: true,
					royaltyPercentage: asset.state.metadata.RoyaltyPercentage,
					creatorAddress: asset.data.creator,
				};

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
				const orderId = await createOrder(deps, orderData, callback);

				// Process royalty payment after order is created
				if (royaltySplit.creatorAmount > 0) {
					try {
						// Send royalty payment to creator
						await deps.libs.sendMessage({
							processId: royaltyInfo.creatorAddress,
							action: 'Royalty-Payment',
							data: {
								assetId: orderData.dominantToken,
								amount: royaltySplit.creatorAmount,
								saleTransactionId: orderId,
								buyerAddress: orderData.creatorId, // This would be the actual buyer
								sellerAddress: orderData.creatorId, // This is the seller
								royaltyPercentage: royaltySplit.royaltyPercentage,
							},
						});

						callback({
							processing: false,
							success: true,
							message: `Sale completed! ${royaltySplit.royaltyPercentage}% royalty (${royaltySplit.creatorAmount} PIXL) sent to creator.`,
						});

						return {
							success: true,
							orderId,
							royaltyPaid: royaltySplit.creatorAmount,
							creatorAddress: royaltyInfo.creatorAddress,
						};
					} catch (error) {
						console.error('Royalty payment failed:', error);
						// Order was created successfully, but royalty payment failed
						callback({
							processing: false,
							success: true,
							message: `Sale completed, but royalty payment failed. Please contact support.`,
						});

						return {
							success: true,
							orderId,
							error: 'Royalty payment failed',
						};
					}
				} else {
					callback({
						processing: false,
						success: true,
						message: `Sale completed! No royalty payment required.`,
					});

					return {
						success: true,
						orderId,
					};
				}
			}
		}

		// No royalties or not a sell order - proceed normally
		const orderId = await createOrder(deps, orderData, callback);
		return {
			success: true,
			orderId,
		};
	} catch (error: any) {
		console.error('Order creation with royalties failed:', error);
		return {
			success: false,
			error: error.message || 'Order creation failed',
		};
	}
}

/**
 * Alternative approach: Pre-calculate and adjust order amounts
 * This modifies the order to account for royalties before sending to UCM
 */
export async function createOrderWithRoyaltyAdjustment(
	deps: any,
	orderData: any,
	callback: (args: { processing: boolean; success: boolean; message: string }) => void
): Promise<RoyaltyEnforcementResult> {
	try {
		// Check if this is a sell order
		if (orderData.dominantToken !== 'PIXL' && orderData.swapToken === 'PIXL') {
			const asset = await getAssetById({ id: orderData.dominantToken, libs: deps.libs });

			if (asset?.state?.metadata?.HasRoyalties) {
				const royaltyInfo: RoyaltyInfo = {
					hasRoyalties: true,
					royaltyPercentage: asset.state.metadata.RoyaltyPercentage,
					creatorAddress: asset.data.creator,
				};

				// Calculate royalty split
				const totalAmount = Number(orderData.quantity) * Number(orderData.unitPrice || 1);
				const royaltySplit = calculateRoyaltySplit(totalAmount, royaltyInfo);

				callback({
					processing: true,
					success: false,
					message: `Adjusting order for ${royaltySplit.royaltyPercentage}% royalty...`,
				});

				// Adjust the order quantity to account for royalties
				// The seller will receive less, but the royalty is handled separately
				const adjustedQuantity = Math.floor(Number(orderData.quantity) * (1 - royaltySplit.royaltyPercentage / 100));

				// Create modified order data
				const adjustedOrderData = {
					...orderData,
					quantity: adjustedQuantity.toString(),
					royaltyInfo: {
						originalQuantity: orderData.quantity,
						royaltyAmount: royaltySplit.creatorAmount,
						creatorAddress: royaltyInfo.creatorAddress,
					},
				};

				// Create the order with adjusted quantity
				const orderId = await createOrder(deps, adjustedOrderData, callback);

				// Send royalty payment separately
				if (royaltySplit.creatorAmount > 0) {
					await deps.libs.sendMessage({
						processId: royaltyInfo.creatorAddress,
						action: 'Royalty-Payment',
						data: {
							assetId: orderData.dominantToken,
							amount: royaltySplit.creatorAmount,
							saleTransactionId: orderId,
							royaltyPercentage: royaltySplit.royaltyPercentage,
						},
					});
				}

				callback({
					processing: false,
					success: true,
					message: `Order created with ${royaltySplit.royaltyPercentage}% royalty adjustment.`,
				});

				return {
					success: true,
					orderId,
					royaltyPaid: royaltySplit.creatorAmount,
					creatorAddress: royaltyInfo.creatorAddress,
				};
			}
		}

		// No royalties - proceed normally
		const orderId = await createOrder(deps, orderData, callback);
		return {
			success: true,
			orderId,
		};
	} catch (error: any) {
		console.error('Order creation with royalty adjustment failed:', error);
		return {
			success: false,
			error: error.message || 'Order creation failed',
		};
	}
}

/**
 * Record royalty transaction for tracking
 */
export async function recordRoyaltyTransaction(
	assetId: string,
	saleTransactionId: string,
	royaltyAmount: number,
	creatorAddress: string,
	sellerAddress: string,
	buyerAddress: string,
	royaltyPercentage: number
): Promise<void> {
	// This would typically save to a database
	// For now, we'll log it
	console.log('Royalty Transaction Recorded:', {
		assetId,
		saleTransactionId,
		royaltyAmount,
		creatorAddress,
		sellerAddress,
		buyerAddress,
		royaltyPercentage,
		timestamp: Date.now(),
	});
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
