import React from 'react';

import { messageResult, readHandler } from 'api';

import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { Notification } from 'components/atoms/Notification';
import { Modal } from 'components/molecules/Modal';
import { AOS } from 'helpers/config';
import { NotificationType } from 'helpers/types';
import { useArweaveProvider } from 'providers/ArweaveProvider';

import * as S from './styles';

export default function SwapTokenTransfer() {
	const arProvider = useArweaveProvider();

	const [show, setShow] = React.useState<boolean>(false);
	const [walletTokenBalance, setWalletTokenBalance] = React.useState<number | null>(null);
	const [loading, setLoading] = React.useState<boolean>(false);
	const [response, setResponse] = React.useState<NotificationType | null>(null);
	const [processed, setProcessed] = React.useState<boolean>(false);

	React.useEffect(() => {
		(async function () {
			if (arProvider.walletAddress && arProvider.profile && arProvider.profile.id) {
				try {
					const tokenBalance = await readHandler({
						processId: AOS.token,
						action: 'Balance',
						tags: [{ name: 'Recipient', value: arProvider.walletAddress }],
					});

					if (tokenBalance !== null) {
						setWalletTokenBalance(tokenBalance);
					}
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [arProvider.walletAddress, arProvider.profile, arProvider.tokenBalances]);

	async function handleTransfer() {
		if (arProvider.wallet && arProvider.profile && arProvider.profile.id) {
			setLoading(true);
			try {
				const response = await messageResult({
					processId: AOS.token,
					wallet: arProvider.wallet,
					action: 'Transfer',
					tags: [
						{ name: 'Recipient', value: arProvider.profile.id },
						{ name: 'Quantity', value: walletTokenBalance.toString() },
					],
					data: null,
				});

				setProcessed(true);

				if (response) {
					if (response['Debit-Notice'] && response['Credit-Notice']) {
						arProvider.setToggleTokenBalanceUpdate(!arProvider.toggleTokenBalanceUpdate);
						setResponse({
							message: 'Balance transferred!',
							status: 'success',
						});
					} else {
						setResponse({
							message: 'Error transferring balanace',
							status: 'warning',
						});
					}
				} else {
					setResponse({
						message: 'Transfer aborted',
						status: 'warning',
					});
				}
			} catch (e: any) {
				console.error(e);
			}
			setLoading(false);
		}
	}

	return (
		<>
			{walletTokenBalance !== null && walletTokenBalance > 0 && (
				<S.Wrapper>
					<button onClick={() => setShow(true)}>Transfer Wrapped AR to Agent</button>
				</S.Wrapper>
			)}
			{show && (
				<Modal header={'Transfer Wrapped AR'} handleClose={() => setShow(false)}>
					<S.MWrapper className={'modal-wrapper'}>
						<p>
							Wrapped AR was detected in your wallet. In order to buy assets in Bazar, this balance must be transferred
							to your personal agent process.
						</p>
						<p>Would you like to transfer this balance to continue ?</p>
						<S.TransferAmount>
							<span>Transfer amount: </span>
							<CurrencyLine amount={walletTokenBalance} currency={AOS.token} />
						</S.TransferAmount>
						<S.ActionsWrapper>
							<Button
								type={'warning'}
								label={'Cancel'}
								handlePress={() => setShow(false)}
								disabled={loading || processed}
								height={45}
							/>
							<Button
								type={'alt1'}
								label={'Yes, execute transfer'}
								handlePress={handleTransfer}
								disabled={loading || processed}
								loading={loading}
								height={45}
							/>
						</S.ActionsWrapper>
					</S.MWrapper>
				</Modal>
			)}
			{response && (
				<Notification
					message={response.message}
					type={response.status}
					callback={() => {
						setResponse(null);
						setShow(false);
					}}
				/>
			)}
		</>
	);
}
