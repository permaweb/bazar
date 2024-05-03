import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { messageResults, readHandler } from 'api';

import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { FormField } from 'components/atoms/FormField';
import { IconButton } from 'components/atoms/IconButton';
import { Notification } from 'components/atoms/Notification';
import { Slider } from 'components/atoms/Slider';
import { Modal } from 'components/molecules/Modal';
import { ASSETS, PROCESSES } from 'helpers/config';
import { AssetOrderType } from 'helpers/types';
import { checkValidAddress, formatCount, formatPercentage } from 'helpers/utils';
import * as windowUtils from 'helpers/window';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';
import * as currencyActions from 'store/currencies/actions';
import * as ucmActions from 'store/ucm/actions';

import * as S from './styles';
import { IProps } from './types';

// TODO: orders from profile
export default function AssetActionMarketOrders(props: IProps) {
	const dispatch = useDispatch();

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

	// Total asset quantity available for order creation, based on order type (buy, sell, or transfer)
	const [currentOrderQuantity, setCurrentOrderQuantity] = React.useState<number>(0);

	// Total asset quantity available for order creation, based on order type (buy, sell, or transfer)
	const [maxOrderQuantity, setMaxOrderQuantity] = React.useState<number>(0);

	// The token transfer recipient if the action is only a transfer and not an order creation
	const [transferRecipient, setTransferRecipient] = React.useState<string>('');

	// The number of the token that should be treated as a single unit when quantities and balances are displayed
	const [denomination, setDenomination] = React.useState<number | null>(null);

	// The number of the transfer token that should be treated as a single unit when quantities and balances are displayed
	const [transferDenomination, setTransferDenomination] = React.useState<number | null>(null);

	// Price on limit orders for quantity of one transfer token
	const [unitPrice, setUnitPrice] = React.useState<number>(0);

	// Active after an order is completed and asset is refreshed
	const [updating, setUpdating] = React.useState<boolean>(false);

	const [orderLoading, setOrderLoading] = React.useState<boolean>(false);
	const [orderProcessed, setOrderProcessed] = React.useState<boolean>(false);
	const [orderSuccess, setOrderSuccess] = React.useState<boolean>(false);
	const [showConfirmation, setShowConfirmation] = React.useState<boolean>(false);
	const [currentNotification, setCurrentNotification] = React.useState<string | null>(null);

	const insufficientBalance =
		arProvider.walletAddress &&
		arProvider.profile &&
		arProvider.profile.id &&
		props.type === 'buy' &&
		Number(getTokenBalance(PROCESSES.token)) < getTotalPrice();

	React.useEffect(() => {
		if (props.asset) {
			if (props.asset.state) {
				if (!denomination && props.asset.state.denomination && Number(props.asset.state.denomination) > 1) {
					setDenomination(Math.pow(10, props.asset.state.denomination));
				}

				const balances: any = Object.keys(props.asset.state.balances).map((address: string) => {
					return Number(props.asset.state.balances[address]);
				});

				const totalBalance = balances.reduce((a: number, b: number) => a + b, 0);

				let calculatedTotalBalance = totalBalance;
				if (denomination) calculatedTotalBalance = totalBalance / denomination;

				setTotalAssetBalance(calculatedTotalBalance);

				if (arProvider.walletAddress && arProvider.profile && arProvider.profile.id) {
					const ownerBalance = Number(props.asset.state.balances[arProvider.profile.id]);
					if (ownerBalance) {
						let calculatedOwnerBalance = ownerBalance;
						if (denomination) calculatedOwnerBalance = ownerBalance / denomination;

						setConnectedBalance(calculatedOwnerBalance);
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
				props.asset.orders && props.asset.orders.length ? props.asset.orders[0].currency : PROCESSES.token;
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
				setMaxOrderQuantity(connectedBalance);
				break;
			case 'transfer':
				setMaxOrderQuantity(connectedBalance);
				break;
		}
	}, [props.asset, props.type, connectedBalance, totalSalesQuantity]);

	React.useEffect(() => {
		setCurrentOrderQuantity(0);
	}, [props.type]);

	async function handleSubmit() {
		if (props.asset && arProvider.wallet && arProvider.profile && arProvider.profile.id) {
			let orderPair = null;
			let orderTags = null;
			let recipient = null;
			let localSuccess = false;

			switch (props.type) {
				case 'buy':
					orderPair = [PROCESSES.token, props.asset.data.id];
					recipient = PROCESSES.ucm;
					break;
				case 'sell':
					orderPair = [props.asset.data.id, PROCESSES.token];
					recipient = PROCESSES.ucm;
					break;
				case 'transfer':
					orderPair = [props.asset.data.id, PROCESSES.token];
					recipient = transferRecipient;
					break;
			}

			if (orderPair && recipient) {
				const dominantToken = orderPair[0];
				const swapToken = orderPair[1];

				let calculatedQuantity: string | number = currentOrderQuantity;
				if (props.type === 'sell' || props.type === 'transfer') {
					if (denomination) calculatedQuantity = currentOrderQuantity * denomination;
				}
				if (props.type === 'buy') {
					calculatedQuantity = getTotalPrice();
				}
				calculatedQuantity = calculatedQuantity.toString();

				if (props.type === 'buy' || props.type === 'sell') {
					orderTags = [
						{ name: 'X-Order-Action', value: 'Create-Order' },
						{ name: 'X-Quantity', value: calculatedQuantity },
						{ name: 'X-Swap-Token', value: swapToken },
					];
					if (unitPrice && unitPrice > 0) {
						let calculatedUnitPrice: string | number = unitPrice;
						if (transferDenomination) calculatedUnitPrice = unitPrice * transferDenomination;
						calculatedUnitPrice = calculatedUnitPrice.toString();
						orderTags.push({ name: 'X-Price', value: calculatedUnitPrice });
					}
				}

				setOrderLoading(true);
				try {
					setCurrentNotification('Depositing balance...');

					const transferResponse: any = await messageResults({
						processId: arProvider.profile.id,
						action: 'Transfer',
						wallet: arProvider.wallet,
						tags: orderTags,
						data: {
							Target: dominantToken,
							Recipient: recipient,
							Quantity: calculatedQuantity,
						},
					});

					if (transferResponse) {
						if (transferResponse['Transfer-Success']) {
							setCurrentNotification(transferResponse['Transfer-Success'].message || 'Deposited funds');
							switch (props.type) {
								case 'buy':
								case 'sell':
									console.log('execute buy / sell order');
									break;
								case 'transfer':
									setOrderSuccess(true);
									break;
							}
						} else if (transferResponse['Transfer-Error']) {
							setCurrentNotification(transferResponse['Transfer-Error'].message || 'Error depositing funds');
						} else {
							setCurrentNotification('Error depositing funds');
						}
					} else {
						setCurrentNotification('Error depositing funds');
					}

					// if (transferResponse && transferResponse['Credit-Notice'] && transferResponse['Debit-Notice']) {
					// 	setOrderSuccess(true);
					// 	setCurrentNotification(transferResponse['Credit-Notice'].message);

					// 	if (props.type === 'transfer') {
					// 		if (transferResponse['Transfer-Error']) {
					// 			setCurrentNotification(transferResponse['Transfer-Error'].message);
					// 		}
					// 	} else {
					// 		const validCreditNotice =
					// 			transferResponse['Debit-Notice'] &&
					// 			transferResponse['Credit-Notice'] &&
					// 			transferResponse['Credit-Notice'].status === 'Success';

					// 		if (validCreditNotice) {
					// 			const depositTxId = transferResponse['Credit-Notice'].id;

					// 			setCurrentNotification('Checking deposit status...');
					// 			let depositCheckResponse: any = await messageResult({
					// 				processId: PROCESSES.ucm,
					// 				action: 'Check-Deposit-Status',
					// 				wallet: arProvider.wallet,
					// 				data: {
					// 					Pair: orderPair,
					// 					DepositTxId: depositTxId,
					// 					Quantity: calculatedQuantity,
					// 				},
					// 			});

					// 			if (depositCheckResponse['Deposit-Status-Evaluated']) {
					// 				setCurrentNotification(depositCheckResponse.message);
					// 			}

					// 			if (depositCheckResponse && depositCheckResponse['Deposit-Status-Evaluated']) {
					// 				const MAX_DEPOSIT_CHECK_RETRIES = 10;

					// 				let depositStatus = depositCheckResponse['Deposit-Status-Evaluated'].status;
					// 				let retryCount = 0;

					// 				while (depositStatus === 'Error' && retryCount < MAX_DEPOSIT_CHECK_RETRIES) {
					// 					await new Promise((r) => setTimeout(r, 1000));
					// 					depositCheckResponse = await messageResult({
					// 						processId: PROCESSES.ucm,
					// 						action: 'Check-Deposit-Status',
					// 						wallet: arProvider.wallet,
					// 						data: {
					// 							Pair: orderPair,
					// 							DepositTxId: depositTxId,
					// 							Quantity: calculatedQuantity,
					// 						},
					// 					});

					// 					if (depositCheckResponse['Deposit-Status-Evaluated']) {
					// 						setCurrentNotification(depositCheckResponse.message);
					// 					}

					// 					depositStatus = depositCheckResponse['Deposit-Status-Evaluated'].status;
					// 					retryCount++;
					// 				}

					// 				if (depositStatus === 'Success') {
					// 					setCurrentNotification('Creating order...');
					// 					const orderData: { Pair: string[]; DepositTxId: string; Quantity: string; Price?: string } = {
					// 						Pair: orderPair,
					// 						DepositTxId: depositTxId,
					// 						Quantity: calculatedQuantity,
					// 					};

					// 					const createOrderResponse: any = await messageResult({
					// 						processId: PROCESSES.ucm,
					// 						action: 'Create-Order',
					// 						wallet: arProvider.wallet,
					// 						data: orderData,
					// 					});

					// 					if (createOrderResponse) {
					// 						if (createOrderResponse['Order-Success']) {
					// 							localSuccess = true;
					// 							setCurrentNotification(`${createOrderResponse['Order-Success'].message}!`);
					// 						}
					// 						if (createOrderResponse['Order-Error']) {
					// 							setCurrentNotification(createOrderResponse['Order-Error'].message);
					// 							setOrderSuccess(false);
					// 						}
					// 					} else {
					// 						setCurrentNotification('Error creating order');
					// 						setOrderSuccess(false);
					// 					}
					// 				} else {
					// 					setCurrentNotification('Failed to resolve deposit');
					// 					setOrderSuccess(false);
					// 				}
					// 			} else {
					// 				setCurrentNotification('Failed to check deposit status');
					// 				setOrderSuccess(false);
					// 			}
					// 		} else {
					// 			setCurrentNotification('Invalid credit notice');
					// 			setOrderSuccess(false);
					// 		}
					// 	}
					// } else {
					// 	setCurrentNotification('Failed to execute deposit');
					// 	setOrderSuccess(false);
					// }
				} catch (e: any) {
					setCurrentNotification(e.message || 'Error creating order');
				}

				setOrderLoading(false);
				setOrderProcessed(true);

				await new Promise((r) => setTimeout(r, 1000));
				await handleAssetUpdate(localSuccess);
			} else {
				setCurrentNotification('Invalid order details');
			}
		}
	}

	function handleQuantityInput(e: React.ChangeEvent<HTMLInputElement>) {
		if (e.target.value === '' || parseFloat(e.target.value) < 0) {
			setCurrentOrderQuantity(0);
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

	const handleRecipientPaste = async () => {
		if (!navigator.clipboard || !navigator.clipboard.readText) {
			console.error('Clipboard API not supported');
			return;
		}
		try {
			const clipboardText = await navigator.clipboard.readText();
			setTransferRecipient(clipboardText);
		} catch (error) {
			console.error(error);
		}
	};

	function getTokenBalance(tokenProcess: string) {
		if (
			arProvider.walletAddress &&
			arProvider.profile &&
			arProvider.profile.id &&
			currenciesReducer &&
			currenciesReducer[tokenProcess] &&
			currenciesReducer[tokenProcess].Balances[arProvider.profile.id]
		) {
			const ownerBalance = currenciesReducer[tokenProcess].Balances[arProvider.profile.id];
			return ownerBalance.toString();
		}
		return 0;
	}

	function getTotals() {
		let balanceHeader: string | null = null;
		let percentageHeader: string | null = null;
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
				quantity = connectedBalance;
				break;
			case 'transfer':
				balanceHeader = language.totalTransferBalanceAvailable;
				percentageHeader = language.totalTransferPercentageAvailable;
				quantity = connectedBalance;
				break;
		}

		return (
			<>
				<S.TotalQuantityLine>
					<p>
						{`${balanceHeader}: `}
						<span>{formatCount(quantity.toString())}</span>
					</p>
				</S.TotalQuantityLine>
				<S.TotalQuantityLine>
					<p>
						{`${percentageHeader}: `}
						<span>{formatPercentage(quantity / totalAssetBalance)}</span>
					</p>
				</S.TotalQuantityLine>
			</>
		);
	}

	function getTotalPrice() {
		if (props.type === 'buy') {
			if (props.asset && props.asset.orders) {
				let sortedOrders = props.asset.orders.sort(
					(a: AssetOrderType, b: AssetOrderType) => Number(a.price) - Number(b.price)
				);
				let totalQuantity = 0;
				let totalPrice = 0;

				for (let i = 0; i < sortedOrders.length; i++) {
					const order = sortedOrders[i];
					const quantity = Number(order.quantity);
					const price = Number(order.price);

					let assetQuantity = currentOrderQuantity;
					if (denomination) assetQuantity = currentOrderQuantity * denomination;

					if (quantity >= assetQuantity - totalQuantity) {
						const remainingQty = assetQuantity - totalQuantity;

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
			let price: number;
			if (isNaN(unitPrice) || isNaN(currentOrderQuantity) || currentOrderQuantity < 0 || unitPrice < 0) {
				price = 0;
			} else {
				let calculatedUnitPrice = unitPrice;
				if (transferDenomination) calculatedUnitPrice = unitPrice * transferDenomination;
				price = currentOrderQuantity * calculatedUnitPrice;
			}
			return price;
		}
	}

	function getTotalPriceDisplay() {
		const orderCurrency =
			props.asset.orders && props.asset.orders.length ? props.asset.orders[0].currency : PROCESSES.token;
		return <CurrencyLine amount={getTotalPrice() || '0'} currency={orderCurrency} />;
	}

	function getOrderDetails() {
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
			<>
				<S.SalesLine>
					<S.SalesDetail>
						<span>{quantityLabel}</span>
						<p>{formatCount(currentOrderQuantity.toString())}</p>
					</S.SalesDetail>
					<S.SalesDetail>
						<span>{percentageLabel}</span>
						<p>{formatPercentage(currentOrderQuantity / totalAssetBalance)}</p>
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
			</>
		);
	}

	function getActionDisabled() {
		if (!arProvider.walletAddress) return true;
		if (!arProvider.profile || !arProvider.profile.id) return true;
		if (orderLoading) return true;
		if (orderProcessed && !orderSuccess) return true;
		if (maxOrderQuantity <= 0 || isNaN(currentOrderQuantity)) return true;
		if (currentOrderQuantity <= 0 || isNaN(maxOrderQuantity) || !Number.isInteger(Number(currentOrderQuantity)))
			return true;
		if (currentOrderQuantity > maxOrderQuantity) return true;
		if (props.type === 'sell' && (unitPrice <= 0 || isNaN(unitPrice))) return true;
		if (props.type === 'transfer' && (!transferRecipient || !checkValidAddress(transferRecipient))) return true;
		if (insufficientBalance) return true;
		return false;
	}

	async function handleAssetUpdate(handleUpdate: boolean) {
		if (handleUpdate) {
			setCurrentOrderQuantity(0);
			setUnitPrice(0);
			setTransferRecipient('');
			setCurrentNotification(null);
			setOrderProcessed(false);
			setShowConfirmation(false);
			setUpdating(true);
			windowUtils.scrollTo(0, 0, 'smooth');
			try {
				const ucmState = await readHandler({
					processId: PROCESSES.ucm,
					action: 'Info',
				});
				dispatch(ucmActions.setUCM(ucmState));

				const orderCurrency =
					props.asset.orders && props.asset.orders.length ? props.asset.orders[0].currency : PROCESSES.token;
				const tokenState = await readHandler({
					processId: orderCurrency,
					action: 'Info',
				});
				dispatch(
					currencyActions.setCurrencies({
						[orderCurrency]: {
							...tokenState,
						},
					})
				);
			} catch (e: any) {
				console.error(e);
			}
			setUpdating(false);
		}
	}

	function handleOrderErrorClose() {
		setShowConfirmation(false);
		setOrderProcessed(false);
		setCurrentOrderQuantity(0);
		setUnitPrice(0);
		setTransferRecipient('');
		setCurrentNotification(null);
		windowUtils.scrollTo(0, 0, 'smooth');
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
					type={'primary'}
					label={label}
					handlePress={action}
					disabled={getActionDisabled()}
					loading={false}
					height={60}
					width={350}
					fullWidth={finalizeOrder}
					icon={icon}
					iconLeftAlign
				/>
			</>
		);
	}

	function getConfirmation() {
		let header: string | null = null;

		switch (props.type) {
			case 'buy':
				header = language.confirmPurchase;
				break;
			case 'sell':
				header = language.confirmListing;
				break;
			case 'transfer':
				header = language.confirmTransfer;
				break;
		}

		return (
			<Modal
				header={`${header}: ${props.asset.data.title}`}
				handleClose={() => (orderProcessed && orderSuccess ? handleAssetUpdate(orderSuccess) : handleOrderErrorClose())}
			>
				<S.ConfirmationWrapper className={'modal-wrapper'}>
					<S.SalesWrapper>{getOrderDetails()}</S.SalesWrapper>
					<S.ActionWrapperFull loading={orderLoading.toString() || null}>{getAction(true)}</S.ActionWrapperFull>
					<S.ConfirmationMessage>
						<p>
							{currentNotification ? currentNotification : orderLoading ? 'Processing...' : language.reviewOrderDetails}
						</p>
					</S.ConfirmationMessage>
				</S.ConfirmationWrapper>
			</Modal>
		);
	}

	return props.asset ? (
		<>
			<S.Wrapper>
				<S.TotalsWrapper>
					<S.TotalQuantityLine>
						<p>
							{`${language.totalAssetBalance}: `}
							<span>{formatCount(totalAssetBalance.toString())}</span>
						</p>
					</S.TotalQuantityLine>
					{getTotals()}
				</S.TotalsWrapper>
				{maxOrderQuantity > 0 && (
					<S.InputWrapper>
						<Slider
							value={parseInt(Number(currentOrderQuantity).toString())}
							maxValue={maxOrderQuantity}
							handleChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuantityInput(e)}
							label={language.assetQuantityInfo}
							disabled={
								!arProvider.walletAddress ||
								!arProvider.profile ||
								!arProvider.profile.id ||
								maxOrderQuantity <= 0 ||
								orderLoading
							}
							invalid={{ status: currentOrderQuantity < 0 || currentOrderQuantity > maxOrderQuantity, message: null }}
						/>
						<S.MaxQty>
							<Button
								type={'primary'}
								label={language.max}
								handlePress={() => setCurrentOrderQuantity(maxOrderQuantity)}
								disabled={
									!arProvider.walletAddress || !arProvider.profile || !arProvider.profile.id || maxOrderQuantity <= 0
								}
								noMinWidth
							/>
						</S.MaxQty>
						<S.FieldsWrapper>
							<S.FieldWrapper>
								<FormField
									type={'number'}
									step={'1'}
									value={currentOrderQuantity}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuantityInput(e)}
									label={`${language.assetQuantity} (${language.max}: ${maxOrderQuantity})`}
									disabled={
										!arProvider.walletAddress ||
										!arProvider.profile ||
										!arProvider.profile.id ||
										maxOrderQuantity <= 0 ||
										orderLoading
									}
									invalid={{
										status:
											currentOrderQuantity < 0 ||
											currentOrderQuantity > maxOrderQuantity ||
											!Number.isInteger(Number(currentOrderQuantity)),
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
										value={isNaN(unitPrice) ? '' : unitPrice}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUnitPriceInput(e)}
										disabled={
											!arProvider.walletAddress ||
											!arProvider.profile ||
											!arProvider.profile.id ||
											currentOrderQuantity <= 0 ||
											orderLoading
										}
										invalid={{ status: unitPrice < 0, message: null }}
										tooltip={language.saleUnitPriceTooltip}
									/>
								</S.FieldWrapper>
							)}
							{props.type === 'transfer' && (
								<S.RecipientWrapper>
									<S.FieldWrapper>
										<FormField
											label={language.recipient}
											value={transferRecipient || ''}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRecipientInput(e)}
											disabled={
												!arProvider.walletAddress || !arProvider.profile || !arProvider.profile.id || orderLoading
											}
											invalid={{ status: transferRecipient && !checkValidAddress(transferRecipient), message: null }}
											hideErrorMessage
										/>
									</S.FieldWrapper>
									{navigator && navigator.clipboard && navigator.clipboard.readText && (
										<IconButton
											type={'primary'}
											src={ASSETS.paste}
											handlePress={handleRecipientPaste}
											disabled={
												!arProvider.walletAddress || !arProvider.profile || !arProvider.profile.id || orderLoading
											}
											dimensions={{
												wrapper: 32.5,
												icon: 15,
											}}
											tooltip={language.pasteFromClipboard}
											useBottomToolTip
										/>
									)}
								</S.RecipientWrapper>
							)}
						</S.FieldsWrapper>
					</S.InputWrapper>
				)}
				<S.SalesWrapper>{getOrderDetails()}</S.SalesWrapper>
				<S.ActionWrapper loading={null}>
					{getAction(false)}
					{insufficientBalance && (
						<S.MessageWrapper>
							<span>Not enough tokens to purchase this asset</span>
						</S.MessageWrapper>
					)}
					{!arProvider.walletAddress && (
						<S.MessageWrapper>
							<span>Connect your wallet to continue</span>
						</S.MessageWrapper>
					)}
					{!arProvider.profile ||
						(!arProvider.profile.id && (
							<S.MessageWrapper>
								<span>Create your profile to continue</span>
							</S.MessageWrapper>
						))}
					{!Number.isInteger(Number(currentOrderQuantity)) && (
						<S.MessageWrapper>
							<span>Quantity must be an integer</span>
						</S.MessageWrapper>
					)}
				</S.ActionWrapper>
			</S.Wrapper>
			{showConfirmation && getConfirmation()}
			{updating && (
				<Notification message={`${language.updatingAsset}...`} type={'success'} callback={() => setUpdating(false)} />
			)}
		</>
	) : null;
}
