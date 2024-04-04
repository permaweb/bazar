import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { readProcessState, sendMessage } from 'api';

import { Button } from 'components/atoms/Button';
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

// TODO: order cancel
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

	// Ticker of the transfer token
	const [transferTicker, setTransferTicker] = React.useState<string | null>(null);

	// Price on limit orders for quantity of one transfer token
	const [unitPrice, setUnitPrice] = React.useState<number>(0);

	// Active after an order is completed and asset is refreshed
	const [updating, setUpdating] = React.useState<boolean>(false);

	const [orderLoading, setOrderLoading] = React.useState<boolean>(false);
	const [orderProcessed, setOrderProcessed] = React.useState<boolean>(false);
	const [showConfirmation, setShowConfirmation] = React.useState<boolean>(false);
	const [currentNotification, setCurrentNotification] = React.useState<string | null>(null);

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

				if (arProvider.walletAddress) {
					const ownerBalance = Number(props.asset.state.balances[arProvider.walletAddress]);
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
				setTransferTicker(currenciesReducer[orderCurrency].Ticker);
			}
		}
	}, [props.asset, arProvider.walletAddress, denomination, ucmReducer]);

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
		setCurrentOrderQuantity(0);
	}, [props.asset, props.type, connectedBalance, totalSalesQuantity]);

	async function handleOrderCreate() {
		if (props.asset && arProvider.wallet) {
			let orderPair = null;
			let recipient = null;

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

				let calculatedQuantity: string | number = currentOrderQuantity;
				if (props.type === 'sell' || props.type === 'transfer') {
					if (denomination) calculatedQuantity = currentOrderQuantity * denomination;
				}
				if (props.type === 'buy') {
					calculatedQuantity = getTotalPrice();
				}
				calculatedQuantity = calculatedQuantity.toString();

				setOrderLoading(true);
				try {
					setCurrentNotification('Transferring balance...');
					const transferResponse: any = await sendMessage({
						processId: dominantToken,
						action: 'Transfer',
						wallet: arProvider.wallet,
						data: {
							Recipient: recipient,
							Quantity: calculatedQuantity,
						},
					});

					if (transferResponse['Credit-Notice'] && transferResponse['Debit-Notice']) {
						setCurrentNotification(transferResponse['Credit-Notice'].message);
					}

					if (props.type === 'transfer') {
						if (transferResponse['Transfer-Error']) {
							setCurrentNotification(transferResponse['Transfer-Error'].message);
						}
					} else {
						const validCreditNotice =
							transferResponse['Debit-Notice'] &&
							transferResponse['Credit-Notice'] &&
							transferResponse['Credit-Notice'].status === 'Success';

						if (validCreditNotice) {
							const depositTxId = transferResponse['Credit-Notice'].id;

							setCurrentNotification('Checking deposit status...');
							let depositCheckResponse: any = await sendMessage({
								processId: PROCESSES.ucm,
								action: 'Check-Deposit-Status',
								wallet: arProvider.wallet,
								data: {
									Pair: orderPair,
									DepositTxId: depositTxId,
									Quantity: calculatedQuantity,
								},
							});

							if (depositCheckResponse['Deposit-Status-Evaluated']) {
								setCurrentNotification(depositCheckResponse.message);
							}

							if (depositCheckResponse && depositCheckResponse['Deposit-Status-Evaluated']) {
								const MAX_DEPOSIT_CHECK_RETRIES = 10;

								let depositStatus = depositCheckResponse['Deposit-Status-Evaluated'].status;
								let retryCount = 0;

								while (depositStatus === 'Error' && retryCount < MAX_DEPOSIT_CHECK_RETRIES) {
									await new Promise((r) => setTimeout(r, 1000));
									depositCheckResponse = await sendMessage({
										processId: PROCESSES.ucm,
										action: 'Check-Deposit-Status',
										wallet: arProvider.wallet,
										data: {
											Pair: orderPair,
											DepositTxId: depositTxId,
											Quantity: calculatedQuantity,
										},
									});

									if (depositCheckResponse['Deposit-Status-Evaluated']) {
										setCurrentNotification(depositCheckResponse.message);
									}

									depositStatus = depositCheckResponse['Deposit-Status-Evaluated'].status;
									retryCount++;
								}

								if (depositStatus === 'Success') {
									setCurrentNotification('Creating order...');
									const orderData: { Pair: string[]; DepositTxId: string; Quantity: string; Price?: string } = {
										Pair: orderPair,
										DepositTxId: depositTxId,
										Quantity: calculatedQuantity,
									};

									if (unitPrice && unitPrice > 0) {
										let calculatedUnitPrice: string | number = unitPrice;
										if (transferDenomination) calculatedUnitPrice = unitPrice * transferDenomination;
										calculatedUnitPrice = calculatedUnitPrice.toString();
										orderData.Price = calculatedUnitPrice;
									}

									const createOrderResponse: any = await sendMessage({
										processId: PROCESSES.ucm,
										action: 'Create-Order',
										wallet: arProvider.wallet,
										data: orderData,
									});

									if (createOrderResponse) {
										if (createOrderResponse['Order-Success']) {
											setCurrentNotification(`${createOrderResponse['Order-Success'].message}!`);
										}
										if (createOrderResponse['Order-Error']) {
											setCurrentNotification(createOrderResponse['Order-Error'].message);
										}
									} else {
										setCurrentNotification('Error creating order');
									}
								} else {
									setCurrentNotification('Failed to resolve deposit');
								}
							} else {
								setCurrentNotification('Failed to check deposit status');
							}
						} else {
							setCurrentNotification('Invalid credit notice');
						}
					}
				} catch (e: any) {
					setCurrentNotification(e.message || 'Error creating order');
				}
				setOrderLoading(false);
				setOrderProcessed(true);
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
		let calculatedTotalPrice = getTotalPrice();
		if (transferDenomination) calculatedTotalPrice = getTotalPrice() / transferDenomination;
		return `${formatCount(calculatedTotalPrice.toFixed(4).toString())} ${transferTicker || ''}`;
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
							<p>{getTotalPriceDisplay()}</p>
						</S.SalesDetail>
					</S.SalesLine>
				)}
			</>
		);
	}

	function getActionDisabled() {
		if (!arProvider.walletAddress) return true;
		if (orderLoading) return true;
		if (maxOrderQuantity <= 0) return true;
		if (currentOrderQuantity <= 0) return true;
		if (currentOrderQuantity > maxOrderQuantity) return true;
		if (props.type === 'sell' && unitPrice <= 0) return true;
		if (props.type === 'transfer' && (!transferRecipient || !checkValidAddress(transferRecipient))) return true;
		return false;
	}

	async function handleAssetUpdate() {
		setUpdating(true);
		setCurrentOrderQuantity(0);
		setUnitPrice(0);
		setCurrentNotification(null);
		setTransferRecipient('');
		setShowConfirmation(false);
		setOrderProcessed(false);
		windowUtils.scrollTo(0, 0, 'smooth');
		try {
			const ucmState = await readProcessState(PROCESSES.ucm);
			dispatch(ucmActions.setUCM(ucmState));

			const orderCurrency =
				props.asset.orders && props.asset.orders.length ? props.asset.orders[0].currency : PROCESSES.token;
			const tokenState = await readProcessState(orderCurrency);
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

	function getAction(finalizeOrder: boolean) {
		let label: string | null = null;
		let icon: string | null = null;

		if (orderProcessed) label = language.close;
		else {
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
		}

		let action: () => void;
		if (orderProcessed) action = () => handleAssetUpdate();
		else if (finalizeOrder) action = () => handleOrderCreate();
		else action = () => setShowConfirmation(true);

		return (
			<Button
				type={'primary'}
				label={label}
				handlePress={action}
				disabled={getActionDisabled()}
				loading={finalizeOrder ? orderLoading : false}
				height={60}
				width={350}
				fullWidth={finalizeOrder}
				icon={icon}
				iconLeftAlign
			/>
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
				handleClose={() => (orderProcessed ? handleAssetUpdate() : setShowConfirmation(false))}
			>
				<S.ConfirmationWrapper className={'modal-wrapper'}>
					<S.SalesWrapper>{getOrderDetails()}</S.SalesWrapper>
					<S.ActionWrapperFull>{getAction(true)}</S.ActionWrapperFull>
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
							value={currentOrderQuantity}
							maxValue={maxOrderQuantity}
							handleChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuantityInput(e)}
							label={language.assetQuantityInfo}
							disabled={maxOrderQuantity <= 0 || orderLoading}
						/>
						<S.MaxQty>
							<Button
								type={'primary'}
								label={language.max}
								handlePress={() => setCurrentOrderQuantity(maxOrderQuantity)}
								disabled={!arProvider.walletAddress || maxOrderQuantity <= 0}
								noMinWidth
							/>
						</S.MaxQty>
						<S.FieldsWrapper>
							<S.FieldWrapper>
								<FormField
									type={'number'}
									value={currentOrderQuantity}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuantityInput(e)}
									label={`${language.assetQuantity} (${language.max}: ${maxOrderQuantity})`}
									disabled={!arProvider.walletAddress || maxOrderQuantity <= 0 || orderLoading}
									invalid={{ status: currentOrderQuantity < 0, message: null }}
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
										disabled={!arProvider.walletAddress || currentOrderQuantity <= 0 || orderLoading}
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
											disabled={!arProvider.walletAddress || orderLoading}
											invalid={{ status: transferRecipient && !checkValidAddress(transferRecipient), message: null }}
										/>
									</S.FieldWrapper>
									{navigator && navigator.clipboard && navigator.clipboard.readText && (
										<IconButton
											type={'primary'}
											src={ASSETS.paste}
											handlePress={handleRecipientPaste}
											disabled={!arProvider.walletAddress || orderLoading}
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
				<S.ActionWrapper>{getAction(false)}</S.ActionWrapper>
			</S.Wrapper>
			{showConfirmation && getConfirmation()}
			{updating && <Notification message={`${language.updatingAsset}...`} callback={() => setUpdating(false)} />}
		</>
	) : null;
}
