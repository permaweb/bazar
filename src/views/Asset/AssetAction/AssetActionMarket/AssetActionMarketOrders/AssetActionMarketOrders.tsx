import React from 'react';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { createOrder, createOrderbook } from '@permaweb/ucm';

import { messageResults } from 'api';

import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { FormField } from 'components/atoms/FormField';
import { Slider } from 'components/atoms/Slider';
import { TokenSelector } from 'components/atoms/TokenSelector';
import { TxAddress } from 'components/atoms/TxAddress';
import { Panel } from 'components/molecules/Panel';
import { AO, ASSETS, REDIRECTS, TOKEN_REGISTRY, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { AssetOrderType } from 'helpers/types';
import {
	checkValidAddress,
	formatAddress,
	formatCount,
	getTagValue,
	getTotalTokenBalance,
	reverseDenomination,
} from 'helpers/utils';
import * as windowUtils from 'helpers/window';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { useTokenProvider } from 'providers/TokenProvider';

import * as S from './styles';
import { IProps } from './types';

const MIN_PRICE = 0.000001;

export default function AssetActionMarketOrders(props: IProps) {
	const permawebProvider = usePermawebProvider();
	const arProvider = useArweaveProvider();
	const tokenProvider = useTokenProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	// Total quantity of asset
	const [totalAssetBalance, _setTotalAssetBalance] = React.useState<number>(0);

	// Total quantity of asset for sale (Asks available to buy)
	const [totalSalesQuantity, setTotalSalesQuantity] = React.useState<number>(0);

	// Total quantity of bids available to sell into
	const [totalBidQuantity, setTotalBidQuantity] = React.useState<number>(0);

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

	// Buy / Sell tokens through wallet directly, bypass profile
	const [sendToWallet, setSendToWallet] = React.useState<boolean>(false);

	// Track tokens currently being hydrated
	const [hydratingTokens, setHydratingTokens] = React.useState<string[]>([]);

	// Track hydration progress for each token (tokenId -> percentage)
	const [hydrationProgress, setHydrationProgress] = React.useState<{ [key: string]: number }>({});

	const CURRENT_AO_NODE = 'https://state.forward.computer';
	const CURRENT_TOKEN_NODE = 'https://state-1.forward.computer';
	const SU_URL = 'https://su-router.ao-testnet.xyz';

	// Hydrate tokens on page load
	React.useEffect(() => {
		const assetId = props.asset?.data?.id;
		if (assetId) {
			hydrateProcess(assetId, resolveHBNode(assetId));
		}

		// Cleanup: remove from hydration state if asset changes
		return () => {
			if (assetId) {
				setHydratingTokens((prev) => prev.filter((id) => id !== assetId));
				setHydrationProgress((prev) => {
					const next = { ...prev };
					delete next[assetId];
					return next;
				});
			}
		};
	}, [props.asset?.data?.id]);

	React.useEffect(() => {
		const tokenId = tokenProvider.selectedToken?.id;
		if (tokenId) {
			hydrateProcess(tokenId, resolveHBNode(tokenId));
		}

		// Cleanup: remove from hydration state if token changes
		return () => {
			if (tokenId) {
				setHydratingTokens((prev) => prev.filter((id) => id !== tokenId));
				setHydrationProgress((prev) => {
					const next = { ...prev };
					delete next[tokenId];
					return next;
				});
			}
		};
	}, [tokenProvider.selectedToken?.id]);

	function resolveHBNode(processId: string) {
		return processId === AO.ao ? CURRENT_AO_NODE : CURRENT_TOKEN_NODE;
	}

	async function hydrateProcess(processId: string, node: string) {
		console.log(`Running hydration for ${processId}...`);

		try {
			const latestSlotResponse = await fetch(`${SU_URL}/${processId}/latest`);
			const latestSlotParsed = await latestSlotResponse.json();
			const latestSlot = getTagValue(latestSlotParsed.assignment.tags, 'Nonce');

			const currentHBSlotResponse = await fetch(`${node}/${processId}~process@1.0/compute/at-slot`);
			const currentHBSlot = await currentHBSlotResponse.text();

			if (Number(currentHBSlot) < Number(latestSlot)) {
				setHydratingTokens((prev) => (prev.includes(processId) ? prev : [...prev, processId]));

				// Set initial progress
				const initialProgress = Math.floor((Number(currentHBSlot) / Number(latestSlot)) * 100);
				setHydrationProgress((prev) => ({ ...prev, [processId]: initialProgress }));

				await fetch(`${node}/${processId}~process@1.0/now`);

				let updatedHBSlot = currentHBSlot;
				while (Number(updatedHBSlot) < Number(latestSlot)) {
					await new Promise((resolve) => setTimeout(resolve, 1000));
					const polledResponse = await fetch(`${node}/${processId}~process@1.0/compute/at-slot`);
					updatedHBSlot = await polledResponse.text();

					// Calculate and update progress percentage using the newly fetched slot
					const progress = Math.floor((Number(currentHBSlot) / Number(latestSlot)) * 100);
					console.log(`Hydration progress for ${processId}: ${progress}%`);
					setHydrationProgress((prev) => ({ ...prev, [processId]: progress }));
				}

				// Set to 100% when complete
				setHydrationProgress((prev) => ({ ...prev, [processId]: 100 }));
			}
		} catch (e: any) {
			console.error(e);
		} finally {
			setHydratingTokens((prev) => prev.filter((id) => id !== processId));
			setHydrationProgress((prev) => {
				const next = { ...prev };
				delete next[processId];
				return next;
			});
		}
	}

	React.useEffect(() => {
		if (props.asset) {
			if (props.asset.state) {
				if (props.asset.state.denomination) {
					if (!denomination && props.asset.state.denomination && Number(props.asset.state.denomination) > 1) {
						setDenomination(Math.pow(10, props.asset.state.denomination));

						/* Default to wallet if it is a denominated token */
						setSendToWallet(true);
					}
				}

				if (arProvider.walletAddress && permawebProvider.tokenBalances?.[props.asset.data.id]) {
					const profileBalance = Number(permawebProvider.tokenBalances?.[props.asset.data.id].profileBalance);
					const walletBalance = Number(permawebProvider.tokenBalances?.[props.asset.data.id].walletBalance);

					let calculatedOwnerBalance = profileBalance;
					let calculatedWalletBalance = walletBalance;

					if (denomination) {
						calculatedOwnerBalance = profileBalance / denomination;
						calculatedWalletBalance = walletBalance / denomination;
					}

					setConnectedBalance(calculatedOwnerBalance);
					setConnectedWalletBalance(calculatedWalletBalance);
				} else {
					// Helper function to normalize balance response
					const normalizeBalance = (balanceResponse: any) => {
						if (balanceResponse === null || balanceResponse === undefined) {
							return null;
						}

						// If response has Balance property, use that
						if (typeof balanceResponse === 'object' && balanceResponse.Balance !== undefined) {
							const balanceValue = balanceResponse.Balance;
							if (balanceValue === '0' || balanceValue === 0) {
								return 0;
							}
							return Number(balanceValue) || null;
						}

						// Otherwise, treat the response itself as the balance
						if (balanceResponse === '0' || balanceResponse === 0) {
							return 0;
						}
						return Number(balanceResponse) || null;
					};

					const fetchBalance = async (processId: string, recipient: string) => {
						try {
							const resp = await permawebProvider.libs.readProcess({
								processId,
								action: 'Balance',
								tags: [{ name: 'Recipient', value: recipient }],
							});
							return normalizeBalance(resp);
						} catch (err) {
							console;
							console.error('Balance fetch failed:', { processId, recipient, err });
							return normalizeBalance(0);
						}
					};

					(async function () {
						let calculatedOwnerBalance = 0;
						if (permawebProvider.profile?.id)
							calculatedOwnerBalance = await fetchBalance(props.asset.data.id, permawebProvider.profile?.id);
						let calculatedWalletBalance = await fetchBalance(props.asset.data.id, arProvider.walletAddress);

						if (denomination) {
							calculatedOwnerBalance = calculatedOwnerBalance / denomination;
							calculatedWalletBalance = calculatedWalletBalance / denomination;
						}

						setConnectedBalance(calculatedOwnerBalance);
						setConnectedWalletBalance(calculatedWalletBalance);
					})();
				}

				// if (props.asset.state.balances) {
				// 	const balances: any = Object.keys(props.asset.state.balances).map((address: string) => {
				// 		return Number(props.asset.state.balances[address]);
				// 	});

				// 	const totalBalance = balances.reduce((a: number, b: number) => a + b, 0);

				// 	let calculatedTotalBalance = totalBalance;

				// 	if (denomination) {
				// 		calculatedTotalBalance = totalBalance / denomination;
				// 	}

				// 	setTotalAssetBalance(calculatedTotalBalance);
				// if (props.asset.state.balances) {
				// 	const balances: any = Object.keys(props.asset.state.balances).map((address: string) => {
				// 		return Number(props.asset.state.balances[address]);
				// 	});

				// 	const totalBalance = balances.reduce((a: number, b: number) => a + b, 0);

				// 	let calculatedTotalBalance = totalBalance;

				// 	if (denomination) {
				// 		calculatedTotalBalance = totalBalance / denomination;
				// 	}

				// 	setTotalAssetBalance(calculatedTotalBalance);

				// 	if (arProvider.walletAddress && permawebProvider.profile && permawebProvider.profile.id) {
				// 		const profileBalance = Number(props.asset.state.balances[permawebProvider.profile.id]);
				// 		const walletBalance = Number(props.asset.state.balances[arProvider.walletAddress]);

				// let calculatedOwnerBalance = profileBalance;
				// let calculatedWalletBalance = walletBalance;

				// if (denomination) {
				// 	calculatedOwnerBalance = profileBalance / denomination;
				// 	calculatedWalletBalance = walletBalance / denomination;
				// }

				// 		setConnectedBalance(calculatedOwnerBalance);
				// 		setConnectedWalletBalance(calculatedWalletBalance);
				// 	}
				// }
			}

			if (props.asset.orderbook?.orders && props.asset.orderbook?.orders.length > 0) {
				const selectedTokenId = tokenProvider.selectedToken.id;

				// For buy orders: only count Ask orders (assets available for sale)
				// For legacy orderbooks without side info, treat all orders as asks
				const salesBalances = props.asset.orderbook?.orders
					.filter((order: AssetOrderType) => {
						const matchesCurrency = order.currency === selectedTokenId;
						const isAsk = !order.side || order.side === 'Ask'; // Backward compatible: no side = ask
						return matchesCurrency && isAsk;
					})
					.map((order: AssetOrderType) => {
						return Number(order.quantity);
					});

				const totalSalesBalance = salesBalances.reduce((a: number, b: number) => a + b, 0);

				let calculatedTotalSalesBalance = totalSalesBalance;

				if (denomination) calculatedTotalSalesBalance = totalSalesBalance / denomination;

				setTotalSalesQuantity(calculatedTotalSalesBalance);

				// For sell orders: calculate total bid quantity available for the selected token
				// Bids store total quote tokens, need to divide by price to get base token quantity
				// const selectedTokenId = tokenProvider.selectedToken.id;
				const bidQuantities = props.asset.orderbook?.orders
					.filter((order: AssetOrderType) => {
						const matchesCurrency = order.currency === props.asset.data.id; // Bids have base token as currency
						const matchesSelectedToken = order.token === selectedTokenId; // Bid is offering the selected token
						const isBid = order.side === 'Bid';
						return matchesCurrency && matchesSelectedToken && isBid;
					})
					.map((order: AssetOrderType) => {
						// For bids: price is stored as "quote raw per base display"
						// Base quantity (display units) = bid.quantity (quote raw) / price
						return Number(order.quantity) / Number(order.price);
					});

				const totalBids = bidQuantities.reduce((a: number, b: number) => a + b, 0);

				setTotalBidQuantity(totalBids);
			}
		}
	}, [
		props.asset,
		arProvider.walletAddress,
		permawebProvider.profile,
		permawebProvider.tokenBalances,
		permawebProvider.libs?.readProcess,
		denomination,
		tokenProvider.selectedToken.id,
	]);

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
				// For sell (market orders): show quantity of bids available to fill
				setMaxOrderQuantity(totalBidQuantity);
				break;
			case 'bid':
				// For bids, user can bid any quantity they want
				// The real limit is their currency balance and the price they set (quantity × price)
				// Use a reasonable number for slider, but don't enforce as hard limit
				setMaxOrderQuantity(10000000); // 10M for slider range, validation is by total cost
				break;
			case 'list':
			case 'transfer':
				let totalBalance = 0;
				if (connectedBalance) totalBalance += connectedBalance;
				if (connectedWalletBalance) totalBalance += connectedWalletBalance;
				setMaxOrderQuantity(totalBalance);
				break;
		}
	}, [
		props.asset,
		props.type,
		connectedBalance,
		connectedWalletBalance,
		totalSalesQuantity,
		totalBidQuantity,
		permawebProvider.tokenBalances,
		tokenProvider.selectedToken.id,
		transferDenomination,
		denomination,
	]);

	React.useEffect(() => {
		if (props.type === 'buy' || props.type === 'bid') {
			if (!permawebProvider.tokenBalances || !permawebProvider.tokenBalances[tokenProvider.selectedToken.id]) {
				setInsufficientBalance(true);
			} else {
				const totalAmount = getTotalOrderAmount();
				let orderAmount = isNaN(Number(totalAmount)) ? BigInt(0) : BigInt(Math.floor(Number(totalAmount)));
				if (props.type === 'buy' && denomination) {
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
		unitPrice,
		denomination,
		tokenProvider.selectedToken.id,
	]);

	React.useEffect(() => {
		if (currentOrderQuantity) setCurrentOrderQuantity('');
		if (unitPrice) setUnitPrice('');
	}, [props.type]);

	async function handleSubmit() {
		if (props.asset && arProvider.wallet) {
			if (props.type === 'transfer') {
				try {
					await handleTransfer();
				} catch (e: any) {
					handleStatusUpdate(false, true, false, e.message ?? 'Error executing transfer');
				}
				return;
			}

			let currentOrderbook = props.asset.orderbook?.id;

			if (!currentOrderbook) {
				try {
					const args: any = { assetId: props.asset.data.id, writeToProcess: true };
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

			// Determine if we need to transfer from wallet to profile
			const transferQuantity = getTransferQuantity().toString();
			let useWalletAddress = false;

			// For list/bid orders, check if wallet has sufficient balance
			// if (props.type === 'list' || props.type === 'bid') {
			// @ts-ignore
			let _processId: string;
			let walletBalance: bigint = BigInt(0);

			if (props.type === 'bid') {
				_processId = tokenProvider.selectedToken.id;
				walletBalance = BigInt(permawebProvider.tokenBalances[tokenProvider.selectedToken.id]?.walletBalance || 0);
			} else if (props.type === 'list') {
				_processId = props.asset.data.id;
				if (connectedWalletBalance)
					walletBalance = BigInt(
						denomination ? Math.floor(connectedWalletBalance * denomination) : connectedWalletBalance
					);
			}

			// If wallet has sufficient balance, use wallet address directly
			if (walletBalance >= BigInt(transferQuantity)) {
				useWalletAddress = true;
				console.log('Using wallet address directly for order creation (sufficient balance)');
			}
			// }

			if (!useWalletAddress) {
				try {
					handleStatusUpdate(true, false, false, 'Transferring balance from wallet to profile...');
					await handleWalletToProfileTransfer();
				} catch (e: any) {
					handleStatusUpdate(false, true, false, e);
				}
			}

			const unitPrice = getUnitPrice()?.toString();

			let dominantToken = null;
			let swapToken = null;

			switch (props.type) {
				case 'buy':
					dominantToken = tokenProvider.selectedToken.id;
					swapToken = props.asset.data.id;
					break;
				case 'sell':
					// Sell: Market order - send asset (base token), receive currency (quote token)
					dominantToken = props.asset.data.id;
					swapToken = tokenProvider.selectedToken.id;
					break;
				case 'list':
					// List: Limit ask - send asset (base token), receive currency (quote token)
					dominantToken = props.asset.data.id;
					swapToken = tokenProvider.selectedToken.id;
					break;
				case 'bid':
					// Bid: Send currency (quote token), receive asset (base token)
					dominantToken = tokenProvider.selectedToken.id;
					swapToken = props.asset.data.id;
					break;
				default:
					break;
			}

			try {
				let action = 'Run-Action';
				if (permawebProvider.profile?.isLegacyProfile) action = 'Transfer';

				const data: any = {
					orderbookId: currentOrderbook,
					baseToken: props.asset.data.id, // Always the primary token in the pair
					quoteToken: tokenProvider.selectedToken.id, // Always the secondary token in the pair
					dominantToken: dominantToken, // The dominant token of this specific order
					swapToken: swapToken, // The swap token of this specific order
					quantity: transferQuantity,
					action: action,
				};

				// For buy orders, if sendToWallet is true, set walletAddress to receive tokens directly to wallet
				if (props.type === 'buy' && sendToWallet) {
					data.walletAddress = arProvider.walletAddress;
				} else {
					if (props.type === 'list' || props.type === 'bid') {
						if (useWalletAddress) data.walletAddress = arProvider.walletAddress;
						else data.creatorId = permawebProvider.profile?.id;
					} else {
						data.creatorId = permawebProvider.profile?.id;
					}
				}

				if (unitPrice) data.unitPrice = unitPrice.toString();

				// Pass both denominations to UCM for proper matching calculations
				// baseTokenDenomination is always the asset's denomination (base token in pair)
				// quoteTokenDenomination is always the selected token's denomination (quote token in pair)
				if (denomination && denomination > 1) {
					data.baseTokenDenomination = denomination.toString();
				}

				if (transferDenomination && transferDenomination > 1) {
					data.quoteTokenDenomination = transferDenomination.toString();
				}

				const orderId = await createOrder(
					permawebProvider.deps,
					data,
					(args: { processing: boolean; success: boolean; message: string }) => {
						handleStatusUpdate(args.processing, !args.processing, args.success, args.message);
					}
				);

				setOrderId(orderId);

				props.toggleUpdate();
				arProvider.setToggleProfileUpdate(!arProvider.toggleProfileUpdate);
				permawebProvider.setToggleTokenBalanceUpdate(!permawebProvider.toggleTokenBalanceUpdate);

				// if (props.type === 'buy') {
				// 	const streaks = await readHandler({
				// 		processId: AO.pixl,
				// 		action: 'Get-Streaks',
				// 	});
				// 	dispatch(streakActions.setStreaks(streaks.Streaks));
				// }
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
				if (denomination)
					transferQuantity = (BigInt(Math.floor(Number(transferQuantity))) / BigInt(denomination)).toString();
				break;
			case 'bid':
				// Bid: Transfer the total currency amount (price * quantity)
				const bidTotalAmount = getTotalOrderAmount();
				transferQuantity = isNaN(Number(bidTotalAmount)) ? '0' : bidTotalAmount.toString();
				break;
			case 'sell':
			case 'list':
			case 'transfer':
				if (denomination) {
					transferQuantity = BigInt(Math.floor(Number(currentOrderQuantity) * Number(denomination))).toString();
				}
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
				case 'bid':
					processId = tokenProvider.selectedToken.id;
					profileBalance = BigInt(permawebProvider.tokenBalances[tokenProvider.selectedToken.id].profileBalance);
					walletBalance = BigInt(permawebProvider.tokenBalances[tokenProvider.selectedToken.id].walletBalance);
					break;
				case 'sell':
				case 'list':
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
					console.log(`Transferring remainder from wallet (${differenceNeeded.toString()}) to profile...`);
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
					console.log('Transfer complete');
				}
			}
		} catch (e: any) {
			throw new Error(e.message ?? 'Error making wallet to profile transfer');
		}
	}

	async function handleTransfer() {
		if (transferRecipient && checkValidAddress(transferRecipient)) {
			setOrderLoading(true);
			try {
				// Determine if we need to transfer from wallet to profile first
				const transferQuantity = getTransferQuantity();
				const processId = props.asset.data.id;

				let profileBalance = BigInt(0);
				let walletBalance = BigInt(0);

				if (connectedBalance)
					profileBalance = BigInt(denomination ? Math.floor(connectedBalance * denomination) : connectedBalance);
				if (connectedWalletBalance)
					walletBalance = BigInt(
						denomination ? Math.floor(connectedWalletBalance * denomination) : connectedWalletBalance
					);

				console.log(`Transfer quantity: ${transferQuantity}`);
				console.log(`Profile balance: ${profileBalance.toString()}`);
				console.log(`Wallet balance: ${walletBalance.toString()}`);

				if (walletBalance + profileBalance < BigInt(transferQuantity)) {
					console.error('Insufficient total balance (wallet + profile) for transfer');
					throw new Error('Insufficient total balance (wallet + profile) for transfer');
				}

				let transferId: string;

				if (walletBalance >= BigInt(transferQuantity)) {
					transferId = await permawebProvider.libs.sendMessage({
						processId: processId,
						action: 'Transfer',
						tags: [
							{ name: 'Quantity', value: transferQuantity.toString() },
							{ name: 'Recipient', value: transferRecipient },
						],
					});
				} else if (profileBalance >= BigInt(transferQuantity)) {
					// Use Run-Action for new Zone Profiles, Transfer for legacy profiles
					let tags = [];
					let data = null;

					if (permawebProvider.profile.isLegacyProfile) {
						// Legacy profile: use direct Transfer
						tags = [
							{ name: 'Action', value: 'Transfer' },
							{ name: 'Target', value: props.asset.data.id },
							{ name: 'Recipient', value: transferRecipient },
							{ name: 'Quantity', value: transferQuantity.toString() },
						];
					} else {
						// New Zone Profile: use Run-Action pattern
						tags = [
							{ name: 'Action', value: 'Run-Action' },
							{ name: 'ForwardTo', value: props.asset.data.id },
							{ name: 'ForwardAction', value: 'Transfer' },
							{ name: 'Forward-To', value: props.asset.data.id },
							{ name: 'Forward-Action', value: 'Transfer' },
							{ name: 'Recipient', value: transferRecipient },
							{ name: 'Quantity', value: transferQuantity.toString() },
						];
						// For Run-Action, we need to pass data in the expected format
						data = {
							Target: props.asset.data.id,
							Action: 'Transfer',
							Input: {
								Recipient: transferRecipient,
								Quantity: transferQuantity.toString(),
							},
						};
					}

					transferId = await permawebProvider.libs.sendMessage({
						processId: permawebProvider.profile.id,
						tags: tags,
						data: data,
					});
				} else {
					const differenceNeeded = BigInt(transferQuantity) - profileBalance;
					if (walletBalance < differenceNeeded) {
						console.error(`Wallet balance is less than difference needed: ${differenceNeeded}`);
						console.error(`Wallet balance: ${walletBalance}`);
						throw new Error('Insufficient balance for transfer');
					} else {
						console.log(`Transferring remainder from wallet (${differenceNeeded.toString()}) to profile...`);
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

						// Use Run-Action for new Zone Profiles, Transfer for legacy profiles
						let tags = [];
						let data = null;

						if (permawebProvider.profile.isLegacyProfile) {
							// Legacy profile: use direct Transfer
							tags = [
								{ name: 'Action', value: 'Transfer' },
								{ name: 'Target', value: props.asset.data.id },
								{ name: 'Recipient', value: transferRecipient },
								{ name: 'Quantity', value: transferQuantity.toString() },
							];
						} else {
							// New Zone Profile: use Run-Action pattern
							tags = [
								{ name: 'Action', value: 'Run-Action' },
								{ name: 'ForwardTo', value: props.asset.data.id },
								{ name: 'ForwardAction', value: 'Transfer' },
								{ name: 'Forward-To', value: props.asset.data.id },
								{ name: 'Forward-Action', value: 'Transfer' },
								{ name: 'Recipient', value: transferRecipient },
								{ name: 'Quantity', value: transferQuantity.toString() },
							];
							// For Run-Action, we need to pass data in the expected format
							data = {
								Target: props.asset.data.id,
								Action: 'Transfer',
								Input: {
									Recipient: transferRecipient,
									Quantity: transferQuantity.toString(),
								},
							};
						}

						transferId = await permawebProvider.libs.sendMessage({
							processId: permawebProvider.profile.id,
							tags: tags,
							data: data,
						});
					}
				}

				console.log(`Transfer: ${transferId}`);

				setOrderId(transferId);
				setOrderLoading(false);

				handleStatusUpdate(false, true, true, 'Balance Transferred!');
			} catch (e: any) {
				setOrderLoading(false);
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
						const matchesCurrency = order.currency === selectedTokenId;
						const isAsk = !order.side || order.side === 'Ask'; // Backward compatible: no side = ask
						return !isNaN(price) && !isNaN(quantity) && price > 0 && quantity > 0 && matchesCurrency && isAsk;
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
		} else if (props.type === 'list') {
			// For LIST orders: Calculate the total amount of the receiving token in raw units
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
		} else if (props.type === 'bid') {
			// For BID orders: Calculate the total amount of currency needed (price * quantity)
			let price: bigint = BigInt(0);
			if (
				isNaN(Number(unitPrice)) ||
				isNaN(Number(currentOrderQuantity)) ||
				Number(currentOrderQuantity) < 0 ||
				Number(unitPrice) < 0
			) {
				price = BigInt(0);
			} else {
				// Calculate the total amount of currency in display units
				const totalDisplayAmount = Number(currentOrderQuantity) * Number(unitPrice);

				// Convert to raw units using transferDenomination
				if (transferDenomination) {
					price = BigInt(Math.floor(totalDisplayAmount * transferDenomination));
				} else {
					price = BigInt(Math.floor(totalDisplayAmount));
				}
			}

			return price;
		} else if (props.type === 'sell') {
			// For SELL orders: Market order - calculate total amount based on available bids
			if (props.asset && props.asset.orderbook?.orders) {
				const selectedTokenId = tokenProvider.selectedToken.id;

				let sortedOrders = props.asset.orderbook?.orders
					.filter((order: AssetOrderType) => {
						const price = Number(order.price);
						const quantity = Number(order.quantity);
						const matchesCurrency = order.currency === props.asset.data.id; // Bids have base token as currency
						const matchesSelectedToken = order.token === selectedTokenId; // Bid is offering the selected token
						const isBid = order.side === 'Bid';
						return (
							!isNaN(price) &&
							!isNaN(quantity) &&
							price > 0 &&
							quantity > 0 &&
							matchesCurrency &&
							matchesSelectedToken &&
							isBid
						);
					})
					.sort((a: AssetOrderType, b: AssetOrderType) => Number(b.price) - Number(a.price)); // Highest price first

				let totalQuantitySold = 0; // Track how much we've sold (in base token)
				let totalQuoteReceived = 0; // Track how much quote token we receive

				const inputQuantity = currentOrderQuantity as number; // Amount we want to sell

				for (let i = 0; i < sortedOrders.length; i++) {
					const orderQuantity = Number(sortedOrders[i].quantity); // Total quote tokens in bid
					const orderPrice = Number(sortedOrders[i].price); // Price per base token

					// Skip orders with invalid quantity or price
					if (isNaN(orderQuantity) || isNaN(orderPrice) || orderQuantity <= 0 || orderPrice <= 0) {
						continue;
					}

					// For bids: quantity field is total quote tokens, divide by price to get base token quantity available
					const baseTokenAvailable = orderQuantity / orderPrice;

					// How much more do we need to sell?
					const remainingToSell = inputQuantity - totalQuantitySold;

					if (baseTokenAvailable >= remainingToSell) {
						// This bid can fulfill the rest of our sell order
						const quoteReceived = remainingToSell * orderPrice;
						totalQuoteReceived += quoteReceived;
						totalQuantitySold += remainingToSell;
						break;
					} else {
						// Sell as much as this bid can take
						const quoteReceived = baseTokenAvailable * orderPrice; // Should equal orderQuantity
						totalQuoteReceived += quoteReceived;
						totalQuantitySold += baseTokenAvailable;
					}
				}

				// Convert to denominated integer for display
				const result = denomination ? totalQuoteReceived : totalQuoteReceived;
				return BigInt(Math.floor(result));
			} else return 0;
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
		if (orderProcessed) return false;
		if (orderLoading) return true;
		if (props.asset && !props.asset.state?.transferable) return true;
		if (maxOrderQuantity <= 0 || isNaN(Number(currentOrderQuantity))) return true;
		if (
			Number(currentOrderQuantity) <= 0 ||
			isNaN(maxOrderQuantity) ||
			(!Number.isInteger(Number(currentOrderQuantity)) && !denomination)
		)
			return true;
		if (props.type !== 'bid' && Number(currentOrderQuantity) > maxOrderQuantity) return true;
		if (
			(props.type === 'list' || props.type === 'bid') &&
			(Number(unitPrice) <= 0 || Number(unitPrice) <= MIN_PRICE || isNaN(Number(unitPrice)))
		)
			return true;
		if (props.type === 'transfer' && (!transferRecipient || !checkValidAddress(transferRecipient))) return true;
		if (insufficientBalance) return true;

		// For BUY orders: Check if there are existing Ask orders to buy from
		// For SELL orders: Check if there are existing Bid orders to sell to
		// For LIST/BID orders: Allow any token (creating new liquidity)
		if (props.type === 'buy') {
			const hasUCMOrders = props.asset?.orderbook?.orders && props.asset.orderbook.orders.length > 0;
			const selectedTokenId = tokenProvider.selectedToken.id;
			const hasMatchingOrders =
				hasUCMOrders &&
				props.asset.orderbook.orders.some((order: AssetOrderType) => {
					const matchesCurrency = order.currency === selectedTokenId;
					const isAsk = !order.side || order.side === 'Ask'; // Backward compatible: no side = ask
					return matchesCurrency && isAsk;
				});

			if (!hasMatchingOrders) {
				return true;
			}
		}

		if (props.type === 'sell') {
			const hasUCMOrders = props.asset?.orderbook?.orders && props.asset.orderbook.orders.length > 0;
			const selectedTokenId = tokenProvider.selectedToken.id;
			const hasMatchingBids =
				hasUCMOrders &&
				props.asset.orderbook.orders.some((order: AssetOrderType) => {
					const matchesAsset = order.currency === props.asset.data.id; // Bids have asset as currency
					const matchesSelectedToken = order.token === selectedTokenId; // Bid is offering the selected token
					const isBid = order.side === 'Bid';
					return matchesAsset && matchesSelectedToken && isBid;
				});

			if (!hasMatchingBids) {
				return true;
			}
		}

		return false;
	}

	const getTotals = React.useMemo(() => {
		let balanceHeader: string | null = null;
		// let percentageHeader: string | null = null;

		let totalBalance = 0;
		let quantity: number | null = null;

		switch (props.type) {
			case 'buy':
				balanceHeader = language.totalSalesBalance;
				// percentageHeader = language.totalSalesPercentage;
				quantity = totalSalesQuantity;
				break;
			case 'sell':
				balanceHeader = 'Total Bid Quantity Available';
				quantity = totalBidQuantity;
				break;
			case 'bid':
				balanceHeader = 'Available to Bid';
				quantity = 0; // Bids are limited by total cost (price * quantity), not just quantity
				break;
			case 'list':
				balanceHeader = language.totalSalesBalanceAvailable;
				// percentageHeader = language.totalSalesPercentageAvailable;
				totalBalance = 0;
				if (connectedBalance) totalBalance += connectedBalance;
				if (connectedWalletBalance) totalBalance += connectedWalletBalance;
				quantity = totalBalance;
				break;
			case 'transfer':
				balanceHeader = language.totalTransferBalanceAvailable;
				// percentageHeader = language.totalTransferPercentageAvailable;
				totalBalance = 0;
				if (connectedBalance) totalBalance += connectedBalance;
				if (connectedWalletBalance) totalBalance += connectedWalletBalance;
				quantity = totalBalance;
				break;
		}

		return (
			<>
				{props.type !== 'bid' && (
					<S.TotalQuantityLine>
						<p>{balanceHeader}</p>
						<span>{props.updating ? `${language.updating}...` : formatCount(quantity.toString())}</span>
					</S.TotalQuantityLine>
				)}
				{props.type === 'sell' && !props.updating && (
					<S.TotalQuantityLine>
						<p>{'Your Balance'}</p>
						<span>
							{formatCount(
								getTotalTokenBalance(
									{
										profileBalance: connectedBalance,
										walletBalance: connectedWalletBalance,
									},
									{ denominated: true }
								).toString()
							)}
						</span>
					</S.TotalQuantityLine>
				)}
				{/* <S.TotalQuantityLine>
					<p>{percentageHeader}</p>
					<span>{formatPercentage(!isNaN(quantity / totalAssetBalance) ? quantity / totalAssetBalance : 0)}</span>
				</S.TotalQuantityLine> */}
			</>
		);
	}, [props.asset, props.type, totalAssetBalance, totalSalesQuantity, totalBidQuantity, connectedBalance]);

	function getTotalPriceDisplay() {
		const selectedTokenId = tokenProvider.selectedToken.id;

		let totalAmount = getTotalOrderAmount();
		if (props.type === 'buy' && denomination && denomination > 1)
			totalAmount = BigInt(Math.floor(Number(totalAmount))) / BigInt(denomination);

		const amount = isNaN(Number(totalAmount)) ? BigInt(0) : BigInt(Math.floor(Number(totalAmount)));
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

	let dominantToken = null;
	// let swapToken = null;

	function getOrderDetails(_useWrapper: boolean) {
		let quantityLabel: string | null = null;
		// let percentageLabel: string | null = null;

		switch (props.type) {
			case 'buy':
				quantityLabel = language.totalPurchaseQuantity;
				dominantToken = props.asset.data.id;
				// swapToken = props.asset.data.id;
				// percentageLabel = language.totalPurchasePercentage;
				break;
			case 'bid':
				quantityLabel = 'Total Bid Quantity';
				dominantToken = props.asset.data.id;
				// swapToken = props.asset.data.id;
				break;
			case 'sell':
				quantityLabel = 'Total Sale Quantity';
				dominantToken = props.asset.data.id;
				break;
			case 'list':
				quantityLabel = language.totalListingQuantity;
				dominantToken = props.asset.data.id;
				// percentageLabel = language.totalListingPercentage;
				break;
			case 'transfer':
				quantityLabel = language.totalTransferQuantity;
				dominantToken = props.asset.data.id;
				// percentageLabel = language.totalTransferPercentage;
				break;
		}

		return (
			<S.SalesWrapper useWrapper={false}>
				<S.SalesLine>
					<S.SalesDetail>
						<span>{quantityLabel}</span>
						<S.SalesDetailValue>
							{TOKEN_REGISTRY[dominantToken] && <img src={getTxEndpoint(TOKEN_REGISTRY[dominantToken].logo)} />}
							<p>{formatCount(currentOrderQuantity.toString())}</p>
						</S.SalesDetailValue>
					</S.SalesDetail>
					{/* <S.SalesDetail>
						<span>{percentageLabel}</span>
						<p>
							{formatPercentage(
								!isNaN(Number(currentOrderQuantity) / totalAssetBalance)
									? Number(currentOrderQuantity) / totalAssetBalance
									: 0
							)}
						</p>
					</S.SalesDetail> */}
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
			case 'bid':
				label = finalizeOrder ? 'Confirm Bid' : 'Bid';
				icon = ASSETS.bid;
				break;
			case 'sell':
				label = finalizeOrder ? 'Confirm Sale' : 'Sell';
				icon = ASSETS.sell;
				break;
			case 'list':
				label = finalizeOrder ? language.confirmListing : 'List';
				icon = ASSETS.listing;
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
			case 'bid':
				header = 'Confirm Bid';
				confirmationHeader = 'Bid Order Details';
				reviewMessage = 'Review Bid Details';
				break;
			case 'sell':
				header = 'Confirm Sale';
				confirmationHeader = 'Market Sell Order Details';
				reviewMessage = 'Review your sell order details';
				break;
			case 'list':
				header = language.confirmListing;
				confirmationHeader = language.orderConfirmationDetailsListing;
				reviewMessage = language.orderConfirmationReviewListing;
				footer = (
					<li>
						{language.sellerFee}{' '}
						<Link to={URLS.docs} target={'_blank'}>
							{language.learnMore}
						</Link>
					</li>
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

					{props.type === 'buy' && (
						<S.ConfirmationDetailsAction
							active={sendToWallet}
							disabled={orderProcessed}
							onClick={() => setSendToWallet((prev) => !prev)}
						>
							<S.ConfirmationDetailsHeader>
								<p>Send Tokens To Wallet</p>

								<S.ConfirmationDetailsActionIndicator active={sendToWallet}>
									{sendToWallet && <ReactSVG src={ASSETS.checkmark} />}
								</S.ConfirmationDetailsActionIndicator>
							</S.ConfirmationDetailsHeader>
							<S.ConfirmationDetailsLineWrapper>
								<p>
									If checked, this order will send the tokens to your wallet directly for easier access in other
									exchanges. Note that if this is selected, the tokens will not appear in your profile.
								</p>
							</S.ConfirmationDetailsLineWrapper>
						</S.ConfirmationDetailsAction>
					)}

					<S.ConfirmationDetails>
						<S.ConfirmationDetailsHeader>
							<p>{props.type === 'transfer' ? 'Transfer Details' : confirmationHeader}</p>
						</S.ConfirmationDetailsHeader>
						<S.ConfirmationDetailsLineWrapper>
							{orderId ? (
								<S.ConfirmationDetailsFlex>
									<S.ConfirmationDetailsLine>
										<p id={'id-line'}>{props.type === 'transfer' ? 'Transfer ID: ' : `${language.orderId}: `}</p>
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
								<p>
									{props.type === 'transfer' ? 'Transfer information will show here' : language.orderConfirmationInfo}
								</p>
							)}
						</S.ConfirmationDetailsLineWrapper>
					</S.ConfirmationDetails>

					<S.ConfirmationFooter>
						{footer && <>{footer}</>}
						<li>
							Token Balance updates may take some time. To see your updated balances please check back in a few minutes.
						</li>
					</S.ConfirmationFooter>
					<S.ConfirmationMessage success={orderProcessed && orderSuccess} warning={orderProcessed && !orderSuccess}>
						<span>{currentNotification ? currentNotification : orderLoading ? 'Processing...' : reviewMessage}</span>
					</S.ConfirmationMessage>
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
						disabled={!arProvider.walletAddress || (props.type !== 'bid' && maxOrderQuantity <= 0) || orderLoading}
						invalid={{
							status:
								Number(currentOrderQuantity) < 0 ||
								(props.type !== 'bid' && Number(currentOrderQuantity) > maxOrderQuantity),
							message: null,
						}}
						useFractional={maxOrderQuantity < 1}
					/>
					{props.type !== 'bid' && (
						<S.MaxQty>
							<Button
								type={'primary'}
								label={language.max}
								handlePress={() => setCurrentOrderQuantity(maxOrderQuantity)}
								disabled={!arProvider.walletAddress || maxOrderQuantity <= 0}
								noMinWidth
							/>
						</S.MaxQty>
					)}
					<S.FieldsFlexWrapper>
						<S.TotalsWrapper>
							{/* <S.TotalQuantityLine>
								<p>{`${language.totalAssetBalance}`}</p>
								<span>{formatCount(totalAssetBalance.toString())}</span>
							</S.TotalQuantityLine> */}
							{getTotals}
						</S.TotalsWrapper>
						<S.FieldsWrapper>
							<S.FieldWrapper>
								<FormField
									type={'number'}
									step={'1'}
									value={isNaN(Number(currentOrderQuantity)) ? '' : currentOrderQuantity}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuantityInput(e)}
									label={
										props.type === 'bid'
											? language.assetQuantity
											: `${language.assetQuantity} (${language.max}: ${formatCount(maxOrderQuantity.toString())})`
									}
									disabled={
										!arProvider.walletAddress || (props.type !== 'bid' && maxOrderQuantity <= 0) || orderLoading
									}
									invalid={{
										status:
											Number(currentOrderQuantity) < 0 ||
											(props.type !== 'bid' && Number(currentOrderQuantity) > maxOrderQuantity) ||
											(!Number.isInteger(Number(currentOrderQuantity)) && !denomination),
										message: null,
									}}
									hideErrorMessage
								/>
							</S.FieldWrapper>
							{(props.type === 'list' || props.type === 'bid') && (
								<S.FieldWrapper>
									<FormField
										type={'number'}
										label={language.unitPrice}
										value={isNaN(Number(unitPrice)) ? '' : unitPrice}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUnitPriceInput(e)}
										disabled={!arProvider.walletAddress || Number(currentOrderQuantity) <= 0 || orderLoading}
										invalid={{
											status: Number(unitPrice) < 0 || (unitPrice && Number(unitPrice) <= MIN_PRICE),
											message: null,
										}}
										hideErrorMessage
										tooltip={
											props.type === 'bid'
												? 'Price per unit you are willing to pay.'
												: 'Price per unit you are listing your asset for.'
										}
									/>
								</S.FieldWrapper>
							)}
							{(props.type === 'list' || props.type === 'bid') && (
								<S.FieldWrapper>
									<TokenSelector showLabel={true} disabledTokens={[props.asset.data.id]} />
								</S.FieldWrapper>
							)}
							{(props.type === 'buy' || props.type === 'sell') && (
								<S.FieldWrapper>
									<TokenSelector showLabel={true} disabledTokens={[props.asset.data.id]} />
								</S.FieldWrapper>
							)}
							{props.type === 'transfer' && (
								<S.FieldWrapper>
									<FormField
										label={language.recipient}
										value={transferRecipient || ''}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRecipientInput(e)}
										disabled={!arProvider.walletAddress || orderLoading}
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
								{permawebProvider.tokenBalances &&
									getTotalTokenBalance(permawebProvider.tokenBalances[tokenProvider.selectedToken.id]) !== null &&
									insufficientBalance && (
										<S.MessageWrapper warning>
											<span>{language.insufficientBalance}</span>
										</S.MessageWrapper>
									)}
								{arProvider.wallet &&
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
								{(props.type === 'list' || props.type === 'bid') &&
									Number(unitPrice) > 0 &&
									Number(unitPrice) <= MIN_PRICE && (
										<S.MessageWrapper warning>
											<span>{language.priceTooLow}</span>
										</S.MessageWrapper>
									)}
								{props.asset && !props.asset.state?.transferable && (
									<S.MessageWrapper warning>
										<span>{language.nonTransferable}</span>
									</S.MessageWrapper>
								)}
								{hydratingTokens.length > 0 &&
									hydratingTokens.map((tokenId) => {
										const tokenInfo = TOKEN_REGISTRY[tokenId];
										const tokenName = tokenInfo ? tokenInfo.name : formatAddress(tokenId, false);
										const progress = hydrationProgress[tokenId] || 0;
										return (
											<S.MessageWrapper key={tokenId}>
												<span>
													Fetching Latest {tokenName}... ({progress}%)
												</span>
											</S.MessageWrapper>
										);
									})}
							</S.ActionWrapper>
						</S.FieldsWrapper>
					</S.FieldsFlexWrapper>
				</S.InputWrapper>
			</S.Wrapper>
			{showConfirmation && getOrderWindow()}
		</>
	) : null;
}
