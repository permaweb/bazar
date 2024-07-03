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
import { AOS, ASSETS } from 'helpers/config';
import { AssetOrderType, OrderbookEntryType } from 'helpers/types';
import { checkValidAddress, formatCount, formatPercentage, getTotalTokenBalance } from 'helpers/utils';
import * as windowUtils from 'helpers/window';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';
import * as streakActions from 'store/streaks/actions';
import * as ucmActions from 'store/ucm/actions';

import * as S from './styles';
import { IProps } from './types';

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

					if (denomination) calculatedTotalBalance = totalBalance / denomination;

					setTotalAssetBalance(calculatedTotalBalance);

					if (arProvider.walletAddress && arProvider.profile && arProvider.profile.id) {
						const profileBalance = Number(props.asset.state.balances[arProvider.profile.id]);
						// const walletBalance = Number(props.asset.state.balances[arProvider.walletAddress]);

						let totalBalance = 0;
						if (profileBalance) totalBalance += profileBalance;
						// if (walletBalance) totalBalance += walletBalance;

						if (totalBalance) {
							let calculatedOwnerBalance = totalBalance;
							if (denomination) calculatedOwnerBalance = totalBalance / denomination;
							setConnectedBalance(calculatedOwnerBalance);
						}
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
				props.asset.orders && props.asset.orders.length ? props.asset.orders[0].currency : AOS.defaultToken;
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
		if (props.type === 'buy') {
			if (!arProvider.tokenBalances || !arProvider.tokenBalances[AOS.defaultToken]) {
				setInsufficientBalance(true);
			} else {
				let orderAmount = getTotalOrderAmount();
				if (denomination) {
					orderAmount = orderAmount / denomination;
				}
				setInsufficientBalance(Number(getTotalTokenBalance(arProvider.tokenBalances[AOS.defaultToken])) < orderAmount);
			}
		} else {
			setInsufficientBalance(false);
		}
	}, [arProvider.tokenBalances, props.type, props.asset, currentOrderQuantity, denomination]);

	React.useEffect(() => {
		if (currentOrderQuantity) setCurrentOrderQuantity('');
	}, [props.type]);

	async function handleSubmit() {
		if (props.asset && arProvider.wallet && arProvider.profile && arProvider.profile.id) {
			let pair = null;
			let forwardedTags = null;
			let recipient = null;
			let localSuccess = false;
			let initialMessage = null;

			switch (props.type) {
				case 'buy':
					pair = [AOS.defaultToken, props.asset.data.id];
					recipient = AOS.ucm;
					initialMessage = 'Depositing balance...';
					break;
				case 'sell':
					pair = [props.asset.data.id, AOS.defaultToken];
					recipient = AOS.ucm;
					initialMessage = 'Depositing balance...';
					break;
				case 'transfer':
					pair = [props.asset.data.id, AOS.defaultToken];
					recipient = transferRecipient;
					initialMessage = 'Transferring balance...';
					break;
			}

			if (pair && recipient) {
				const dominantToken = pair[0];
				const swapToken = pair[1];

				let transferQuantity: string | number = currentOrderQuantity;

				if (props.type === 'sell' || props.type === 'transfer') {
					if (denomination) {
						transferQuantity = Number(currentOrderQuantity) * denomination;
					}
				}

				if (props.type === 'buy') {
					transferQuantity = getTotalOrderAmount();

					if (denomination) {
						transferQuantity = transferQuantity / denomination;
					}
				}

				transferQuantity = transferQuantity.toString();

				if (props.type === 'buy' || props.type === 'sell') {
					forwardedTags = [
						{ name: 'X-Order-Action', value: 'Create-Order' },
						{ name: 'X-Swap-Token', value: swapToken },
					];
					if (unitPrice && Number(unitPrice) > 0) {
						let calculatedUnitPrice: string | number = unitPrice;
						if (transferDenomination) calculatedUnitPrice = Number(unitPrice) * transferDenomination;
						calculatedUnitPrice = calculatedUnitPrice.toString();
						forwardedTags.push({ name: 'X-Price', value: calculatedUnitPrice });
					}
					if (denomination && denomination > 1) {
						forwardedTags.push({ name: 'X-Transfer-Denomination', value: denomination.toString() });
					}
				}

				const transferTags = [
					{ name: 'Target', value: dominantToken },
					{ name: 'Recipient', value: recipient },
					{ name: 'Quantity', value: transferQuantity },
				];

				if (forwardedTags) transferTags.push(...forwardedTags);

				setOrderLoading(true);
				try {
					setCurrentNotification(initialMessage);

					if (props.type === 'buy') {
						const profileBalance = BigInt(arProvider.tokenBalances[AOS.defaultToken].profileBalance);
						const walletBalance = BigInt(arProvider.tokenBalances[AOS.defaultToken].walletBalance);

						const transferAmount = BigInt(transferQuantity);

						if (profileBalance < transferAmount) {
							const differenceNeeded = transferAmount - profileBalance;

							if (walletBalance < differenceNeeded) {
								console.error(`Wallet balance is less than difference needed: ${differenceNeeded}`);
								console.error(`Wallet balance: ${walletBalance}`);
								return;
							} else {
								console.log(`Transferring remainder from wallet balance: ${differenceNeeded.toString()}`);
								const walletTransferResponse: any = await messageResults({
									processId: AOS.defaultToken,
									action: 'Transfer',
									wallet: arProvider.wallet,
									tags: [
										{ name: 'Quantity', value: differenceNeeded.toString() },
										{ name: 'Recipient', value: arProvider.profile.id },
									],
									data: null,
									responses: ['Transfer-Error'],
								});
								if (!walletTransferResponse || walletTransferResponse['Transfer-Error']) return;
							}
						}
					}

					const response: any = await messageResults({
						processId: arProvider.profile.id,
						action: 'Transfer',
						wallet: arProvider.wallet,
						tags: transferTags,
						data: null,
						responses: ['Transfer-Success', 'Transfer-Error'],
						handler: 'Create-Order',
					});

					if (response) {
						if (response['Transfer-Success'])
							setCurrentNotification(response['Transfer-Success'].message || 'Balance transferred!');
						switch (props.type) {
							case 'buy':
							case 'sell':
								setCurrentNotification(
									response['Action-Response'] && response['Action-Response'].message
										? response['Action-Response'].message
										: 'Order created!'
								);
								setOrderSuccess(true);
								localSuccess = true;
								break;
							case 'transfer':
								setOrderSuccess(true);
								setCurrentNotification('Balance transferred!');
								break;
						}
					} else {
						setCurrentNotification('Error depositing funds');
					}
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

			if (props.type !== 'transfer') {
				try {
					const existingUCM = { ...ucmReducer };

					if (existingUCM && existingUCM.Orderbook && existingUCM.Orderbook.length) {
						let pair = [props.asset.data.id, AOS.defaultToken];

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
										processId: AOS.ucm,
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
					processId: AOS.pixl,
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

				let totalQuantity = 0;
				let totalPrice = 0;

				for (let i = 0; i < sortedOrders.length; i++) {
					const quantity = Number(sortedOrders[i].quantity);
					const price = Number(sortedOrders[i].price);

					let inputQuantity = Number(currentOrderQuantity);
					if (denomination) inputQuantity = Number(currentOrderQuantity) * denomination;

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
			let price: number;
			if (
				isNaN(Number(unitPrice)) ||
				isNaN(Number(currentOrderQuantity)) ||
				Number(currentOrderQuantity) < 0 ||
				Number(unitPrice) < 0
			) {
				price = 0;
			} else {
				let calculatedUnitPrice = unitPrice as any;
				if (transferDenomination) calculatedUnitPrice = Number(unitPrice) * transferDenomination;
				price = Number(currentOrderQuantity) * calculatedUnitPrice;
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

	function getActionDisabled() {
		if (!arProvider.walletAddress) return true;
		if (!arProvider.profile || !arProvider.profile.id) return true;
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
		if (props.type === 'sell' && (Number(unitPrice) <= 0 || isNaN(Number(unitPrice)))) return true;
		if (props.type === 'transfer' && (!transferRecipient || !checkValidAddress(transferRecipient))) return true;
		if (insufficientBalance) return true;
		return false;
	}

	const getTotals = React.useMemo(() => {
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
						<span>{formatPercentage(!isNaN(quantity / totalAssetBalance) ? quantity / totalAssetBalance : 0)}</span>
					</p>
				</S.TotalQuantityLine>
			</>
		);
	}, [props.asset, props.type, totalAssetBalance, totalSalesQuantity, connectedBalance, ucmReducer]);

	function getTotalPriceDisplay() {
		let amount = getTotalOrderAmount();
		if (props.type === 'buy' && denomination) amount = amount / denomination;
		const orderCurrency =
			props.asset.orders && props.asset.orders.length ? props.asset.orders[0].currency : AOS.defaultToken;
		return <CurrencyLine amount={amount || '0'} currency={orderCurrency} />;
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
			</>
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
					{getTotals}
				</S.TotalsWrapper>
				{maxOrderQuantity > 0 && (
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
									value={isNaN(Number(currentOrderQuantity)) ? '' : currentOrderQuantity}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuantityInput(e)}
									label={`${language.assetQuantity} (${language.max}: ${formatCount(maxOrderQuantity.toString())})`}
									disabled={
										!arProvider.walletAddress ||
										!arProvider.profile ||
										!arProvider.profile.id ||
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
											orderLoading
										}
										invalid={{ status: Number(unitPrice) < 0, message: null }}
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
					{arProvider.tokenBalances &&
						getTotalTokenBalance(arProvider.tokenBalances[AOS.defaultToken]) !== null &&
						insufficientBalance && (
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
					{!Number.isInteger(Number(currentOrderQuantity)) && !denomination && (
						<S.MessageWrapper>
							<span>Quantity must be an integer</span>
						</S.MessageWrapper>
					)}
					{props.asset && !props.asset.state.transferable && (
						<S.MessageWrapper>
							<span>This asset cannot be transferred</span>
						</S.MessageWrapper>
					)}
				</S.ActionWrapper>
			</S.Wrapper>
			{showConfirmation && getConfirmation()}
			{updating && (
				<Notification message={`${language.fetchingAsset}...`} type={'success'} callback={() => setUpdating(false)} />
			)}
		</>
	) : null;
}
