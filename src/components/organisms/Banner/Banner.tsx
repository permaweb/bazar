import React from 'react';

import { createDataItemSigner, message, result } from '@permaweb/aoconnect';

import { Button } from 'components/atoms/Button';
import { Notification } from 'components/atoms/Notification';
import { Modal } from 'components/molecules/Modal';
import { NotificationType } from 'helpers/types';
import { useArweaveProvider } from 'providers/ArweaveProvider';

import * as S from './styles';

export function patch() {
	const patch = `
  local AO_TESTNET = 'fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY'
  local SEC_PATCH = 'sec-patch-6-5-2024'
  
  if not Utils.includes(AO_TESTNET, ao.authorities) then
	table.insert(ao.authorities, AO_TESTNET)
  end
  if not Utils.includes(SEC_PATCH, Utils.map(Utils.prop('name'), Handlers.list)) then
	Handlers.prepend(SEC_PATCH, 
	  function (msg)
		return msg.From ~= msg.Owner and not ao.isTrusted(msg)
	  end,
	  function (msg)
		Send({Target = msg.From, Data = "Message is not trusted."})
		print("Message is not trusted. From: " .. msg.From .. " - Owner: " .. msg.Owner)
	  end
	)
  end
  return "Added Patch Handler"
  `;
	return patch;
}

export default function Banner() {
	const arProvider = useArweaveProvider();

	const [showInfo, setShowInfo] = React.useState<boolean>(false);
	const [showUpdate, setShowUpdate] = React.useState<boolean>(false);

	const [patchApplied, setPatchApplied] = React.useState<boolean>(true);

	const [loading, setLoading] = React.useState<boolean>(false);
	const [response, setResponse] = React.useState<NotificationType | null>(null);
	const [processed, setProcessed] = React.useState<boolean>(false);

	React.useEffect(() => {
		(async function () {
			if (arProvider.walletAddress && arProvider.profile && arProvider.profile.id) {
				try {
					const evalMessage = await message({
						process: arProvider.profile.id,
						signer: createDataItemSigner(arProvider.wallet),
						tags: [{ name: 'Action', value: 'Eval' }],
						data: 'return Handlers.list[1].name',
					});

					const { Output } = await result({ message: evalMessage, process: arProvider.profile.id });

					if (Output && Output.data && Output.data.output && Output.data.output !== 'sec-patch-6-5-2024') {
						setShowUpdate(true);
						setPatchApplied(false);
					}
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [arProvider.walletAddress, arProvider.profile, arProvider.tokenBalances]);

	async function handleUpdate() {
		if (arProvider.wallet && arProvider.profile && arProvider.profile.id) {
			setLoading(true);
			try {
				const evalMessage = await message({
					process: arProvider.profile.id,
					signer: createDataItemSigner(arProvider.wallet),
					tags: [{ name: 'Action', value: 'Eval' }],
					data: patch(),
				});

				console.log(evalMessage);

				const evalResult = await result({
					message: evalMessage,
					process: arProvider.profile.id,
				});

				console.log(evalResult);

				setProcessed(true);

				if (evalResult) {
					setResponse({
						message: 'Profile updated!',
						status: 'success',
					});
					setPatchApplied(true);
				} else {
					setResponse({
						message: 'Error updating profile',
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
				{!patchApplied && <button onClick={() => setShowUpdate(true)}>Update your profile</button>}
			</S.Wrapper>
			{!patchApplied && showUpdate && (
				<Modal header={'Update your profile process!'} handleClose={() => setShowUpdate(false)}>
					<S.MWrapper>
						<p>An important security feature has been added to enhance the security of your profile.</p>
						<p>
							This update ensures that only trusted messages are processed by your profile, protecting your data and
							interactions. It is highly recommended to apply this update to maintain the integrity and security of your
							profile.
						</p>
						<p>Would you like to continue and apply this update ?</p>
						<S.ActionsWrapper>
							<Button
								type={'warning'}
								label={'Cancel'}
								handlePress={() => setShowUpdate(false)}
								disabled={loading || processed}
								height={45}
							/>
							<Button
								type={'alt1'}
								label={'Yes, update my profile'}
								handlePress={handleUpdate}
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
							<b>Welcome to AO BazAR!</b>
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
							a unique AO process that you can customize with a name, username, bio, avatar, and banner.
							<br />
							<br />
							Your permaweb profile is a AO process which is owned by your Arweave wallet. This process carries out
							interactions with the UCM and holds custody to your atomic assets. Therefore atomic assets are owned by
							your AO process and not your wallet.
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
						setShowUpdate(false);
					}}
				/>
			)}
		</>
	);
}
