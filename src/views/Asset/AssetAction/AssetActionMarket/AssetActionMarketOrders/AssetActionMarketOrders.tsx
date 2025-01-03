import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { createOrder } from '@permaweb/ucm';

import { messageResults, readHandler } from 'api';

import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { FormField } from 'components/atoms/FormField';
import { Notification } from 'components/atoms/Notification';
import { Slider } from 'components/atoms/Slider';
import { TxAddress } from 'components/atoms/TxAddress';
import { Modal } from 'components/molecules/Modal';
import { AO, ASSETS, REDIRECTS, URLS } from 'helpers/config';
import { AssetOrderType, OrderbookEntryType } from 'helpers/types';
import {
	checkValidAddress,
	formatAddress,
	formatCount,
	formatPercentage,
	getTotalTokenBalance,
	reverseDenomination,
} from 'helpers/utils';
import * as windowUtils from 'helpers/window';
import { useAppProvider } from 'providers/AppProvider';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';
import * as streakActions from 'store/streaks/actions';
import * as ucmActions from 'store/ucm/actions';

import * as S from './styles';
import { IProps } from './types';

const MIN_PRICE = 0.000001;

export default function AssetActionMarketOrders(props: IProps) {
	const dispatch = useDispatch();

	const appProvider = useAppProvider();
	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);
	const ucmReducer = useSelector((state: RootState) => state.ucmReducer);

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

	// Active after an order is completed and asset is refreshed
	const [updating, setUpdating] = React.useState<boolean>(false);

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

					if (arProvider.walletAddress && arProvider.profile && arProvider.profile.id) {
						const profileBalance = Number(props.asset.state.balances[arProvider.profile.id]);
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

			if (props.asset.orders && props.asset.orders.length > 0) {
				const salesBalances = props.asset.orders.map((order: AssetOrderType) => {
					return Number(order.quantity);
				});

				const totalSalesBalance = salesBalances.reduce((a: number, b: number) => a + b, 0);

				let calculatedTotalSalesBalance = totalSalesBalance;

				if (denomination) calculatedTotalSalesBalance = totalSalesBalance / denomination;

				setTotalSalesQuantity(calculatedTotalSalesBalance);
			}

			const orderCurrency =
				props.asset.orders && props.asset.orders.length ? props.asset.orders[0].currency : AO.defaultToken;
			if (
				currenciesReducer &&
				currenciesReducer[orderCurrency] &&
				currenciesReducer[orderCurrency].Denomination &&
				currenciesReducer[orderCurrency].Denomination > 1
			) {
				setTransferDenomination(Math.pow(10, currenciesReducer[orderCurrency].Denomination));
			}
		}
	}, [props.asset, arProvider.walletAddress, arProvider.profile, denomination, ucmReducer]);

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
			if (!arProvider.tokenBalances || !arProvider.tokenBalances[AO.defaultToken]) {
				setInsufficientBalance(true);
			} else {
				let orderAmount = BigInt(getTotalOrderAmount());
				if (denomination) {
					orderAmount = BigInt(orderAmount) / BigInt(denomination);
				}
				setInsufficientBalance(Number(getTotalTokenBalance(arProvider.tokenBalances[AO.defaultToken])) < orderAmount);
			}
		} else {
			setInsufficientBalance(false);
		}
	}, [arProvider.tokenBalances, props.type, props.asset, currentOrderQuantity, denomination]);

	React.useEffect(() => {
		if (currentOrderQuantity) setCurrentOrderQuantity('');
	}, [props.type]);

	function getTransferQuantity() {
		let transferQuantity = currentOrderQuantity;

		switch (props.type) {
			case 'buy':
				transferQuantity = getTotalOrderAmount().toString();
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
					processId = AO.defaultToken;
					profileBalance = BigInt(arProvider.tokenBalances[AO.defaultToken].profileBalance);
					walletBalance = BigInt(arProvider.tokenBalances[AO.defaultToken].walletBalance);
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
					console.log(`Transferring remainder from wallet balance: ${differenceNeeded.toString()} to profile`);
					await messageResults({
						processId: processId,
						action: 'Transfer',
						wallet: arProvider.wallet,
						tags: [
							{ name: 'Quantity', value: differenceNeeded.toString() },
							{ name: 'Recipient', value: arProvider.profile.id },
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

	async function handleSubmit() {
		if (props.asset && arProvider.wallet && arProvider.profile?.id) {
			try {
				setOrderLoading(true);
				setCurrentNotification('Transferring balance from wallet to profile...');
				await handleWalletToProfileTransfer();
			} catch (e: any) {
				setOrderLoading(false);
				setCurrentNotification(e);
				setOrderProcessed(true);
			}

			const transferQuantity = getTransferQuantity().toString();
			const unitPrice = getUnitPrice()?.toString();

			let dominantToken = null;
			let swapToken = null;

			// TODO: Handle transfer
			switch (props.type) {
				case 'buy':
					dominantToken = AO.defaultToken;
					swapToken = props.asset.data.id;
					break;
				case 'sell':
					dominantToken = props.asset.data.id;
					swapToken = AO.defaultToken;
					break;
				default:
					break;
			}

			try {
				const orderId = await createOrder(
					{
						orderbookId: AO.ucm,
						profileId: arProvider.profile.id,
						dominantToken: dominantToken,
						swapToken: swapToken,
						quantity: transferQuantity,
						unitPrice: unitPrice,
						denomination: denomination,
					},
					arProvider.wallet,
					(args: { processing: boolean; success: boolean; message: string }) => {
						setOrderLoading(args.processing);
						setOrderProcessed(!args.processing);
						setOrderSuccess(args.success);
						setCurrentNotification(args.message);
					}
				);

				setOrderId(orderId);

				// await handleAssetUpdate(localSuccess); // TODO
			} catch (e: any) {
				setOrderLoading(false);
				setOrderProcessed(true);
				setOrderSuccess(false);
				setCurrentNotification(e.message ?? 'Error creating order in UCM');
			}
		} else {
			setOrderLoading(false);
			setOrderProcessed(true);
			setOrderSuccess(false);
			setCurrentNotification('Invalid order details');
		}
	}

	// async function handleSubmit() {
	// 	if (props.asset && arProvider.wallet && arProvider.profile && arProvider.profile.id) {
	// 		let pair = null;
	// 		let forwardedTags = null;
	// 		let recipient = null;
	// 		let localSuccess = false;
	// 		let initialMessage = null;

	// 		switch (props.type) {
	// 			case 'buy':
	// 				pair = [AO.defaultToken, props.asset.data.id];
	// 				recipient = AO.ucm;
	// 				initialMessage = 'Depositing balance...';
	// 				break;
	// 			case 'sell':
	// 				pair = [props.asset.data.id, AO.defaultToken];
	// 				recipient = AO.ucm;
	// 				initialMessage = 'Depositing balance...';
	// 				break;
	// 			case 'transfer':
	// 				pair = [props.asset.data.id, AO.defaultToken];
	// 				recipient = transferRecipient;
	// 				initialMessage = 'Transferring balance...';
	// 				break;
	// 		}

	// 		if (pair && recipient) {
	// 			const dominantToken = pair[0];
	// 			const swapToken = pair[1];

	// 			let transferQuantity: string | number = currentOrderQuantity;

	// 			switch (props.type) {
	// 				case 'buy':
	// 					transferQuantity = getTotalOrderAmount().toString();
	// 					if (denomination) {
	// 						transferQuantity = (BigInt(transferQuantity) / BigInt(denomination)).toString();
	// 					}
	// 					break;
	// 				case 'sell':
	// 				case 'transfer':
	// 					if (denomination) {
	// 						transferQuantity = Math.floor(Number(currentOrderQuantity) * denomination);
	// 					}
	// 					break;
	// 			}

	// 			transferQuantity = transferQuantity.toString();

	// 			switch (props.type) {
	// 				case 'buy':
	// 				case 'sell':
	// 					forwardedTags = [
	// 						{ name: 'X-Order-Action', value: 'Create-Order' },
	// 						{ name: 'X-Dominant-Token', value: dominantToken },
	// 						{ name: 'X-Swap-Token', value: swapToken },
	// 					];
	// 					if (unitPrice && Number(unitPrice) > 0) {
	// 						let calculatedUnitPrice = unitPrice as any;
	// 						if (transferDenomination) {
	// 							const decimalPlaces = (unitPrice.toString().split('.')[1] || '').length;
	// 							const updatedUnitPrice =
	// 								decimalPlaces >= reverseDenomination(transferDenomination)
	// 									? (unitPrice as any).toFixed(reverseDenomination(transferDenomination))
	// 									: unitPrice;
	// 							calculatedUnitPrice = BigInt(Math.floor(Number(updatedUnitPrice) * transferDenomination));
	// 						}

	// 						forwardedTags.push({ name: 'X-Price', value: calculatedUnitPrice.toString() });
	// 					}
	// 					if (denomination && denomination > 1) {
	// 						forwardedTags.push({ name: 'X-Transfer-Denomination', value: denomination.toString() });
	// 					}
	// 					break;
	// 				case 'transfer':
	// 					break;
	// 			}

	// 			const transferTags = [
	// 				{ name: 'Target', value: dominantToken },
	// 				{ name: 'Recipient', value: recipient },
	// 				{ name: 'Quantity', value: transferQuantity },
	// 			];

	// 			if (forwardedTags) transferTags.push(...forwardedTags);

	// 			setOrderLoading(true);

	// 			try {
	// 				setCurrentNotification(initialMessage);

	// 				let processId: string;
	// 				let profileBalance: bigint = BigInt(0);
	// 				let walletBalance: bigint = BigInt(0);

	// 				switch (props.type) {
	// 					case 'buy':
	// 						processId = AO.defaultToken;
	// 						profileBalance = BigInt(arProvider.tokenBalances[AO.defaultToken].profileBalance);
	// 						walletBalance = BigInt(arProvider.tokenBalances[AO.defaultToken].walletBalance);
	// 						break;
	// 					case 'sell':
	// 					case 'transfer':
	// 						processId = props.asset.data.id;

	// 						if (connectedBalance)
	// 							profileBalance = BigInt(denomination ? Math.floor(connectedBalance * denomination) : connectedBalance);
	// 						if (connectedWalletBalance)
	// 							walletBalance = BigInt(
	// 								denomination ? Math.floor(connectedWalletBalance * denomination) : connectedWalletBalance
	// 							);
	// 						break;
	// 				}

	// 				if (profileBalance < BigInt(transferQuantity)) {
	// 					const differenceNeeded = BigInt(transferQuantity) - profileBalance;

	// 					if (walletBalance < differenceNeeded) {
	// 						console.error(`Wallet balance is less than difference needed: ${differenceNeeded}`);
	// 						console.error(`Wallet balance: ${walletBalance}`);

	// 						setCurrentNotification('Error executing transfer');
	// 						setOrderLoading(false);
	// 						setOrderProcessed(true);
	// 						return;
	// 					} else {
	// 						console.log(`Transferring remainder from wallet balance: ${differenceNeeded.toString()} to profile`);
	// 						await messageResults({
	// 							processId: processId,
	// 							action: 'Transfer',
	// 							wallet: arProvider.wallet,
	// 							tags: [
	// 								{ name: 'Quantity', value: differenceNeeded.toString() },
	// 								{ name: 'Recipient', value: arProvider.profile.id },
	// 							],
	// 							data: null,
	// 							responses: ['Transfer-Success', 'Transfer-Error'],
	// 						});
	// 					}
	// 				}

	// 				const response: any = await messageResults({
	// 					processId: arProvider.profile.id,
	// 					action: 'Transfer',
	// 					wallet: arProvider.wallet,
	// 					tags: transferTags,
	// 					data: null,
	// 					responses: ['Transfer-Success', 'Transfer-Error'],
	// 					handler: 'Create-Order',
	// 				});

	// 				if (response) {
	// 					if (response['Transfer-Success'])
	// 						setCurrentNotification(response['Transfer-Success'].message || 'Balance transferred!');
	// 					switch (props.type) {
	// 						case 'buy':
	// 						case 'sell':
	// 							setCurrentNotification(
	// 								response['Action-Response'] && response['Action-Response'].message
	// 									? response['Action-Response'].message
	// 									: 'Order created!'
	// 							);
	// 							setOrderSuccess(true);
	// 							localSuccess = true;
	// 							break;
	// 						case 'transfer':
	// 							setOrderSuccess(true);
	// 							setOrderProcessed(true);
	// 							setCurrentNotification('Balance transferred!');
	// 							break;
	// 					}
	// 				} else {
	// 					setCurrentNotification('Error depositing funds');
	// 				}
	// 			} catch (e: any) {
	// 				setCurrentNotification(e.message || 'Error creating order');
	// 			}

	// 			setOrderLoading(false);
	// 			setOrderProcessed(true);

	// 			await handleAssetUpdate(localSuccess);
	// 		} else {
	// 			setCurrentNotification('Invalid order details');
	// 		}
	// 	}
	// }

	async function handleAssetUpdate(handleUpdate: boolean) {
		if (handleUpdate) {
			setCurrentOrderQuantity('');
			setUnitPrice(0);
			setTransferRecipient('');
			setCurrentNotification(null);
			setOrderProcessed(false);
			setShowConfirmation(false);
			setUpdating(true);
			windowUtils.scrollTo(0, 0, 'smooth');

			arProvider.setToggleProfileUpdate(!arProvider.toggleProfileUpdate);

			if (props.type !== 'transfer') {
				try {
					const existingUCM = { ...ucmReducer };

					if (existingUCM && existingUCM.Orderbook && existingUCM.Orderbook.length) {
						let pair = [props.asset.data.id, AO.defaultToken];

						const currentEntry = existingUCM.Orderbook.find(
							(entry: OrderbookEntryType) => JSON.stringify(entry.Pair) === JSON.stringify(pair)
						);

						if (currentEntry && currentEntry.Orders) {
							const fetchUntilChange = async () => {
								let changeDetected = false;
								let tries = 0;
								const maxTries = 10;

								await new Promise((resolve) => setTimeout(resolve, 1000));

								while (!changeDetected && tries < maxTries) {
									const ucmState = await readHandler({
										processId: AO.ucm,
										action: 'Info',
									});

									const currentStateEntry = ucmState.Orderbook.find(
										(entry: OrderbookEntryType) => JSON.stringify(entry.Pair) === JSON.stringify(pair)
									);

									if (JSON.stringify(currentEntry) !== JSON.stringify(currentStateEntry)) {
										dispatch(ucmActions.setUCM(ucmState));
										changeDetected = true;
									} else {
										await new Promise((resolve) => setTimeout(resolve, 1000));
										tries++;
									}
								}

								if (!changeDetected) {
									console.warn(`No changes detected after ${maxTries} attempts`);
								}
							};

							await fetchUntilChange();
						}
					}
				} catch (e: any) {
					console.error(e);
				}
			}

			if (props.type === 'buy') {
				const streaks = await readHandler({
					processId: AO.pixl,
					action: 'Get-Streaks',
				});
				dispatch(streakActions.setStreaks(streaks.Streaks));
			}

			arProvider.setToggleTokenBalanceUpdate(!arProvider.toggleTokenBalanceUpdate);
			props.toggleUpdate();

			setUpdating(false);
		}
	}

	function handleOrderErrorClose() {
		setShowConfirmation(false);
		setOrderProcessed(false);
		setCurrentOrderQuantity('');
		setUnitPrice(0);
		setTransferRecipient('');
		setCurrentNotification(null);
		windowUtils.scrollTo(0, 0, 'smooth');
	}

	function getTotalOrderAmount() {
		if (props.type === 'buy') {
			if (props.asset && props.asset.orders) {
				let sortedOrders = props.asset.orders.sort(
					(a: AssetOrderType, b: AssetOrderType) => Number(a.price) - Number(b.price)
				);

				let totalQuantity: bigint = BigInt(0);
				let totalPrice: bigint = BigInt(0);

				for (let i = 0; i < sortedOrders.length; i++) {
					const quantity = BigInt(Math.floor(Number(sortedOrders[i].quantity)));
					const price = BigInt(Math.floor(Number(sortedOrders[i].price)));

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
		} else {
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
		if (!arProvider.profile || !arProvider.profile.id) return true;
		if (appProvider.ucm.updating) return true;
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
	}, [props.asset, props.type, totalAssetBalance, totalSalesQuantity, connectedBalance, ucmReducer]);

	function getTotalPriceDisplay() {
		let amount = BigInt(getTotalOrderAmount());
		if (denomination && denomination > 1) amount = BigInt(amount) / BigInt(denomination);
		const orderCurrency =
			props.asset.orders && props.asset.orders.length ? props.asset.orders[0].currency : AO.defaultToken;
		return <CurrencyLine amount={amount ? amount.toString() : '0'} currency={orderCurrency} />;
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
			if (orderSuccess) label = `${language.complete}!`;
			else label = language.error;
		}

		let action: () => void;
		if (orderProcessed) {
			if (orderSuccess) action = () => handleAssetUpdate(orderSuccess);
			else action = () => setShowConfirmation(false);
		} else if (finalizeOrder) action = () => handleSubmit();
		else action = () => setShowConfirmation(true);

		return (
			<>
				<Button
					type={'alt1'}
					label={label}
					handlePress={action}
					disabled={getActionDisabled()}
					loading={false}
					height={60}
					fullWidth={true}
					icon={icon}
					iconLeftAlign
				/>
			</>
		);
	}

	function getOrderWindow() {
		let header: string | null = null;
		let footer: React.ReactNode | null = null;

		switch (props.type) {
			case 'buy':
				header = language.confirmPurchase;
				break;
			case 'sell':
				header = language.confirmListing;
				footer = (
					<p>
						{language.sellerFee}{' '}
						<Link to={URLS.docs} target={'_blank'}>
							{language.learnMore}
						</Link>
					</p>
				);
				break;
			case 'transfer':
				header = language.confirmTransfer;
				break;
		}

		// TODO: Language
		return (
			<Modal
				header={header}
				handleClose={() => (orderProcessed && orderSuccess ? handleAssetUpdate(orderSuccess) : handleOrderErrorClose())}
			>
				<S.ConfirmationWrapper className={'modal-wrapper'}>
					<S.ConfirmationHeader>
						<p>{props.asset.data.title}</p>
					</S.ConfirmationHeader>
					{getOrderDetails(true)}
					<S.ConfirmationDetails className={'border-wrapper-primary'}>
						<S.ConfirmationDetailsHeader>
							<p>Order Confirmation Details</p>
						</S.ConfirmationDetailsHeader>
						<S.ConfirmationDetailsLineWrapper>
							{orderId ? (
								<S.ConfirmationDetailsFlex>
									<S.ConfirmationDetailsLine>
										<p>Order ID: </p>
										<TxAddress address={orderId} wrap={false} />
									</S.ConfirmationDetailsLine>
									<Button
										type={'alt2'}
										label={'View'}
										handlePress={() => window.open(REDIRECTS.aoLink(orderId), '_blank')}
									/>
								</S.ConfirmationDetailsFlex>
							) : (
								<p>Information related to your order will show here</p>
							)}
						</S.ConfirmationDetailsLineWrapper>
					</S.ConfirmationDetails>
					<S.Divider />
					<S.ActionWrapperFull loading={orderLoading.toString()}>{getAction(true)}</S.ActionWrapperFull>
					<S.ConfirmationMessage>
						<span>
							{currentNotification ? currentNotification : orderLoading ? 'Processing...' : language.reviewOrderDetails}
						</span>
					</S.ConfirmationMessage>
					{footer && <S.ConfirmationFooter>{footer}</S.ConfirmationFooter>}
				</S.ConfirmationWrapper>
			</Modal>
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
							!arProvider.profile ||
							!arProvider.profile.id ||
							maxOrderQuantity <= 0 ||
							appProvider.ucm.updating ||
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
								!arProvider.profile ||
								!arProvider.profile.id ||
								appProvider.ucm.updating ||
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
										!arProvider.profile ||
										!arProvider.profile.id ||
										appProvider.ucm.updating ||
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
											!arProvider.profile ||
											!arProvider.profile.id ||
											Number(currentOrderQuantity) <= 0 ||
											appProvider.ucm.updating ||
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
							{props.type === 'transfer' && (
								<S.FieldWrapper>
									<FormField
										label={language.recipient}
										value={transferRecipient || ''}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRecipientInput(e)}
										disabled={
											!arProvider.walletAddress ||
											!arProvider.profile ||
											!arProvider.profile.id ||
											orderLoading ||
											appProvider.ucm.updating
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
								{!arProvider.profile ||
									(!arProvider.profile.id && (
										<S.MessageWrapper>
											<span>{language.createProfileToContinue}</span>
										</S.MessageWrapper>
									))}
								{appProvider.ucm.updating && (
									<S.MessageWrapper className={'update-wrapper'}>
										<span>{`${language.ordersUpdating}...`}</span>
									</S.MessageWrapper>
								)}
								{arProvider.tokenBalances &&
									getTotalTokenBalance(arProvider.tokenBalances[AO.defaultToken]) !== null &&
									insufficientBalance && (
										<S.MessageWrapper warning>
											<span>{language.insufficientBalance}</span>
										</S.MessageWrapper>
									)}
								{!Number.isInteger(Number(currentOrderQuantity)) && !denomination && (
									<S.MessageWrapper warning>
										<span>{language.quantityMustBeInteger}</span>
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
			{updating && (
				<Notification message={`${language.fetchingAsset}...`} type={'success'} callback={() => setUpdating(false)} />
			)}
		</>
	) : null;
}
