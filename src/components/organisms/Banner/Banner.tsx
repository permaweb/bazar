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

export default function Banner() {
	const arProvider = useArweaveProvider();

	const [showInfo, setShowInfo] = React.useState<boolean>(false);
	const [showTransfer, setShowTransfer] = React.useState<boolean>(false);

	const [walletTokenBalance, setWalletTokenBalance] = React.useState<number | null>(null);
	const [loading, setLoading] = React.useState<boolean>(false);
	const [response, setResponse] = React.useState<NotificationType | null>(null);
	const [processed, setProcessed] = React.useState<boolean>(false);

	React.useEffect(() => {
		(async function () {
			if (arProvider.walletAddress && arProvider.profile && arProvider.profile.id) {
				try {
					const tokenBalance = await readHandler({
						processId: AOS.defaultToken,
						action: 'Balance',
						tags: [{ name: 'Recipient', value: arProvider.walletAddress }],
					});

					if (tokenBalance !== null) {
						setWalletTokenBalance(tokenBalance);
						if (!sessionStorage.getItem('transferBalance')) setShowTransfer(true);
						sessionStorage.setItem('transferBalance', 'true');
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
					processId: AOS.defaultToken,
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
			<S.Wrapper>
				<button onClick={() => setShowInfo(true)}>Welcome to AO BazAR!</button>
				{walletTokenBalance !== null && walletTokenBalance > 0 && (
					<button onClick={() => setShowTransfer(true)}>
						Transfer wrapped AR to your personal process (permaweb profile)
					</button>
				)}
			</S.Wrapper>
			{showTransfer && (
				<Modal header={'Transfer Wrapped AR'} handleClose={() => setShowTransfer(false)}>
					<S.MWrapper className={'modal-wrapper'}>
						<p>
							Wrapped AR was detected in your wallet. In order to buy assets in BazAR, this balance must be transferred
							to your personal agent process (permaweb profile).
						</p>
						<p>Would you like to transfer this balance to continue ?</p>
						<S.TransferAmount>
							<span>Transfer amount: </span>
							<CurrencyLine amount={walletTokenBalance} currency={AOS.defaultToken} />
						</S.TransferAmount>
						<S.ActionsWrapper>
							<Button
								type={'warning'}
								label={'Cancel'}
								handlePress={() => setShowTransfer(false)}
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
			{showInfo && (
				<Modal header={'AO BazAR'} handleClose={() => setShowInfo(false)}>
					<S.MWrapper className={'modal-wrapper'}>
						<p>
							Welcome to AO BazAR!
							<br />
							<br />
							<b>A notable change in AO BazAR is the addition of the permaweb profile process.</b>
							<br />
							<br />
							To buy and sell assets in AO BazAR and upload through Helix you must create a permaweb profile.
							<br />
							<br />
							<b>How to create a permaweb profile</b>
							<br />
							<br />
							<b>Connect your Arweave wallet</b> - When you enter BazAR, the first step is to connect your Arweave
							wallet.
							<br />
							<br />
							<b>Create your profile</b> - After connecting your wallet, you create a permaweb profile. This profile is
							a unique AO process that you can customize with a name, @handle, description, profile picture, and banner.
							<br />
							<br />
							<b>How to send wAR to your profile process</b>
							<br />
							<br />
							<b>Swap or bridge to wAR</b> - You can swap for wAR with ArSwap, or bridge AR to wAR with AOX.
							<br />
							<br />
							<b>Send to your profile process</b> - When you connect to your profile onto BazaR, you will see a banner
							that detects wAR in your Arweave wallet. It will ask if you want to send the wAR from your Arweave wallet
							to your profile. Once the wAR is in your profile process, you will see the wAR amount update in your
							profile menu.
							<br />
							<br />
							<b>Note on permaweb profiles</b> - Your permaweb profile is a AO process which is owned by your Arweave
							wallet. This process carries out interactions with the UCM and holds custody to your atomic assets.
							Therefore atomic assets are owned by your AO process and not your wallet.
						</p>
					</S.MWrapper>
				</Modal>
			)}
			{response && (
				<Notification
					message={response.message}
					type={response.status}
					callback={() => {
						setResponse(null);
						setShowTransfer(false);
					}}
				/>
			)}
		</>
	);
}
