import React from 'react';
import { useSelector } from 'react-redux';

import { getCollections } from 'api';

import { Button } from 'components/atoms/Button';
import { Notification } from 'components/atoms/Notification';
import { Modal } from 'components/molecules/Modal';
import { AO } from 'helpers/config';
import { NotificationType } from 'helpers/types';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { RootState } from 'store';

import * as S from './styles';

// function creditNoticeForwarding() {
// 	const creditNoticeForwarding = `Handlers.add('Credit-Notice', Handlers.utils.hasMatchingTag('Action', 'Credit-Notice'),
// 	function(msg)
// 		if not msg.Tags.Sender or not msg.Tags.Quantity then
//             ao.send({
//                 Target = msg.From,
//                 Action = 'Input-Error',
//                 Tags = {
//                     Status = 'Error',
//                     Message =
//                     'Invalid arguments, required { Sender, Quantity }'
//                 }
//             })
//             return
//         end

//         local asset_index = -1
//         for i, asset in ipairs(Assets) do
//             if asset.Id == msg.From then
//                 asset_index = i
//                 break
//             end
//         end

// 		if asset_index > -1 then
//             local updated_quantity = tonumber(Assets[asset_index].Quantity) + tonumber(msg.Tags.Quantity)

//             Assets[asset_index].Quantity = tostring(updated_quantity)
//         else
//             table.insert(Assets, { Id = msg.From, Quantity = msg.Tags.Quantity })

//             ao.send({
//                 Target = Owner,
//                 Action = 'Transfer-Success',
//                 Tags = {
//                     Status = 'Success',
//                     Message = 'Balance transferred'
//                 }
//             })
//         end

// 		if msg.Tags.Sender ~= Owner then
// 			local walletTransferTokens = { 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10' }
// 			local runWalletTransfer = false
// 			for _, value in pairs(walletTransferTokens) do
// 				if value == msg.From then
// 					runWalletTransfer = true
// 					break
// 				end
// 			end

// 			if runWalletTransfer then
// 				ao.send({
// 					Target = msg.From,
// 					Action = 'Transfer',
// 					Tags = {
// 						Recipient = Owner,
// 						Quantity = msg.Tags.Quantity
// 					}
// 				})
// 			end
// 		end
// 	end)
// 	`;
// 	return creditNoticeForwarding;
// }

export default function Banner() {
	const ucmReducer = useSelector((state: RootState) => state.ucmReducer);

	const arProvider = useArweaveProvider();
	const permawebProvider = usePermawebProvider();

	// const [showInfo, setShowInfo] = React.useState<boolean>(false);
	const [showUpdate, setShowUpdate] = React.useState<boolean>(false);

	// const [showVouch, setShowVouch] = React.useState<boolean>(false);
	// const [showVouchAlert, setShowVouchAlert] = React.useState<boolean>(false);

	const [loading, setLoading] = React.useState<boolean>(false);
	const [updateApplied, setUpdateApplied] = React.useState<boolean>(true);
	const [response, setResponse] = React.useState<NotificationType | null>(null);

	// const [processed, setProcessed] = React.useState<boolean>(false);

	// Profile Migration
	React.useEffect(() => {
		(async function () {
			if (permawebProvider.profile?.isLegacyProfile) {
				setUpdateApplied(false);
				setShowUpdate(true);
			}
		})();
	}, [permawebProvider.profile]);

	// Credit notice forwarding
	// React.useEffect(() => {
	// 	(async function () {
	// 		if (arProvider.walletAddress && permawebProvider.profile && permawebProvider.profile.id) {
	// 			if (!permawebProvider.profile.version) {
	// 				setShowUpdate(true);
	// 				setUpdateApplied(false);
	// 			}
	// 		}
	// 	})();
	// }, [arProvider.walletAddress, permawebProvider.profile]);

	// React.useEffect(() => {
	// 	(async function () {
	// 		setShowVouch(false);
	// 		if (arProvider.vouch) {
	// 			if (!arProvider.vouch.isVouched) {
	// 				setShowVouch(true);
	// 			}
	// 		}
	// 	})();
	// }, [arProvider.vouch, arProvider.walletAddress]);

	// React.useEffect(() => {
	// 	(async function () {
	// 		if (arProvider.vouch) {
	// 			if (!arProvider.vouch.isVouched) {
	// 				if (!localStorage.getItem('vouchAlert')) {
	// 					setShowVouchAlert(true);
	// 					localStorage.setItem('vouchAlert', 'true');
	// 				}
	// 			}
	// 		}
	// 	})();
	// }, [arProvider.vouch, arProvider.walletAddress, showVouch]);

	// async function handleUpdate() {
	// 	if (arProvider.wallet && permawebProvider.profile && permawebProvider.profile.id) {
	// 		setLoading(true);
	// 		try {
	// 			// Patch
	// 			// const evalMessage = await message({
	// 			// 	process: permawebProvider.profile.id,
	// 			// 	signer: createDataItemSigner(arProvider.wallet),
	// 			// 	tags: [{ name: 'Action', value: 'Eval' }],
	// 			// 	data: patch(),
	// 			// });

	// 			// Credit notice forwarding
	// 			const evalVersionMessage = await message({
	// 				process: permawebProvider.profile.id,
	// 				signer: createDataItemSigner(arProvider.wallet),
	// 				tags: [{ name: 'Action', value: 'Eval' }],
	// 				data: `Profile.Version = '0.0.1'`,
	// 			});

	// 			console.log(evalVersionMessage);

	// 			const evalUpdateMessage = await message({
	// 				process: permawebProvider.profile.id,
	// 				signer: createDataItemSigner(arProvider.wallet),
	// 				tags: [{ name: 'Action', value: 'Eval' }],
	// 				data: creditNoticeForwarding(),
	// 			});

	// 			console.log(evalUpdateMessage);

	// 			const evalResult = await result({
	// 				message: evalUpdateMessage,
	// 				process: permawebProvider.profile.id,
	// 			});

	// 			console.log(evalResult);

	// 			setProcessed(true);

	// 			if (evalResult) {
	// 				setResponse({
	// 					message: 'Profile updated!',
	// 					status: 'success',
	// 				});
	// 				setUpdateApplied(true);
	// 				arProvider.setToggleProfileUpdate(!arProvider.toggleProfileUpdate);
	// 			} else {
	// 				setResponse({
	// 					message: 'Error updating profile',
	// 					status: 'warning',
	// 				});
	// 			}
	// 		} catch (e: any) {
	// 			console.error(e);
	// 		}
	// 		setLoading(false);
	// 	}
	// }

	async function handleUpdate() {
		if (arProvider.wallet && permawebProvider.profile?.isLegacyProfile && ucmReducer?.Orderbook?.length > 0) {
			setLoading(true);
			try {
				console.log('Creating new profile...');

				const args: any = {
					username: permawebProvider.profile.username,
					displayName: permawebProvider.profile.displayName,
				};

				if (permawebProvider.profile.description) args.description = permawebProvider.profile.description;
				if (permawebProvider.profile.banner) args.banner = permawebProvider.profile.banner;
				if (permawebProvider.profile.thumbnail) args.thumbnail = permawebProvider.profile.thumbnail;

				const newProfileId = await permawebProvider.libs.createProfile(args, (status: any) =>
					console.log(`Callback: ${status}`)
				);

				permawebProvider.handleInitialProfileCache(arProvider.walletAddress, newProfileId);

				console.log(`Profile ID: ${newProfileId}`);

				console.log('Migrating listings...');
				const listingMigrationResult = await permawebProvider.libs.sendMessage({
					processId: permawebProvider.profile.id,
					action: 'Run-Action',
					data: {
						Target: AO.ucm,
						Action: 'Migrate-Listings',
						Input: {
							MigrateTo: newProfileId,
						},
					},
				});
				console.log(`Listing migration: ${listingMigrationResult}`);

				console.log('Migrating streak...');
				const streakMigrationResult = await permawebProvider.libs.sendMessage({
					processId: permawebProvider.profile.id,
					action: 'Run-Action',
					data: {
						Target: AO.pixl,
						Action: 'Migrate-Streak',
						Input: {
							MigrateTo: newProfileId,
						},
					},
				});
				console.log(`Streak migration: ${streakMigrationResult}`);

				console.log('Transferring assets...');
				for (const asset of permawebProvider.profile.assets) {
					console.log(`Getting balance of asset: ${asset}`);
					const assetBalance = await permawebProvider.libs.readProcess({
						processId: asset,
						action: 'Balance',
						tags: [{ name: 'Recipient', value: permawebProvider.profile.id }],
					});

					if (assetBalance !== null) {
						console.log(`Transferring balance to new profile...`);
						const transferResponse = await permawebProvider.libs.sendMessage({
							processId: permawebProvider.profile.id,
							action: 'Transfer',
							tags: [
								{ name: 'Target', value: asset },
								{ name: 'Recipient', value: newProfileId },
								{ name: 'Quantity', value: assetBalance.toString() },
							],
						});

						console.log(`Transfer: ${transferResponse}`);
					}
				}

				console.log('Checking collections...');
				const collectionsByUser = await getCollections(permawebProvider.profile.id);

				if (collectionsByUser?.length > 0) {
					console.log('Adding collections');
					const collectionUpdateId = await permawebProvider.libs.updateZone(
						{ Collections: collectionsByUser.map((collection: any) => collection.id) },
						newProfileId,
						arProvider.wallet
					);
					console.log(`Collection update: ${collectionUpdateId}`);
				}

				setUpdateApplied(true);
				setResponse({ status: 'success', message: 'Profile migrated!' });
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
					{/* {showVouch && (
						<button onClick={() => window.open('https://vouch-portal.arweave.net/#/', '_blank')}>Get vouched</button>
					)} */}
					{!updateApplied && <button onClick={() => setShowUpdate(true)}>Update your profile</button>}
				</S.Wrapper>
			)}

			{!updateApplied && showUpdate && (
				<Modal header={'Update your profile process!'} handleClose={() => setShowUpdate(false)}>
					<S.MWrapper className={'modal-wrapper'}>
						<p>An important update has been added to enhance the functionality of your profile.</p>
						<p>
							This update will create a new profile process which will contain AO Mainnet Patch. With this update there
							will no longer be a need to dry run your profile process. All of your currently owned assets will be
							transferred to your new profile process as well as your streak. Any of your open listings will be migrated
							to your new profile as well.
						</p>
						<p>Would you like to continue and apply this update ?</p>
						<S.ActionsWrapper>
							<Button
								type={'warning'}
								label={'Cancel'}
								handlePress={() => setShowUpdate(false)}
								disabled={loading || updateApplied}
								height={45}
							/>
							<Button
								type={'alt1'}
								label={'Yes, update my profile'}
								handlePress={handleUpdate}
								disabled={loading || updateApplied}
								loading={loading}
								height={45}
							/>
						</S.ActionsWrapper>
					</S.MWrapper>
				</Modal>
			)}

			{/* {showVouch && showVouchAlert && (
				<Modal header={'You are not vouched!'} handleClose={() => setShowVouchAlert(false)}>
					<S.MWrapper className={'modal-wrapper'}>
						<p>Bazar requires users to be vouched in order to earn PIXL and maintain their streaks.</p>
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
			)} */}

			{/* {showInfo && (
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
			)} */}

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
