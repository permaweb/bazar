import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { readProcessState, sendMessage } from 'api';

import { Button } from 'components/atoms/Button';
import { FormField } from 'components/atoms/FormField';
import { Slider } from 'components/atoms/Slider';
import { Modal } from 'components/molecules/Modal';
import { ASSETS, PROCESSES } from 'helpers/config';
import { formatCount, formatPercentage } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';
import * as ucmActions from 'store/ucm/actions';

import * as S from './styles';
import { IProps } from './types';

// TODO: unit price
// TODO: buy / transfer
export default function AssetActionMarketOrders(props: IProps) {
	const dispatch = useDispatch();

	const arProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

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

	const [showConfirmation, setShowConfirmation] = React.useState<boolean>(false);
	const [orderLoading, setOrderLoading] = React.useState<boolean>(false);
	const [orderProcessed, setOrderProcessed] = React.useState<boolean>(false);
	const [currentNotification, setCurrentNotification] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (props.asset && props.asset.state) {
			const balances: any = Object.keys(props.asset.state.balances).map((address: string) => {
				return Number(props.asset.state.balances[address]);
			});
			const totalBalance = balances.reduce((a: number, b: number) => a + b, 0);
			setTotalAssetBalance(totalBalance);

			if (arProvider.walletAddress) {
				const ownerBalance = Number(props.asset.state.balances[arProvider.walletAddress]);
				if (ownerBalance) {
					setConnectedBalance(ownerBalance);
				}
			}
		}
	}, [props.asset, arProvider.walletAddress]);

	React.useEffect(() => {
		switch (props.type) {
			case 'buy':
				setMaxOrderQuantity(0);
				break;
			case 'sell':
				setMaxOrderQuantity(connectedBalance);
				break;
			case 'transfer':
				setMaxOrderQuantity(connectedBalance);
				break;
		}
		setCurrentOrderQuantity(0);
	}, [props.type, connectedBalance]);

	// args: { clientWallet, orderPair, orderQuantity, orderPrice? }
	async function handleOrderCreate() {
		if (props.asset && arProvider.wallet) {
			setOrderLoading(true);

			const orderPair = [props.asset.data.id, PROCESSES.token];
			const dominantToken = orderPair[0];

			try {
				setCurrentNotification('Depositing balance to UCM...');
				const depositResponse: any = await sendMessage({
					processId: dominantToken,
					action: 'Transfer',
					wallet: arProvider.wallet,
					data: {
						Recipient: PROCESSES.ucm,
						Quantity: currentOrderQuantity.toString(),
					},
				});

				if (depositResponse['Credit-Notice']) {
					setCurrentNotification(depositResponse['Credit-Notice'].message);
				}

				const validCreditNotice =
					depositResponse['Credit-Notice'] && depositResponse['Credit-Notice'].status === 'Success';

				if (validCreditNotice) {
					const depositTxId = depositResponse['Credit-Notice'].id; // data.TransferTxId // TODO: refund

					setCurrentNotification('Checking deposit status...');
					let depositCheckResponse: any = await sendMessage({
						processId: PROCESSES.ucm,
						action: 'Check-Deposit-Status',
						wallet: arProvider.wallet,
						data: {
							Pair: orderPair,
							DepositTxId: depositTxId,
							Quantity: currentOrderQuantity.toString(),
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
									Quantity: currentOrderQuantity.toString(),
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
								Quantity: currentOrderQuantity.toString(),
								Price: (10).toString(),
							};

							// if (args.orderPrice) orderData.Price = args.orderPrice; // TODO

							const createOrderResponse: any = await sendMessage({
								processId: PROCESSES.ucm,
								action: 'Create-Order',
								wallet: arProvider.wallet,
								data: orderData,
							});

							if (createOrderResponse['Order-Success']) {
								setCurrentNotification(`${createOrderResponse['Order-Success'].message}!`);
							}
							if (createOrderResponse['Order-Error']) {
								setCurrentNotification(createOrderResponse['Order-Error'].message);
							}
						} else {
							console.error('Failed to resolve deposit');
						}
					} else {
						console.error('Failed to check deposit status');
					}
				} else {
					console.error('Invalid credit notice');
				}
			} catch (e) {
				console.error(e);
			}
			setOrderLoading(false);
			setOrderProcessed(true);
		}
	}

	function handleQuantityInput(e: React.ChangeEvent<HTMLInputElement>) {
		if (e.target.value === '' || parseFloat(e.target.value) < 0) {
			setCurrentOrderQuantity(0);
		} else {
			if (!isNaN(Number(e.target.value))) setCurrentOrderQuantity(parseFloat(e.target.value));
		}
	}

	function getTotals() {
		let balanceHeader: string | null = null;
		let percentageHeader: string | null = null;
		let quantity: number | null = null;

		switch (props.type) {
			case 'buy':
				balanceHeader = language.totalSalesBalance;
				percentageHeader = language.totalSalesPercentage;
				quantity = 0;
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
		return formatCount('0');
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
							<p>{getTotalPrice()}</p>
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
		// if (connectedDisabledSale) return true;
		// if (invalidQuantity.status || quantity <= 0 || isNaN(quantity)) return true;
		// if (invalidUnitPrice.status || unitPrice <= 0 || isNaN(unitPrice)) return true;
		// if (props.updating || props.pendingResponse) return true;
		return false;
	}

	async function handleAssetUpdate() {
		console.log('Update / clear asset');
		setShowConfirmation(false);
		setCurrentOrderQuantity(0);
		try {
			const ucmState = await readProcessState(PROCESSES.ucm);
			dispatch(ucmActions.setUCM(ucmState));
		} catch (e: any) {
			console.error(e);
		}
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
			<Modal header={`${header}: ${props.asset.data.title}`} handleClose={() => setShowConfirmation(false)}>
				<S.ConfirmationWrapper className={'modal-wrapper'}>
					<S.SalesWrapper>{getOrderDetails()}</S.SalesWrapper>
					<S.ActionWrapperFull>{getAction(true)}</S.ActionWrapperFull>
					<S.ConfirmationMessage>
						<p>{currentNotification ? currentNotification : language.reviewOrderDetails}</p>
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
									disabled={!arProvider.walletAddress || maxOrderQuantity <= 0}
									invalid={{ status: false, message: null }}
									hideErrorMessage
								/>
							</S.FieldWrapper>
							{props.type === 'sell' && (
								<S.FieldWrapper>
									<FormField
										type={'number'}
										value={currentOrderQuantity}
										onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuantityInput(e)}
										label={`${language.assetQuantity} (${language.max}: ${maxOrderQuantity})`}
										disabled={!arProvider.walletAddress || maxOrderQuantity <= 0}
										invalid={{ status: false, message: null }}
										hideErrorMessage
									/>
								</S.FieldWrapper>
							)}
						</S.FieldsWrapper>
					</S.InputWrapper>
				)}
				<S.SalesWrapper>{getOrderDetails()}</S.SalesWrapper>
				<S.ActionWrapper>{getAction(false)}</S.ActionWrapper>
			</S.Wrapper>
			{showConfirmation && getConfirmation()}
		</>
	) : null;
}
