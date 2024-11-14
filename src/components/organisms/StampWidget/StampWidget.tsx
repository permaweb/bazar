import React from 'react';
import { ReactSVG } from 'react-svg';

import Stamps from '@permaweb/stampjs';

import { Button } from 'components/atoms/Button';
import { FormField } from 'components/atoms/FormField';
import { Notification } from 'components/atoms/Notification';
import { Modal } from 'components/molecules/Modal';
import { ASSETS } from 'helpers/config';
import { ResponseType } from 'helpers/types';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { WalletConnect } from 'wallet/WalletConnect';

import * as S from './styles';
import { IProps } from './types';

function StampAction(props: {
	balance: number;
	handleSubmit: (amount: number) => void;
	handleClose: () => void;
	disabled: boolean;
}) {
	const [amount, setAmount] = React.useState<string>('0');

	const invalid = Number(amount) > props.balance;

	const [disabled, setDisabled] = React.useState<boolean>(false);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	function handleSubmit(e: any) {
		e.stopPropagation();
		e.preventDefault();
		setDisabled(true);
		props.handleSubmit(Number(amount) * 1e12);
	}

	return (
		<S.SAContainer>
			<S.SAInfoContainer>
				<S.SABalanceContainer>
					<ReactSVG src={ASSETS.stamp.super} />
					<p>{(props.balance / 1e12).toFixed(2)}</p>
				</S.SABalanceContainer>
			</S.SAInfoContainer>
			<S.SAFormContainer onSubmit={() => props.handleSubmit(Number(amount))}>
				<S.SAInput>
					<FormField
						type={'number'}
						value={amount}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
						disabled={false}
						invalid={{
							status: invalid,
							message: invalid ? language.amountExceedsBalance : null,
						}}
					/>
				</S.SAInput>
				<S.SAActions>
					<Button
						type={'primary'}
						label={language.close}
						handlePress={(e: any) => {
							e.preventDefault();
							e.stopPropagation();
							props.handleClose();
						}}
						disabled={false}
						formSubmit
						noMinWidth
					/>
					<Button
						type={'primary'}
						label={language.submit}
						handlePress={(e: any) => handleSubmit(e)}
						disabled={invalid || Number(amount) <= 0 || Number(amount) % 1 !== 0 || disabled || props.disabled}
						formSubmit
						noMinWidth
					/>
				</S.SAActions>
			</S.SAFormContainer>
		</S.SAContainer>
	);
}

export default function StampWidget(props: IProps) {
	const arProvider = useArweaveProvider();

	const [stamps, setStamps] = React.useState<any>(null);

	const [count, setCount] = React.useState<any>(null);
	const [balance, setBalance] = React.useState<number>(0);
	const [hasStamped, setHasStamped] = React.useState<boolean>(false);
	const [loading, setLoading] = React.useState<boolean>(false);

	const [updateCount, setUpdateCount] = React.useState<boolean>(false);
	const [showModal, setShowModal] = React.useState<boolean>(false);

	const [disabled, setDisabled] = React.useState<boolean>(true);
	const [initLoadingDisabled, setInitLoadingDisabled] = React.useState<boolean>(true);

	const [stampNotification, setStampNotification] = React.useState<ResponseType | null>(null);
	const [showStampAction, setShowStampAction] = React.useState<boolean>(false);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	React.useEffect(() => {
		if (arProvider.walletAddress) {
			setStamps(Stamps.init({}));
		}
	}, [arProvider.walletAddress]);

	React.useEffect(() => {
		(async function () {
			if (props.assetId && stamps) {
				if (updateCount) {
					await new Promise((resolve) => setTimeout(resolve, 2500));
				}
				const updatedCount = await stamps.count(props.assetId);
				setCount(updatedCount);
			}
		})();
	}, [stamps, props.assetId, updateCount]);

	React.useEffect(() => {
		(async function () {
			if (props.assetId && stamps) {
				try {
					await new Promise((r) => setTimeout(r, 2500));
					const hasStamped = await stamps.hasStamped(props.assetId);
					setHasStamped(hasStamped);
					if (hasStamped) {
						setDisabled(true);
					}
					if (arProvider.walletAddress) {
						setBalance(await stamps.balance(arProvider.walletAddress));
					}
					setUpdateCount(false);
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [stamps, props.assetId, updateCount, arProvider.walletAddress]);

	React.useEffect(() => {
		(async function () {
			if (stamps) {
				await new Promise((r) => setTimeout(r, 1000));
				setInitLoadingDisabled(hasStamped ? true : false);
			}
		})();
	}, [stamps, hasStamped]);

	React.useEffect(() => {
		(async function () {
			if (stamps) {
				setDisabled(hasStamped ? true : false);
			}
		})();
	}, [stamps, hasStamped]);

	function handleModalOpen(e: any) {
		e.stopPropagation();
		e.preventDefault();
		setShowModal(true);
	}

	function handleModalClose() {
		setShowModal(false);
	}

	const handleStamp = React.useCallback(
		async (amount?: number) => {
			try {
				setLoading(true);
				if (props.assetId) {
					setDisabled(true);

					const stamp: any = await stamps.stamp(props.assetId, amount ? amount : 0, [{ name: '', value: '' }]);
					let stampSuccess = stamp && stamp.bundlrResponse && stamp.bundlrResponse.id;
					if (!stampSuccess) {
						stampSuccess = stamp && stamp.id;
					}

					setUpdateCount(true);

					if (!stampSuccess) {
						setDisabled(false);
					}

					setStampNotification({
						status: stampSuccess,
						message: stampSuccess
							? props.hasStampedMessage
								? props.hasStampedMessage
								: language.assetStamped
							: language.errorOccurred,
					});
				}
				setLoading(false);
			} catch (e: any) {
				setLoading(false);
				setStampNotification({
					status: false,
					message: e.toString(),
				});
			}
		},
		[stamps, updateCount, props]
	);

	function handleStampAction(amount: number) {
		handleStamp(amount);
	}

	function getTotalCount() {
		if (count) return count.total.toString();
		else if (props.stamps) return props.stamps.total.toString();
		else return '0';
	}

	return (
		<>
			{!props.asButton && (
				<S.Wrapper
					onClick={handleModalOpen}
					disabled={false}
					title={arProvider.walletAddress ? language.stamp : language.connectWalletToStamp}
					sm={props.sm ? props.sm : false}
					className={'border-wrapper-primary'}
				>
					<p>{getTotalCount()}</p>
					<ReactSVG src={ASSETS.stamps} />
				</S.Wrapper>
			)}
			{props.asButton && (
				<button onClick={handleModalOpen}>
					<span>{language.stamp}</span>
				</button>
			)}
			{showModal && (
				<Modal header={props.title} handleClose={() => handleModalClose()}>
					<S.DetailLine>
						<span>{`${language.stampCount}:`}</span>
						<p>{count ? count.total.toString() : '0'}</p>
					</S.DetailLine>
					<S.DetailLine>
						<span>{`${language.stampsVouched}:`}</span>
						<p>{count ? count.vouched.toString() : '0'}</p>
					</S.DetailLine>
					{arProvider.walletAddress ? (
						<S.FlexActions>
							<Button
								type={'primary'}
								label={language.stamp}
								handlePress={(e: any) => {
									e.preventDefault();
									handleStamp();
								}}
								disabled={disabled || initLoadingDisabled}
								icon={ASSETS.stamps}
							/>
							<Button
								type={'primary'}
								label={language.superStamp}
								handlePress={(e: any) => {
									e.preventDefault();
									setShowStampAction(!showStampAction);
								}}
								disabled={disabled || initLoadingDisabled}
								icon={ASSETS.stamps}
								width={180}
							/>
						</S.FlexActions>
					) : (
						<S.WalletBlock>
							<p>{language.connectWalletToStamp}</p>
							<WalletConnect />
						</S.WalletBlock>
					)}

					{showStampAction && (
						<StampAction
							balance={balance}
							handleClose={() => setShowStampAction(false)}
							handleSubmit={(amount: number) => handleStampAction(amount)}
							disabled={stampNotification !== null}
						/>
					)}
					{(hasStamped || loading) && (
						<S.Message loading={loading ? 'true' : 'false'}>
							<p>
								{hasStamped
									? props.hasStampedMessage
										? props.hasStampedMessage
										: language.assetStamped
									: `${language.loading}...`}
							</p>
						</S.Message>
					)}
					{stampNotification && stampNotification.message && (
						<Notification
							message={stampNotification.message}
							type={stampNotification.status ? 'success' : 'warning'}
							callback={() => setStampNotification(null)}
						/>
					)}
				</Modal>
			)}
		</>
	);
}
