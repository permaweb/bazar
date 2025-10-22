import React from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';

import { createOrder, createOrderbook } from '@permaweb/ucm';

import { messageResults, readHandler } from 'api';

import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { FormField } from 'components/atoms/FormField';
import { Slider } from 'components/atoms/Slider';
import TokenSelector from 'components/atoms/TokenSelector';
import { TxAddress } from 'components/atoms/TxAddress';
import { Panel } from 'components/molecules/Panel';
import { createDataItemSigner, message, result } from 'helpers/aoconnect';
import { AO, ASSETS, REDIRECTS, TOKEN_REGISTRY, URLS } from 'helpers/config';
import { AssetOrderType } from 'helpers/types';
import {
	checkValidAddress,
	formatAddress,
	formatCount,
	formatPercentage,
	getTotalTokenBalance,
	reverseDenomination,
} from 'helpers/utils';
import * as windowUtils from 'helpers/window';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { useTokenProvider } from 'providers/TokenProvider';
import * as streakActions from 'store/streaks/actions';

import * as S from './styles';
import { IProps } from './types';

const MIN_PRICE = 0.000001;

// Custom createOrder function with extended timeout for legacy assets
async function createOrderWithExtendedTimeout(
	deps: any,
	args: any,
	callback: (args: { processing: boolean; success: boolean; message: string }) => void,
	timeoutMs: number
): Promise<string> {
	// Import required modules
	const Permaweb = (await import('@permaweb/libs')).default;
	const { getTagValue } = await import('helpers/utils');

	// Import UCM utility functions - these are not exported from the main UCM package
	// We'll need to implement them locally or use alternatives
	const getTagValueForAction = (messages: any[], tagName: string, action: string, defaultValue: string): string => {
		for (const message of messages) {
			const actionTag = message.Tags.find((tag: any) => tag.name === 'Action' && tag.value === action);
			if (actionTag) {
				const messageTag = message.Tags.find((tag: any) => tag.name === tagName);
				if (messageTag) return messageTag.value;
			}
		}
		return defaultValue;
	};

	const globalLog = (...args: any[]) => {
		console.log('[@permaweb/ucm]', ...args);
	};

	// Calculate max attempts based on timeout (assuming 1 second delay between attempts)
	const maxAttempts = Math.floor(timeoutMs / 1000);
	// Legacy asset timeout configuration

	const permaweb = Permaweb.init(deps);

	try {
		const MESSAGE_GROUP_ID = Date.now().toString();

		const tags = [
			{ name: 'Target', value: args.dominantToken },
			{ name: 'ForwardTo', value: args.dominantToken },
			{ name: 'ForwardAction', value: 'Transfer' },
			{ name: 'Recipient', value: args.orderbookId },
			{ name: 'Quantity', value: args.quantity },
		];

		const forwardedTags = [
			{ name: 'X-Order-Action', value: 'Create-Order' },
			{ name: 'X-Dominant-Token', value: args.dominantToken },
			{ name: 'X-Swap-Token', value: args.swapToken },
			{ name: 'X-Group-ID', value: MESSAGE_GROUP_ID },
		];

		const data = { Target: args.dominantToken, Action: 'Transfer', Input: {} };

		if (args.unitPrice) forwardedTags.push({ name: 'X-Price', value: args.unitPrice.toString() });
		if (args.denomination) forwardedTags.push({ name: 'X-Transfer-Denomination', value: args.denomination.toString() });

		tags.push(...forwardedTags);

		globalLog('Processing order...');
		callback({ processing: true, success: false, message: 'Processing your order...' });

		// Send message ONCE - no retries to avoid multiple orders
		const transferId = await permaweb.sendMessage({
			processId: args.creatorId,
			action: args.action,
			tags: tags,
			data: data,
		});
		// Message sent successfully

		const successMatch = ['Order-Success'];
		const errorMatch = ['Order-Error'];

		// Use our custom getMatchingMessages with extended timeout
		const messagesByGroupId = await getMatchingMessagesWithExtendedTimeout(
			[args.orderbookId],
			MESSAGE_GROUP_ID,
			successMatch,
			errorMatch,
			deps,
			maxAttempts
		);

		const currentMatchActions = messagesByGroupId
			.map((message: any) => getTagValue(message.Tags, 'Action'))
			.filter((action): action is string => action !== null);

		const isSuccess = successMatch.every((action) => currentMatchActions.includes(action));
		const isError = errorMatch.every((action) => currentMatchActions.includes(action));

		if (isSuccess) {
			const successMessage = getTagValueForAction(messagesByGroupId, 'Message', 'Order-Success', 'Order created!');
			callback({ processing: false, success: true, message: successMessage });
		} else if (isError) {
			const errorMessage = getTagValueForAction(messagesByGroupId, 'Message', 'Order-Error', 'Order failed');
			callback({ processing: false, success: false, message: errorMessage });
		} else {
			throw new Error('Unexpected state: Order not fully processed.');
		}

		return getTagValueForAction(messagesByGroupId, 'OrderId', 'Order-Success', transferId);
	} catch (e: any) {
		// For legacy assets, if we hit the timeout, show a more helpful message
		if (e.message && e.message.includes('Failed to match actions within retry limit')) {
			callback({
				processing: false,
				success: false,
				message: 'Legacy asset order is processing. This can take up to 20 minutes. Please check your orders later.',
			});
			throw new Error(
				'Legacy asset order is processing. This can take up to 20 minutes. Please check your orders later.'
			);
		}
		throw new Error(e.message ?? 'Error creating order in UCM');
	}
}

// Custom getMatchingMessages with extended timeout
async function getMatchingMessagesWithExtendedTimeout(
	processes: string[],
	groupId: string,
	successMatch: string[],
	errorMatch: string[],
	deps: any,
	maxAttempts: number,
	delayMs: number = 1000
): Promise<any[]> {
	let currentMatchActions: string[] = [];
	let attempts = 0;

	function isMatch(currentMatchActions: string[], successMatch: string[], errorMatch: string[]): boolean {
		const currentSet = new Set(currentMatchActions);
		const successSet = new Set(successMatch);
		const errorSet = new Set(errorMatch);

		return (
			(successSet.size === currentSet.size && [...successSet].every((action) => currentSet.has(action))) ||
			(errorSet.size === currentSet.size && [...errorSet].every((action) => currentSet.has(action)))
		);
	}

	let messagesByGroupId = null;

	do {
		attempts++;

		try {
			messagesByGroupId = await getMessagesByGroupId(processes, groupId, deps);
		} catch (error) {
			// For network errors, just log and continue waiting - don't fail immediately
			// Network error on attempt, continuing to wait
			messagesByGroupId = []; // Set empty array to continue the loop
		}

		const { getTagValue } = await import('helpers/utils');
		currentMatchActions = messagesByGroupId
			.map((message: any) => getTagValue(message.Tags, 'Action'))
			.filter((action): action is string => action !== null);

		const globalLog = (...args: any[]) => {
			console.log('[@permaweb/ucm]', ...args);
		};
		globalLog(`Attempt ${attempts} for results...`);

		if (!isMatch(currentMatchActions, successMatch, errorMatch)) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	} while (!isMatch(currentMatchActions, successMatch, errorMatch) && attempts < maxAttempts);

	if (!isMatch(currentMatchActions, successMatch, errorMatch)) {
		throw new Error('Failed to match actions within retry limit.');
	}

	const globalLog = (...args: any[]) => {
		console.log('[@permaweb/ucm]', ...args);
	};
	for (const match of currentMatchActions) {
		globalLog('Match found:', match);
	}

	return messagesByGroupId;
}

// Helper function to get messages by group ID
async function getMessagesByGroupId(processes: string[], groupId: string, deps: any): Promise<any[]> {
	const { getTagValue } = await import('helpers/utils');

	const resultsByGroupId = [];
	for (const process of processes) {
		const messageResults = await deps.ao.results({
			process: process,
			sort: 'DESC',
			limit: 100,
		});

		if (messageResults?.edges?.length) {
			for (const result of messageResults.edges) {
				if (result.node?.Messages?.length) {
					for (const message of result.node.Messages) {
						const messageGroupId = getTagValue(message.Tags, 'X-Group-ID');
						if (messageGroupId === groupId) resultsByGroupId.push(message);
					}
				}
			}
		}
	}

	return resultsByGroupId;
}

export default function AssetActionMarketOrders(props: IProps) {
	const dispatch = useDispatch();

	const permawebProvider = usePermawebProvider();
	const arProvider = useArweaveProvider();
	const tokenProvider = useTokenProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	// Total quantity of asset
	const [totalAssetBalance, setTotalAssetBalance] = React.useState<number>(0);

	// Total quantity of asset for sale
	const [totalSalesQuantity, setTotalSalesQuantity] = React.useState<number>(0);

	// Total quantity of asset available to sell or transfer
	const [connectedBalance, setConnectedBalance] = React.useState<number>(0);
	const [connectedWalletBalance, setConnectedWalletBalance] = React.useState<number>(0);

	// Total asset quantity available for order creation, based on order type (buy, sell, or transfer)
	const [currentOrderQuantity, setCurrentOrderQuantity] = React.useState<string | number>('');

	// Total asset quantity available for order creation, based on order type (buy, sell, or transfer)
	const [maxOrderQuantity, setMaxOrderQuantity] = React.useState<number>(0);

	// The token transfer recipient if the action is only a transfer and not an order creation
	const [transferRecipient, setTransferRecipient] = React.useState<string>('');

	// The number of the token that should be treated as a single unit when quantities and balances are displayed
	const [denomination, setDenomination] = React.useState<number | null>(null);

	// The number of the transfer token that should be treated as a single unit when quantities and balances are displayed
	const [transferDenomination, setTransferDenomination] = React.useState<number | null>(null);

	// Price on limit orders for quantity of one transfer token
	const [unitPrice, setUnitPrice] = React.useState<string | number>('');

	const [orderLoading, setOrderLoading] = React.useState<boolean>(false);
	const [orderProcessed, setOrderProcessed] = React.useState<boolean>(false);
	const [orderSuccess, setOrderSuccess] = React.useState<boolean>(false);
	const [orderId, setOrderId] = React.useState<string | null>(null);
	const [showConfirmation, setShowConfirmation] = React.useState<boolean>(false);
	const [currentNotification, setCurrentNotification] = React.useState<string | null>(null);
	const [insufficientBalance, setInsufficientBalance] = React.useState<boolean>(false);

	React.useEffect(() => {
		if (props.asset) {
			if (props.asset.state) {
				if (props.asset.state.denomination) {
					if (!denomination && props.asset.state.denomination && Number(props.asset.state.denomination) > 1) {
						setDenomination(Math.pow(10, props.asset.state.denomination));
					}
				}

				if (props.asset.state.balances) {
					const balances: any = Object.keys(props.asset.state.balances).map((address: string) => {
						return Number(props.asset.state.balances[address]);
					});

					const totalBalance = balances.reduce((a: number, b: number) => a + b, 0);

					let calculatedTotalBalance = totalBalance;

					if (denomination) {
						calculatedTotalBalance = totalBalance / denomination;
					}

					setTotalAssetBalance(calculatedTotalBalance);

					if (arProvider.walletAddress && permawebProvider.profile && permawebProvider.profile.id) {
						const profileBalance = Number(props.asset.state.balances[permawebProvider.profile.id]);
						const walletBalance = Number(props.asset.state.balances[arProvider.walletAddress]);

						let calculatedOwnerBalance = profileBalance;
						let calculatedWalletBalance = walletBalance;

						if (denomination) {
							calculatedOwnerBalance = profileBalance / denomination;
							calculatedWalletBalance = walletBalance / denomination;
						}

						setConnectedBalance(calculatedOwnerBalance);
						setConnectedWalletBalance(calculatedWalletBalance);
					}
				}
			}

			if (props.asset.orderbook?.orders && props.asset.orderbook?.orders.length > 0) {
				const selectedTokenId = tokenProvider.selectedToken.id;

				// CRITICAL FIX: Only include orders that match the selected token
				const salesBalances = props.asset.orderbook?.orders
					.filter((order: AssetOrderType) => order.currency === selectedTokenId)
					.map((order: AssetOrderType) => {
						return Number(order.quantity);
					});

				const totalSalesBalance = salesBalances.reduce((a: number, b: number) => a + b, 0);

				let calculatedTotalSalesBalance = totalSalesBalance;

				if (denomination) calculatedTotalSalesBalance = totalSalesBalance / denomination;

				setTotalSalesQuantity(calculatedTotalSalesBalance);
			}

			// Use TOKEN_REGISTRY denominations instead of currenciesReducer

			// NOTE: transferDenomination is now set by dedicated effects based on selectedToken
			// This effect only handles asset-related state, not token denomination
		}
	}, [props.asset, arProvider.walletAddress, permawebProvider.profile, denomination, tokenProvider.selectedToken.id]);

	// Set initial transferDenomination based on current selected token
	React.useEffect(() => {
		if (tokenProvider.selectedToken && tokenProvider.selectedToken.id) {
			const tokenInfo = TOKEN_REGISTRY[tokenProvider.selectedToken.id];
			if (tokenInfo && tokenInfo.denomination && tokenInfo.denomination > 0) {
				const calculatedDenomination = Math.pow(10, tokenInfo.denomination);
				setTransferDenomination(calculatedDenomination);
			}
		}
	}, []); // Empty dependency array - runs only on initial load

	// Update transferDenomination when selected token changes (for sell orders)
	React.useEffect(() => {
		if (tokenProvider.selectedToken && tokenProvider.selectedToken.id) {
			const tokenInfo = TOKEN_REGISTRY[tokenProvider.selectedToken.id];
			if (tokenInfo && tokenInfo.denomination && tokenInfo.denomination > 0) {
				const calculatedDenomination = Math.pow(10, tokenInfo.denomination);
				setTransferDenomination(calculatedDenomination);
			}
		}
	}, [tokenProvider.selectedToken]);

	React.useEffect(() => {
		switch (props.type) {
			case 'buy':
				setMaxOrderQuantity(totalSalesQuantity);
				break;
			case 'sell':
			case 'transfer':
				let totalBalance = 0;
				if (connectedBalance) totalBalance += connectedBalance;
				if (connectedWalletBalance) totalBalance += connectedWalletBalance;
				setMaxOrderQuantity(totalBalance);
				break;
		}
	}, [props.asset, props.type, connectedBalance, connectedWalletBalance, totalSalesQuantity]);

	React.useEffect(() => {
		if (props.type === 'buy') {
			if (!permawebProvider.tokenBalances || !permawebProvider.tokenBalances[tokenProvider.selectedToken.id]) {
				setInsufficientBalance(true);
			} else {
				const totalAmount = getTotalOrderAmount();
				let orderAmount = isNaN(Number(totalAmount)) ? BigInt(0) : BigInt(totalAmount);
				if (denomination) {
					orderAmount = BigInt(orderAmount) / BigInt(denomination);
				}
				setInsufficientBalance(
					Number(getTotalTokenBalance(permawebProvider.tokenBalances[tokenProvider.selectedToken.id])) < orderAmount
				);
			}
		} else {
			setInsufficientBalance(false);
		}
	}, [
		permawebProvider.tokenBalances,
		props.type,
		props.asset,
		currentOrderQuantity,
		denomination,
		tokenProvider.selectedToken.id,
	]);

	React.useEffect(() => {
		if (currentOrderQuantity) setCurrentOrderQuantity('');
		if (unitPrice) setUnitPrice('');
	}, [props.type]);

	async function handleSubmit() {
		if (props.asset && arProvider.wallet && permawebProvider.profile?.id) {
			let currentOrderbook = props.asset.orderbook?.id;

			if (!currentOrderbook) {
				try {
					const args: any = { assetId: props.asset.data.id };
					if (props.asset.data.collectionId) args.collectionId = props.asset.data.collectionId;

					const newOrderbook = await createOrderbook(
						permawebProvider.deps,
						args,
						(args: { processing: boolean; success: boolean; message: string }) => {
							handleStatusUpdate(args.processing, !args.processing, args.success, args.message);
						}
					);

					currentOrderbook = newOrderbook;
				} catch (e: any) {
					console.error(e);
					return;
				}
			}

			try {
				handleStatusUpdate(true, false, false, 'Transferring balance from wallet to profile...');
				await handleWalletToProfileTransfer();
			} catch (e: any) {
				handleStatusUpdate(false, true, false, e);
			}

			if (props.type === 'transfer') {
				try {
					await handleTransfer();
				} catch (e: any) {
					handleStatusUpdate(false, true, false, e.message ?? 'Error executing transfer');
				}
				return;
			}

			const transferQuantity = getTransferQuantity().toString();
			const unitPrice = getUnitPrice()?.toString();

			let dominantToken = null;
			let swapToken = null;

			switch (props.type) {
				case 'buy':
					dominantToken = tokenProvider.selectedToken.id;
					swapToken = props.asset.data.id;
					break;
				case 'sell':
					dominantToken = props.asset.data.id;
					swapToken = tokenProvider.selectedToken.id;
					break;
				default:
					break;
			}

			try {
				let action = 'Run-Action';
				if (permawebProvider.profile.isLegacyProfile) action = 'Transfer';

				const data: any = {
					orderbookId: currentOrderbook,
					creatorId: permawebProvider.profile.id,
					dominantToken: dominantToken,
					swapToken: swapToken,
					quantity: transferQuantity,
					action: action,
				};

				if (unitPrice) data.unitPrice = unitPrice.toString();

				// UCM needs both asset and token denominations for proper order handling
				if (denomination && denomination > 1) {
					data.denomination = denomination.toString(); // Asset denomination
				}
				if (transferDenomination && transferDenomination > 1) {
					data.tokenDenomination = transferDenomination.toString(); // Token denomination
				}

				// Check if this is a legacy asset (using global orderbook)
				const isLegacyAsset = props.asset.orderbook?.id === AO.ucm;

				let orderId;
				if (isLegacyAsset) {
					// For legacy assets, show warning and use extended timeout
					// Using custom createOrderWithExtendedTimeout for legacy asset
					handleStatusUpdate(
						true,
						false,
						false,
						'Processing order for legacy asset (this may take up to 20 minutes)...'
					);

					// Create a custom createOrder with extended timeout for legacy assets
					orderId = await createOrderWithExtendedTimeout(
						permawebProvider.deps,
						data,
						(args: { processing: boolean; success: boolean; message: string }) => {
							handleStatusUpdate(args.processing, !args.processing, args.success, args.message);
						},
						20 * 60 * 1000 // 20 minutes timeout
					);
				} else {
					// Regular assets use normal timeout
					orderId = await createOrder(
						permawebProvider.deps,
						data,
						(args: { processing: boolean; success: boolean; message: string }) => {
							handleStatusUpdate(args.processing, !args.processing, args.success, args.message);
						}
					);
				}

				setOrderId(orderId);

				if (props.type === 'buy') {
					const streaks = await readHandler({
						processId: AO.pixl,
						action: 'Get-Streaks',
					});
					dispatch(streakActions.setStreaks(streaks.Streaks));
				}

				// Trigger asset and orderbook refresh to show the new order
				props.toggleUpdate();
				arProvider.setToggleProfileUpdate(!arProvider.toggleProfileUpdate);
				permawebProvider.setToggleTokenBalanceUpdate(!permawebProvider.toggleTokenBalanceUpdate);
			} catch (e: any) {
				handleStatusUpdate(false, true, false, e.message ?? 'Error creating order in UCM');
			}
		} else {
			handleStatusUpdate(false, true, false, 'Invalid order details');
		}
	}

	function getTransferQuantity() {
		let transferQuantity = currentOrderQuantity;

		switch (props.type) {
			case 'buy':
				const totalAmount = getTotalOrderAmount();
				transferQuantity = isNaN(Number(totalAmount)) ? '0' : totalAmount.toString();
				if (denomination) transferQuantity = (BigInt(transferQuantity) / BigInt(denomination)).toString();
				break;
			case 'sell':
			case 'transfer':
				if (denomination) transferQuantity = Math.floor(Number(currentOrderQuantity) * denomination);
				break;
		}

		return transferQuantity;
	}

	function getUnitPrice() {
		let calculatedUnitPrice = null;

		if (unitPrice && Number(unitPrice) > 0) {
			calculatedUnitPrice = unitPrice as any;
			if (transferDenomination) {
				const decimalPlaces = (unitPrice.toString().split('.')[1] || '').length;
				const updatedUnitPrice =
					decimalPlaces >= reverseDenomination(transferDenomination)
						? (unitPrice as any).toFixed(reverseDenomination(transferDenomination))
						: unitPrice;
				calculatedUnitPrice = BigInt(Math.floor(Number(updatedUnitPrice) * transferDenomination));
			}
		}

		return calculatedUnitPrice;
	}

	async function handleWalletToProfileTransfer() {
		try {
			let processId: string;
			let profileBalance: bigint = BigInt(0);
			let walletBalance: bigint = BigInt(0);

			const transferQuantity = getTransferQuantity();

			switch (props.type) {
				case 'buy':
					processId = tokenProvider.selectedToken.id;
					profileBalance = BigInt(permawebProvider.tokenBalances[tokenProvider.selectedToken.id].profileBalance);
					walletBalance = BigInt(permawebProvider.tokenBalances[tokenProvider.selectedToken.id].walletBalance);
					break;
				case 'sell':
				case 'transfer':
					processId = props.asset.data.id;

					if (connectedBalance)
						profileBalance = BigInt(denomination ? Math.floor(connectedBalance * denomination) : connectedBalance);
					if (connectedWalletBalance)
						walletBalance = BigInt(
							denomination ? Math.floor(connectedWalletBalance * denomination) : connectedWalletBalance
						);
					break;
			}

			if (profileBalance < BigInt(transferQuantity)) {
				const differenceNeeded = BigInt(transferQuantity) - profileBalance;

				if (walletBalance < differenceNeeded) {
					console.error(`Wallet balance is less than difference needed: ${differenceNeeded}`);
					console.error(`Wallet balance: ${walletBalance}`);
					throw new Error('Error making wallet to profile transfer');
				} else {
					// console.log(`Transferring remainder from wallet (${differenceNeeded.toString()}) to profile...`);
					await messageResults({
						processId: processId,
						action: 'Transfer',
						wallet: arProvider.wallet,
						tags: [
							{ name: 'Quantity', value: differenceNeeded.toString() },
							{ name: 'Recipient', value: permawebProvider.profile.id },
						],
						data: null,
						responses: ['Transfer-Success', 'Transfer-Error'],
					});
					// console.log('Transfer complete');
				}
			}
		} catch (e: any) {
			throw new Error(e.message ?? 'Error making wallet to profile transfer');
		}
	}

	async function handleTransfer() {
		if (transferRecipient && checkValidAddress(transferRecipient)) {
			try {
				// Use Run-Action for new Zone Profiles, Transfer for legacy profiles
				let tags = [];
				let data = null;

				if (permawebProvider.profile.isLegacyProfile) {
					// Legacy profile: use direct Transfer
					tags = [
						{ name: 'Action', value: 'Transfer' },
						{ name: 'Target', value: props.asset.data.id },
						{ name: 'Recipient', value: transferRecipient },
						{ name: 'Quantity', value: getTransferQuantity().toString() },
					];
				} else {
					// New Zone Profile: use Run-Action pattern
					tags = [
						{ name: 'Action', value: 'Run-Action' },
						{ name: 'ForwardTo', value: props.asset.data.id },
						{ name: 'ForwardAction', value: 'Transfer' },
						{ name: 'Recipient', value: transferRecipient },
						{ name: 'Quantity', value: getTransferQuantity().toString() },
					];
					// For Run-Action, we need to pass data in the expected format
					data = {
						Target: props.asset.data.id,
						Action: 'Transfer',
						Input: {
							Recipient: transferRecipient,
							Quantity: getTransferQuantity().toString(),
						},
					};
				}

				const transferId = await message({
					process: permawebProvider.profile.id,
					signer: createDataItemSigner(arProvider.wallet),
					tags: tags,
					data: data ? JSON.stringify(data) : null,
				});

				const { Error } = await result({
					process: permawebProvider.profile.id,
					message: transferId,
				});

				if (!Error) handleStatusUpdate(false, true, true, 'Balance transferred!');
				// console.log(transferId);
			} catch (e: any) {
				throw new Error(e);
			}
		}
	}

	function handleStatusUpdate(loading: boolean, processed: boolean, success: boolean, message: string) {
		setOrderLoading(loading);
		setOrderProcessed(processed);
		setOrderSuccess(success);
		setCurrentNotification(message);
	}

	function handleAssetUpdate() {
		if (orderSuccess) {
			props.toggleUpdate();
			setCurrentOrderQuantity('');
			setUnitPrice('');
			setTransferRecipient('');
			setOrderId(null);
			windowUtils.scrollTo(0, 0, 'smooth');
		}

		setCurrentNotification(null);
		setOrderProcessed(false);
		setShowConfirmation(false);
	}

	function handleOrderErrorClose() {
		setShowConfirmation(false);
		setOrderProcessed(false);
		setCurrentOrderQuantity('');
		setUnitPrice('');
		setTransferRecipient('');
		setCurrentNotification(null);
		windowUtils.scrollTo(0, 0, 'smooth');
	}

	function getTotalOrderAmount() {
		if (props.type === 'buy') {
			if (props.asset && props.asset.orderbook?.orders) {
				const selectedTokenId = tokenProvider.selectedToken.id;

				let sortedOrders = props.asset.orderbook?.orders
					.filter((order: AssetOrderType) => {
						const price = Number(order.price);
						const quantity = Number(order.quantity);
						// CRITICAL FIX: Only include orders that match the selected token
						return !isNaN(price) && !isNaN(quantity) && price > 0 && quantity > 0 && order.currency === selectedTokenId;
					})
					.sort((a: AssetOrderType, b: AssetOrderType) => Number(a.price) - Number(b.price));

				let totalQuantity: bigint = BigInt(0);
				let totalPrice: bigint = BigInt(0);

				for (let i = 0; i < sortedOrders.length; i++) {
					const orderQuantity = Number(sortedOrders[i].quantity);
					const orderPrice = Number(sortedOrders[i].price);

					// Skip orders with invalid quantity or price
					if (isNaN(orderQuantity) || isNaN(orderPrice) || orderQuantity <= 0 || orderPrice <= 0) {
						continue;
					}

					const quantity = BigInt(Math.floor(orderQuantity));
					const price = BigInt(Math.floor(orderPrice));

					let inputQuantity: any;
					inputQuantity = denomination
						? BigInt(Math.floor((currentOrderQuantity as number) * denomination))
						: BigInt(Math.floor(currentOrderQuantity as any));

					if (quantity >= inputQuantity - totalQuantity) {
						const remainingQty = inputQuantity - totalQuantity;

						totalQuantity += remainingQty;
						totalPrice += remainingQty * price;
						break;
					} else {
						totalQuantity += quantity;
						totalPrice += quantity * price;
					}
				}
				return totalPrice;
			} else return 0;
		} else if (props.type === 'sell') {
			// For SELL orders: Calculate the total amount of the receiving token in raw units
			let price: bigint = BigInt(0);
			if (
				isNaN(Number(unitPrice)) ||
				isNaN(Number(currentOrderQuantity)) ||
				Number(currentOrderQuantity) < 0 ||
				Number(unitPrice) < 0
			) {
				price = BigInt(0);
			} else {
				// Calculate the total amount of the receiving token in display units
				const totalDisplayAmount = Number(currentOrderQuantity) * Number(unitPrice);

				// Convert this total display amount to raw units using transferDenomination
				if (transferDenomination) {
					price = BigInt(Math.floor(totalDisplayAmount * transferDenomination));
				} else {
					price = BigInt(Math.floor(totalDisplayAmount));
				}
			}

			return price;
		} else {
			// This block now only handles 'transfer'
			let price: bigint = BigInt(0);
			if (
				isNaN(Number(unitPrice)) ||
				isNaN(Number(currentOrderQuantity)) ||
				Number(currentOrderQuantity) < 0 ||
				Number(unitPrice) < 0
			) {
				price = BigInt(0);
			} else {
				let calculatedUnitPrice = unitPrice as any;
				if (transferDenomination) {
					const decimalPlaces = (unitPrice.toString().split('.')[1] || '').length;
					const updatedUnitPrice =
						decimalPlaces >= reverseDenomination(transferDenomination)
							? (unitPrice as any).toFixed(reverseDenomination(transferDenomination))
							: unitPrice;

					calculatedUnitPrice = BigInt(
						Math.floor(Number(updatedUnitPrice <= MIN_PRICE ? 0 : updatedUnitPrice) * transferDenomination)
					);
				}

				let calculatedQuantity = currentOrderQuantity;
				if (denomination && denomination > 1) {
					calculatedQuantity = Number(currentOrderQuantity) * Number(denomination);
				}

				try {
					price =
						BigInt(calculatedQuantity) && BigInt(calculatedUnitPrice)
							? BigInt(calculatedQuantity) * BigInt(calculatedUnitPrice)
							: BigInt(0);
				} catch (e: any) {
					console.error(e);
					price = BigInt(0);
				}
			}

			return price;
		}
	}

	function handleQuantityInput(e: React.ChangeEvent<HTMLInputElement>) {
		if (e.target.value === '' || parseFloat(e.target.value) < 0) {
			setCurrentOrderQuantity('');
		} else {
			if (!isNaN(Number(e.target.value))) setCurrentOrderQuantity(parseFloat(e.target.value));
		}
	}

	function handleUnitPriceInput(e: React.ChangeEvent<HTMLInputElement>) {
		if (e.target.value === '') {
			setUnitPrice(NaN);
		} else {
			if (!isNaN(Number(e.target.value))) setUnitPrice(parseFloat(e.target.value));
		}
	}

	function handleRecipientInput(e: React.ChangeEvent<HTMLInputElement>) {
		setTransferRecipient(e.target.value);
	}

	function getActionDisabled() {
		if (!arProvider.walletAddress) return true;
		if (!permawebProvider.profile || !permawebProvider.profile.id) return true;
		if (orderLoading) return true;
		if (orderProcessed && !orderSuccess) return true;
		if (props.asset && !props.asset.state.transferable) return true;
		if (maxOrderQuantity <= 0 || isNaN(Number(currentOrderQuantity))) return true;
		if (
			Number(currentOrderQuantity) <= 0 ||
			isNaN(maxOrderQuantity) ||
			(!Number.isInteger(Number(currentOrderQuantity)) && !denomination)
		)
			return true;
		if (Number(currentOrderQuantity) > maxOrderQuantity) return true;
		if (props.type === 'sell' && (Number(unitPrice) <= 0 || Number(unitPrice) <= MIN_PRICE || isNaN(Number(unitPrice))))
			return true;
		if (props.type === 'transfer' && (!transferRecipient || !checkValidAddress(transferRecipient))) return true;
		if (insufficientBalance) return true;

		// For BUY orders: Check if there are existing orders to buy from
		// For SELL orders: Allow any token (creating new liquidity)
		if (props.type === 'buy') {
			const hasUCMOrders = props.asset?.orderbook?.orders && props.asset.orderbook.orders.length > 0;
			const selectedTokenId = tokenProvider.selectedToken.id;
			const hasMatchingOrders =
				hasUCMOrders &&
				props.asset.orderbook.orders.some((order: AssetOrderType) => order.currency === selectedTokenId);

			if (!hasMatchingOrders) {
				return true;
			}
		}
		// For sell orders, we don't restrict - users can create new liquidity

		return false;
	}

	const getTotals = React.useMemo(() => {
		let balanceHeader: string | null = null;
		let percentageHeader: string | null = null;

		let totalBalance = 0;
		let quantity: number | null = null;

		switch (props.type) {
			case 'buy':
				balanceHeader = language.totalSalesBalance;
				percentageHeader = language.totalSalesPercentage;
				quantity = totalSalesQuantity;
				break;
			case 'sell':
				balanceHeader = language.totalSalesBalanceAvailable;
				percentageHeader = language.totalSalesPercentageAvailable;
				totalBalance = 0;
				if (connectedBalance) totalBalance += connectedBalance;
				if (connectedWalletBalance) totalBalance += connectedWalletBalance;
				quantity = totalBalance;
				break;
			case 'transfer':
				balanceHeader = language.totalTransferBalanceAvailable;
				percentageHeader = language.totalTransferPercentageAvailable;
				totalBalance = 0;
				if (connectedBalance) totalBalance += connectedBalance;
				if (connectedWalletBalance) totalBalance += connectedWalletBalance;
				quantity = totalBalance;
				break;
		}

		return (
			<>
				<S.TotalQuantityLine>
					<p>{balanceHeader}</p>
					<span>{formatCount(quantity.toString())}</span>
				</S.TotalQuantityLine>
				<S.TotalQuantityLine>
					<p>{percentageHeader}</p>
					<span>{formatPercentage(!isNaN(quantity / totalAssetBalance) ? quantity / totalAssetBalance : 0)}</span>
				</S.TotalQuantityLine>
			</>
		);
	}, [props.asset, props.type, totalAssetBalance, totalSalesQuantity, connectedBalance]);

	function getTotalPriceDisplay() {
		const selectedTokenId = tokenProvider.selectedToken.id;

		if (props.type === 'buy') {
			// For BUY orders: Check if there are existing orders to buy from
			const hasUCMOrders = props.asset?.orderbook?.orders && props.asset.orderbook.orders.length > 0;
			const hasMatchingOrders =
				hasUCMOrders &&
				props.asset.orderbook.orders.some((order: AssetOrderType) => order.currency === selectedTokenId);

			if (!hasMatchingOrders) {
				return (
					<S.MessageWrapper warning>
						<span>No orders available to buy with {tokenProvider.selectedToken.symbol}</span>
					</S.MessageWrapper>
				);
			}
		} else if (props.type === 'sell') {
			// For SELL orders: Allow any token (creating new liquidity)
		}

		// UCM works with raw units - send raw amount to CurrencyLine
		const totalAmount = getTotalOrderAmount();
		const amount = isNaN(Number(totalAmount)) ? BigInt(0) : BigInt(totalAmount);
		const orderCurrency = selectedTokenId;

		return (
			<CurrencyLine
				amount={amount ? amount.toString() : '0'}
				currency={orderCurrency}
				tokenLogo={tokenProvider.selectedToken.logo}
				tokenSymbol={tokenProvider.selectedToken.symbol}
			/>
		);
	}

	function getOrderDetails(useWrapper: boolean) {
		let quantityLabel: string | null = null;
		let percentageLabel: string | null = null;

		switch (props.type) {
			case 'buy':
				quantityLabel = language.totalPurchaseQuantity;
				percentageLabel = language.totalPurchasePercentage;
				break;
			case 'sell':
				quantityLabel = language.totalListingQuantity;
				percentageLabel = language.totalListingPercentage;
				break;
			case 'transfer':
				quantityLabel = language.totalTransferQuantity;
				percentageLabel = language.totalTransferPercentage;
				break;
		}

		return (
			<S.SalesWrapper useWrapper={useWrapper} className={useWrapper ? 'border-wrapper-alt1' : ''}>
				<S.SalesLine>
					<S.SalesDetail>
						<span>{quantityLabel}</span>
						<p>{formatCount(currentOrderQuantity.toString())}</p>
					</S.SalesDetail>
					<S.SalesDetail>
						<span>{percentageLabel}</span>
						<p>
							{formatPercentage(
								!isNaN(Number(currentOrderQuantity) / totalAssetBalance)
									? Number(currentOrderQuantity) / totalAssetBalance
									: 0
							)}
						</p>
					</S.SalesDetail>
				</S.SalesLine>
				{props.type !== 'transfer' && (
					<S.SalesLine>
						<S.SalesDetail>
							<span>{language.totalPrice}</span>
							{getTotalPriceDisplay()}
						</S.SalesDetail>
					</S.SalesLine>
				)}
				{props.type === 'transfer' && (
					<S.SalesLine>
						<S.SalesDetail>
							<span>{language.recipient}</span>
							<p>{transferRecipient ? formatAddress(transferRecipient, true) : '-'}</p>
						</S.SalesDetail>
					</S.SalesLine>
				)}
			</S.SalesWrapper>
		);
	}

	function getAction(finalizeOrder: boolean) {
		let label: string | null = null;
		let icon: string | null = null;

		switch (props.type) {
			case 'buy':
				label = finalizeOrder ? language.confirmPurchase : language.buy;
				icon = ASSETS.buy;
				break;
			case 'sell':
				label = finalizeOrder ? language.confirmListing : language.sell;
				icon = ASSETS.sell;
				break;
			case 'transfer':
				label = finalizeOrder ? language.confirmTransfer : language.transfer;
				icon = ASSETS.transfer;
				break;
		}
		if (orderLoading) label = finalizeOrder ? `${language.executing}...` : label;
		if (orderProcessed) {
			if (orderSuccess) label = language.done;
			else label = language.error;
		}

		let action: () => void;
		if (orderProcessed) {
			if (orderSuccess) action = () => handleAssetUpdate();
			else action = () => setShowConfirmation(false);
		} else if (finalizeOrder) action = () => handleSubmit();
		else action = () => setShowConfirmation(true);

		return (
			<>
				<Button
					type={orderProcessed ? 'primary' : 'alt1'}
					label={label}
					handlePress={action}
					disabled={getActionDisabled()}
					loading={false}
					height={60}
					fullWidth={!finalizeOrder}
					icon={icon}
					iconLeftAlign
				/>
			</>
		);
	}

	function getOrderWindow() {
		let header: string | null = null;
		let confirmationHeader: string | null = null;
		let reviewMessage: string | null = null;

		let footer: React.ReactNode | null = null;

		switch (props.type) {
			case 'buy':
				header = language.confirmPurchase;
				confirmationHeader = language.orderConfirmationDetailsPurchase;
				reviewMessage = language.orderConfirmationReviewPurchase;
				break;
			case 'sell':
				header = language.confirmListing;
				confirmationHeader = language.orderConfirmationDetailsListing;
				reviewMessage = language.orderConfirmationReviewListing;
				footer = (
					<p>
						· {language.sellerFee}{' '}
						<Link to={URLS.docs} target={'_blank'}>
							{language.learnMore}
						</Link>
					</p>
				);
				break;
			case 'transfer':
				header = language.confirmTransfer;
				reviewMessage = language.orderConfirmationReviewTransfer;
				break;
		}

		function handleClose() {
			if (orderProcessed && orderSuccess) {
				handleAssetUpdate();
				return;
			}
			if (orderProcessed) {
				handleOrderErrorClose();
				return;
			}
			setShowConfirmation(false);
		}

		return (
			<Panel
				open={true}
				width={525}
				header={header}
				handleClose={handleClose}
				closeHandlerDisabled={orderLoading || orderProcessed}
			>
				<S.ConfirmationWrapper className={'modal-wrapper'}>
					<S.ConfirmationHeader>
						<p>{props.asset.data.title}</p>
					</S.ConfirmationHeader>
					{getOrderDetails(true)}
					{props.type !== 'transfer' && (
						<S.ConfirmationDetails className={'border-wrapper-primary'}>
							<S.ConfirmationDetailsHeader>
								<p>{confirmationHeader}</p>
							</S.ConfirmationDetailsHeader>
							<S.ConfirmationDetailsLineWrapper>
								{orderId ? (
									<S.ConfirmationDetailsFlex>
										<S.ConfirmationDetailsLine>
											<p id={'id-line'}>{`${language.orderId}: `}</p>
											<TxAddress address={orderId} wrap={false} />
										</S.ConfirmationDetailsLine>
										<Button
											type={'alt1'}
											label={language.view}
											handlePress={() => window.open(REDIRECTS.explorer(orderId), '_blank')}
											height={27.5}
										/>
									</S.ConfirmationDetailsFlex>
								) : (
									<p>{language.orderConfirmationInfo}</p>
								)}
							</S.ConfirmationDetailsLineWrapper>
						</S.ConfirmationDetails>
					)}
					{footer && <S.ConfirmationFooter className={'border-wrapper-primary'}>{footer}</S.ConfirmationFooter>}
					<S.ConfirmationMessage success={orderProcessed && orderSuccess} warning={orderProcessed && !orderSuccess}>
						<span>{currentNotification ? currentNotification : orderLoading ? 'Processing...' : reviewMessage}</span>
					</S.ConfirmationMessage>
					{/* Show warning for legacy assets during processing or when there's an error */}
					{((orderLoading && props.asset.orderbook?.id === AO.ucm) ||
						(orderProcessed && !orderSuccess && props.asset.orderbook?.id === AO.ucm)) && (
						<S.MessageWrapper warning>
							<span>
								Assets built during legacynet may take longer to clear on-chain now that we've switched to micro
								orderbooks.
							</span>
						</S.MessageWrapper>
					)}
					<S.Divider />
					<S.ActionWrapperFull loading={orderLoading.toString()}>{getAction(true)}</S.ActionWrapperFull>
				</S.ConfirmationWrapper>
			</Panel>
		);
	}

	return props.asset ? (
		<>
			<S.Wrapper>
				{getOrderDetails(false)}
				<S.InputWrapper>
					<Slider
						value={parseFloat(Number(currentOrderQuantity).toString())}
						maxValue={maxOrderQuantity}
						handleChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuantityInput(e)}
						label={language.assetQuantityInfo}
						disabled={
							!arProvider.walletAddress ||
							!permawebProvider.profile ||
							!permawebProvider.profile.id ||
							maxOrderQuantity <= 0 ||
							orderLoading
						}
						invalid={{
							status: Number(currentOrderQuantity) < 0 || Number(currentOrderQuantity) > maxOrderQuantity,
							message: null,
						}}
						useFractional={denomination !== null}
					/>
					<S.MaxQty>
						<Button
							type={'primary'}
							label={language.max}
							handlePress={() => setCurrentOrderQuantity(maxOrderQuantity)}
							disabled={
								!arProvider.walletAddress ||
								!permawebProvider.profile ||
								!permawebProvider.profile.id ||
								maxOrderQuantity <= 0
							}
							noMinWidth
						/>
					</S.MaxQty>
					<S.FieldsFlexWrapper>
						<S.TotalsWrapper>
							<S.TotalQuantityLine>
								<p>{`${language.totalAssetBalance}`}</p>
								<span>{formatCount(totalAssetBalance.toString())}</span>
							</S.TotalQuantityLine>
							{getTotals}
						</S.TotalsWrapper>
						<S.FieldsWrapper>
							<S.FieldWrapper>
								<FormField
									type={'number'}
									step={'1'}
									value={isNaN(Number(currentOrderQuantity)) ? '' : currentOrderQuantity}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuantityInput(e)}
									label={`${language.assetQuantity} (${language.max}: ${formatCount(maxOrderQuantity.toString())})`}
									disabled={
										!arProvider.walletAddress ||
										!permawebProvider.profile ||
										!permawebProvider.profile.id ||
										maxOrderQuantity <= 0 ||
										orderLoading
									}
									invalid={{
										status:
											Number(currentOrderQuantity) < 0 ||
											Number(currentOrderQuantity) > maxOrderQuantity ||
											(!Number.isInteger(Number(currentOrderQuantity)) && !denomination),
										message: null,
									}}
									hideErrorMessage
								/>
							</S.FieldWrapper>
							{props.type === 'sell' && (
								<S.FieldWrapper>
									<FormField
										type={'number'}
										label={language.unitPrice}
										value={isNaN(Number(unitPrice)) ? '' : unitPrice}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUnitPriceInput(e)}
										disabled={
											!arProvider.walletAddress ||
											!permawebProvider.profile ||
											!permawebProvider.profile.id ||
											Number(currentOrderQuantity) <= 0 ||
											orderLoading
										}
										invalid={{
											status: Number(unitPrice) < 0 || (unitPrice && Number(unitPrice) <= MIN_PRICE),
											message: null,
										}}
										hideErrorMessage
										tooltip={language.saleUnitPriceTooltip}
									/>
								</S.FieldWrapper>
							)}
							{props.type === 'sell' && (
								<S.FieldWrapper>
									<TokenSelector showLabel={true} />
								</S.FieldWrapper>
							)}
							{props.type === 'buy' && (
								<S.FieldWrapper>
									<TokenSelector showLabel={true} />
								</S.FieldWrapper>
							)}
							{props.type === 'transfer' && (
								<S.FieldWrapper>
									<FormField
										label={language.recipient}
										value={transferRecipient || ''}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRecipientInput(e)}
										disabled={
											!arProvider.walletAddress ||
											!permawebProvider.profile ||
											!permawebProvider.profile.id ||
											orderLoading
										}
										invalid={{ status: transferRecipient && !checkValidAddress(transferRecipient), message: null }}
										hideErrorMessage
									/>
								</S.FieldWrapper>
							)}
							<S.ActionWrapper loading={null}>
								{getAction(false)}
								{!arProvider.walletAddress && (
									<S.MessageWrapper>
										<span>{language.connectToContinue}</span>
									</S.MessageWrapper>
								)}
								{!permawebProvider.profile ||
									(!permawebProvider.profile.id && (
										<S.MessageWrapper>
											<span>{language.createProfileToContinue}</span>
										</S.MessageWrapper>
									))}
								{permawebProvider.tokenBalances &&
									getTotalTokenBalance(permawebProvider.tokenBalances[tokenProvider.selectedToken.id]) !== null &&
									insufficientBalance && (
										<S.MessageWrapper warning>
											<span>{language.insufficientBalance}</span>
										</S.MessageWrapper>
									)}
								{arProvider.wallet &&
									permawebProvider.profile?.id &&
									getTotalTokenBalance(permawebProvider.tokenBalances[tokenProvider.selectedToken.id]) === null && (
										<S.MessageWrapper>
											<span>{`${language.fetchingTokenbalances}...`}</span>
										</S.MessageWrapper>
									)}
								{!Number.isInteger(Number(currentOrderQuantity)) && !denomination && (
									<S.MessageWrapper warning>
										<span>{language.quantityMustBeInteger}</span>
									</S.MessageWrapper>
								)}
								{props.type === 'sell' && Number(unitPrice) > 0 && Number(unitPrice) <= MIN_PRICE && (
									<S.MessageWrapper warning>
										<span>{language.priceTooLow}</span>
									</S.MessageWrapper>
								)}
								{props.asset && !props.asset.state.transferable && (
									<S.MessageWrapper warning>
										<span>{language.nonTransferable}</span>
									</S.MessageWrapper>
								)}
							</S.ActionWrapper>
						</S.FieldsWrapper>
					</S.FieldsFlexWrapper>
				</S.InputWrapper>
			</S.Wrapper>
			{showConfirmation && getOrderWindow()}
		</>
	) : null;
}
