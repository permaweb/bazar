import React from 'react';

import { createDataItemSigner, message, result } from '@permaweb/aoconnect';

import { Button } from 'components/atoms/Button';
import { Notification } from 'components/atoms/Notification';
import { Modal } from 'components/molecules/Modal';
import { NotificationType } from 'helpers/types';
import { useArweaveProvider } from 'providers/ArweaveProvider';

import * as S from './styles';

// function patch() {
// 	const patch = `
// 		local AO_TESTNET = 'fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY'
// 		local SEC_PATCH = 'sec-patch-6-5-2024'

// 		if not Utils.includes(AO_TESTNET, ao.authorities) then
// 			table.insert(ao.authorities, AO_TESTNET)
// 		end
// 		if not Utils.includes(SEC_PATCH, Utils.map(Utils.prop('name'), Handlers.list)) then
// 			Handlers.prepend(SEC_PATCH,
// 			function (msg)
// 				return msg.From ~= msg.Owner and not ao.isTrusted(msg)
// 			end,
// 			function (msg)
// 				Send({Target = msg.From, Data = "Message is not trusted."})
// 				print("Message is not trusted. From: " .. msg.From .. " - Owner: " .. msg.Owner)
// 			end
// 			)
// 		end
// 		return "Added Patch Handler"
//   `;
// 	return patch;
// }

function creditNoticeForwarding() {
	const creditNoticeForwarding = `Handlers.add('Credit-Notice', Handlers.utils.hasMatchingTag('Action', 'Credit-Notice'),
	function(msg)
		if not msg.Tags.Sender or not msg.Tags.Quantity then
            ao.send({
                Target = msg.From,
                Action = 'Input-Error',
                Tags = {
                    Status = 'Error',
                    Message =
                    'Invalid arguments, required { Sender, Quantity }'
                }
            })
            return
        end

        local asset_index = -1
        for i, asset in ipairs(Assets) do
            if asset.Id == msg.From then
                asset_index = i
                break
            end
        end

		if asset_index > -1 then
            local updated_quantity = tonumber(Assets[asset_index].Quantity) + tonumber(msg.Tags.Quantity)

            Assets[asset_index].Quantity = tostring(updated_quantity)
        else
            table.insert(Assets, { Id = msg.From, Quantity = msg.Tags.Quantity })

            ao.send({
                Target = Owner,
                Action = 'Transfer-Success',
                Tags = {
                    Status = 'Success',
                    Message = 'Balance transferred'
                }
            })
        end

		if msg.Tags.Sender ~= Owner then
			local walletTransferTokens = { 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10' }
			local runWalletTransfer = false
			for _, value in pairs(walletTransferTokens) do
				if value == msg.From then
					runWalletTransfer = true
					break
				end
			end

			if runWalletTransfer then
				ao.send({
					Target = msg.From,
					Action = 'Transfer',
					Tags = {
						Recipient = Owner,
						Quantity = msg.Tags.Quantity
					}
				})
			end
		end
	end)
	`;
	return creditNoticeForwarding;
}

export default function Banner() {
	const arProvider = useArweaveProvider();

	const [showInfo, setShowInfo] = React.useState<boolean>(false);
	const [showUpdate, setShowUpdate] = React.useState<boolean>(false);
	const [showVouch, setShowVouch] = React.useState<boolean>(false);
	const [showVouchAlert, setShowVouchAlert] = React.useState<boolean>(false);

	const [updateApplied, setUpdateApplied] = React.useState<boolean>(true);

	const [loading, setLoading] = React.useState<boolean>(false);
	const [response, setResponse] = React.useState<NotificationType | null>(null);
	const [processed, setProcessed] = React.useState<boolean>(false);

	// Patch
	// React.useEffect(() => {
	// 	(async function () {
	// 		if (arProvider.walletAddress && arProvider.profile && arProvider.profile.id) {
	// 			try {
	// 				const evalMessage = await message({
	// 					process: arProvider.profile.id,
	// 					signer: createDataItemSigner(arProvider.wallet),
	// 					tags: [{ name: 'Action', value: 'Eval' }],
	// 					data: 'return Handlers.list[1].name',
	// 				});

	// 				const { Output } = await result({ message: evalMessage, process: arProvider.profile.id });

	// 				console.log(Output)

	// 				if (Output && Output.data && Output.data.output && Output.data.output !== 'sec-patch-6-5-2024') {
	// 					setShowUpdate(true);
	// 					setPatchApplied(false);
	// 				}
	// 			} catch (e: any) {
	// 				console.error(e);
	// 			}
	// 		}
	// 	})();
	// }, [arProvider.walletAddress, arProvider.profile, arProvider.tokenBalances]);

	// Credit notice forwarding
	React.useEffect(() => {
		(async function () {
			if (arProvider.walletAddress && arProvider.profile && arProvider.profile.id) {
				if (!arProvider.profile.version) {
					setShowUpdate(true);
					setUpdateApplied(false);
				}
			}
		})();
	}, [arProvider.walletAddress, arProvider.profile]);

	React.useEffect(() => {
		(async function () {
			if (arProvider.vouch) {
				if (!arProvider.vouch.isVouched) {
					setShowVouch(true);
				}
			}
		})();
	}, [arProvider.vouch]);

	React.useEffect(() => {
		(async function () {
			if (arProvider.vouch) {
				if (!arProvider.vouch.isVouched) {
					if (!localStorage.getItem('vouchAlert')) {
						setShowVouchAlert(true);
						localStorage.setItem('vouchAlert', 'true');
					}
				}
			}
		})();
	}, [arProvider.vouch, showVouch]);

	async function handleUpdate() {
		if (arProvider.wallet && arProvider.profile && arProvider.profile.id) {
			setLoading(true);
			try {
				// Patch
				// const evalMessage = await message({
				// 	process: arProvider.profile.id,
				// 	signer: createDataItemSigner(arProvider.wallet),
				// 	tags: [{ name: 'Action', value: 'Eval' }],
				// 	data: patch(),
				// });

				// Credit notice forwarding
				const evalVersionMessage = await message({
					process: arProvider.profile.id,
					signer: createDataItemSigner(arProvider.wallet),
					tags: [{ name: 'Action', value: 'Eval' }],
					data: `Profile.Version = '0.0.1'`,
				});

				console.log(evalVersionMessage);

				const evalUpdateMessage = await message({
					process: arProvider.profile.id,
					signer: createDataItemSigner(arProvider.wallet),
					tags: [{ name: 'Action', value: 'Eval' }],
					data: creditNoticeForwarding(),
				});

				console.log(evalUpdateMessage);

				const evalResult = await result({
					message: evalUpdateMessage,
					process: arProvider.profile.id,
				});

				console.log(evalResult);

				setProcessed(true);

				if (evalResult) {
					setResponse({
						message: 'Profile updated!',
						status: 'success',
					});
					setUpdateApplied(true);
					arProvider.setToggleProfileUpdate(!arProvider.toggleProfileUpdate);
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
			{!updateApplied && (
				<S.Wrapper>
					{/* <button onClick={() => setShowInfo(true)}>Welcome to AO Bazar!</button> */}
					{!updateApplied && <button onClick={() => setShowUpdate(true)}>Update your profile</button>}
				</S.Wrapper>
			)}
			{!updateApplied && showUpdate && (
				<Modal header={'Update your profile process!'} handleClose={() => setShowUpdate(false)}>
					<S.MWrapper className={'modal-wrapper'}>
						<p>An important update has been added to enhance the functionality of your profile.</p>
						<p>
							This update ensures that any received Wrapped AR will be sent to your wallet address by default. This will
							remove the need to transfer Wrapped AR back and forth between profile processes and wallet addresses.
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
			{showVouch && (
				<S.Wrapper>
					<button onClick={() => window.open('https://vouch-portal.arweave.net/#/', '_blank')}>Get vouched</button>
				</S.Wrapper>
			)}
			{showVouch && showVouchAlert && (
				<Modal header={'You are not vouched!'} handleClose={() => setShowVouchAlert(false)}>
					<S.MWrapper className={'modal-wrapper'}>
						<p>Bazar requires users to be vouched in order to interact with the UCM.</p>
						<S.ActionsWrapper>
							<Button type={'warning'} label={'Cancel'} handlePress={() => setShowVouchAlert(false)} height={45} />
							<Button
								type={'alt1'}
								label={'Get vouched'}
								handlePress={() => window.open('https://vouch-portal.arweave.net/#/', '_blank')}
								height={45}
							/>
						</S.ActionsWrapper>
					</S.MWrapper>
				</Modal>
			)}
			{showInfo && (
				<Modal header={'AO Bazar'} handleClose={() => setShowInfo(false)}>
					<S.MWrapper className={'modal-wrapper'}>
						<p>
							<b>Welcome to AO Bazar!</b>
							<br />
							<br />
							<b>A notable change in AO Bazar is the addition of the permaweb profile process.</b>
							<br />
							<br />
							To buy and sell assets in AO Bazar and upload through Helix you must create a permaweb profile.
							<br />
							<br />
							<b>How to create a permaweb profile</b>
							<br />
							<br />
							<b>Connect your Arweave wallet</b> - When you enter Bazar, the first step is to connect your Arweave
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
