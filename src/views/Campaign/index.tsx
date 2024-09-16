import React from 'react';
import { ReactSVG } from 'react-svg';

import { messageResult } from 'api';

import { Modal } from 'components/molecules/Modal';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { ASSETS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { formatAddress } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

type AssetStateType = {
	id: string;
	description: string;
	claimable: boolean;
	claimInProgress: boolean;
	completed: boolean;
};

const ASSET_CONFIG: any = [
	{
		id: 'dJsez6zKRTpC96Xv0Gvxs5vs3DnpG3gzo_IDnDAt9nw',
		description:
			'As you offer 0.05 stETH to the sacred pre-bridge, the ancient temples stir with newfound energy. A tremor runs through the earth as mystical glyphs illuminate beneath your feet. You have awakened the Left Leg of Omega DumDum—the first step in assembling the legendary deity revered by the ancients. Claim this relic and embark on your epic journey.',
	},
	{
		id: '4rMmuV-DEHNNA5-IP4UbtZw2ZFhlzDi26IkANEocALg',
		description:
			'Your tribute of 100 DAI has been accepted by the cosmic forces. Whispering winds carry tales of your valor as the Right Leg of Omega DumDum materializes from the shadows. With both legs now within reach, the path ahead becomes clearer and more resolute. Claim this piece to stride confidently toward your destiny.',
	},
	{
		id: 'IujU_Un0UywV5oGbMECBnJxwhGsrnV9RxccBaYgXui4',
		description:
			'After 48 continuous hours of unwavering commitment, the celestial gates part to reveal the Left Arm of Omega DumDum. This mighty limb symbolizes strength and perseverance. Ancient scripts glow brighter, acknowledging your dedication. Claim this powerful artifact and let it empower your quest onward.',
	},
	{
		id: 'SWYku9XeLjxnltjz13bBts1c4BeDl-oQVDe95dG3VFk',
		description:
			'Seven days of steadfast devotion have not gone unnoticed by the cosmic overseers. The Right Arm of Omega DumDum emerges, radiating with the energy of a thousand suns. This piece grants you the might to shape destinies. Claim it and wield the strength of legends as you near the culmination of your journey.',
	},
	{
		id: 'ViOeasxAhmTW-KwWM1CpnPOhAzyexlfJhA1PIZbsH34',
		description:
			'Fourteen days of unyielding loyalty culminate in this monumental moment. The heavens part as the Head of Omega DumDum descends, eyes ablaze with ancient wisdom and foresight. This final piece completes the sacred collection. Claim the Head and prepare to awaken the ultimate deity.',
	},
];

const OMEGA_ASSET = {
	id: '4SWaYpBL2A8CPDBowcEUdhls9k_sqSChL0wRJfMPQAk',
	description:
		'With all five sacred relics united, the time has come to summon Omega DumDum in all his divine glory. The temples resonate with ethereal chants as cosmic energies converge upon you. Stand ready, for you are among the chosen few to witness the rebirth of this legendary god. Claim Omega DumDum and unlock unparalleled rewards and mysteries untold.',
};

const BACKGROUND_TX = 'D8YXt7eVLQq1v4eZhTQUmO2rfWmoH4vaiBrTFy0Bvtk';

// TODO: Load all sub assets
// TODO: Claimable check hot update
// TODO: Description tooltips
// TODO: Handle primary claim
// TODO: Claim notification
// TODO: Footer disclaimer
// TODO: IP blocker

export default function Campaign() {
	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);

	const [assets, setAssets] = React.useState<AssetStateType[]>(
		ASSET_CONFIG.map((asset: { id: string; description: string }) => ({ ...asset, claimable: false, completed: false }))
	);

	const [primaryAsset, setPrimaryAsset] = React.useState<AssetStateType>({
		id: OMEGA_ASSET.id,
		description: OMEGA_ASSET.description,
		claimable: false,
		claimInProgress: false,
		completed: false,
	});

	const [fetching, setFetching] = React.useState<boolean>(false);
	const [currentView, setCurrentView] = React.useState<'SubSet' | 'Omega'>('SubSet');

	// const [claimResponse, setClaimResponse] = React.useState<{
	// 	assetId: string;
	// 	message: string;
	// }>(null);

	const [claimResponse, setClaimResponse] = React.useState<{
		assetId: string;
		message: string;
	}>({
		assetId: ASSET_CONFIG[0].id,
		message: ASSET_CONFIG[0].description,
	});

	React.useEffect(() => {
		(async function () {
			if (arProvider.walletAddress) {
				setFetching(true);

				switch (currentView) {
					case 'SubSet':
						for (const asset of assets) {
							try {
								messageResult({
									processId: asset.id,
									wallet: arProvider.wallet,
									action: 'Get-Mint-Report',
									tags: [{ name: 'Address', value: arProvider.walletAddress }],
									data: null,
								});
							} catch (e) {
								console.error(e);
							}
						}

						// await new Promise((resolve) => setTimeout(resolve, 0));

						for (const asset of assets) {
							try {
								// await messageResult({
								// 	processId: asset.id,
								// 	wallet: arProvider.wallet,
								// 	action: 'Get-Mint-Report',
								// 	tags: [{ name: 'Address', value: arProvider.walletAddress }],
								// 	data: null,
								// });

								const response = await messageResult({
									processId: asset.id,
									wallet: arProvider.wallet,
									action: 'Claim-Status',
									tags: [{ name: 'Address', value: arProvider.walletAddress }],
									data: null,
								});
								console.log(response);
								if (response && response['Claim-Status-Response'] && response['Claim-Status-Response'].status) {
									const claimable = response['Claim-Status-Response'].status === 'Claimable';
									const completed = response['Claim-Status-Response'].status === 'Claimed';

									setAssets((prevAssets) => {
										return prevAssets.map((prevAsset) =>
											prevAsset.id === asset.id
												? { ...prevAsset, claimable: claimable, completed: completed }
												: prevAsset
										);
									});
								}
							} catch (e) {
								console.error(e);
							}
						}
						break;
					case 'Omega':
						try {
							await messageResult({
								processId: primaryAsset.id,
								wallet: arProvider.wallet,
								action: 'Init-Claim-Check',
								tags: null,
								data: null,
							});

							await new Promise((resolve) => setTimeout(resolve, 1000));

							const response = await messageResult({
								processId: primaryAsset.id,
								wallet: arProvider.wallet,
								action: 'Claim-Status',
								tags: [{ name: 'Address', value: arProvider.walletAddress }],
								data: null,
							});

							console.log(response);
							if (response && response['Claim-Status-Response'] && response['Claim-Status-Response'].status) {
								const claimable = response['Claim-Status-Response'].status === 'Claimable';
								const completed = response['Claim-Status-Response'].status === 'Claimed';

								setPrimaryAsset({
									id: OMEGA_ASSET.id,
									description: OMEGA_ASSET.description,
									claimable: claimable,
									claimInProgress: false,
									completed: completed,
								});
							}
						} catch (e) {
							console.error(e);
						}
						break;
				}

				setFetching(false);
			} else {
				setAssets((prevAssets) => {
					return prevAssets.map((prevAsset) => ({ ...prevAsset, claimable: false, completed: false }));
				});

				setPrimaryAsset({
					id: OMEGA_ASSET.id,
					description: OMEGA_ASSET.description,
					claimable: false,
					claimInProgress: false,
					completed: false,
				});
			}
		})();
	}, [arProvider.walletAddress, currentView]);

	async function handleClaim(id: string, primaryAsset?: boolean) {
		if (primaryAsset) {
			setPrimaryAsset((prevAsset) => ({ ...prevAsset, claimInProgress: true }));
		} else {
			setAssets((prevAssets) => {
				return prevAssets.map((prevAsset) =>
					prevAsset.id === id ? { ...prevAsset, claimInProgress: true } : prevAsset
				);
			});
		}

		try {
			const response = await messageResult({
				processId: id,
				wallet: arProvider.wallet,
				action: 'Handle-Claim',
				tags: [{ name: 'Address', value: arProvider.walletAddress }],
				data: null,
			});
			console.log(response);
			if (response && response['Claim-Status-Response'] && response['Claim-Status-Response'].status === 'Claimed') {
				if (primaryAsset) {
					setPrimaryAsset((prevAsset) => ({ ...prevAsset, claimable: false, claimInProgress: false, completed: true }));
					setClaimResponse({
						assetId: id,
						message: OMEGA_ASSET.description,
					});
				} else {
					setAssets((prevAssets) => {
						return prevAssets.map((prevAsset) =>
							prevAsset.id === id
								? { ...prevAsset, claimable: false, claimInProgress: false, completed: true }
								: prevAsset
						);
					});
					setClaimResponse({
						assetId: id,
						message: ASSET_CONFIG.find((asset: { id: string }) => asset.id === id).description,
					});
				}
			}
		} catch (e) {
			console.error(e);
		}

		if (primaryAsset) {
			setPrimaryAsset((prevAsset) => ({ ...prevAsset, claimInProgress: false }));
		} else {
			setAssets((prevAssets) => {
				return prevAssets.map((prevAsset) =>
					prevAsset.id === id ? { ...prevAsset, claimInProgress: false } : prevAsset
				);
			});
		}
	}

	const subheader = React.useMemo(() => {
		let label: string;
		let action = null;

		if (!arProvider.walletAddress) {
			label = language.connectWallet;
			action = () => arProvider.setWalletModalVisible(true);
		} else {
			if (arProvider.profile) {
				if (arProvider.profile.id) {
					label = arProvider.profile.username;
				} else {
					label = language.createProfile;
					action = () => setShowProfileManage(true);
				}
			} else label = formatAddress(arProvider.walletAddress, false);
		}

		const completed = arProvider.profile && arProvider.profile.id !== null;

		return (
			<S.Subheader>
				<p>
					Collect five unique atomic assets by completing each quest. Complete the set to unlock the powerful Omega
					DumDum, the god of our futuristic Mayan temples, and claim rewards including merch and AR prizes. Connect your
					Arweave wallet, track your progress, and start earning today!
				</p>
				<S.ProfileWrapper onClick={action} completed={completed}>
					<S.ProfileIndicator completed={completed} />
					<span>{label}</span>
				</S.ProfileWrapper>
			</S.Subheader>
		);
	}, [arProvider.profile, arProvider.walletAddress]);

	const body = React.useMemo(() => {
		if (fetching) {
			return (
				<S.BodyLoading>
					<span>{currentView === 'SubSet' ? 'Fetching pieces of the Omega One...' : 'Fetching the Omega One...'}</span>
				</S.BodyLoading>
			);
		}

		switch (currentView) {
			case 'SubSet':
				return (
					<>
						{assets.map((asset: AssetStateType, index: number) => (
							<S.GridElement key={index} className={'fade-in'} id={`grid-element-${index}`} claimable={asset.claimable}>
								{!asset.completed && (
									<S.GridElementOverlay>
										{asset.claimable ? (
											<S.GridElementAction
												onClick={() => handleClaim(asset.id)}
												disabled={asset.claimInProgress}
												className={'fade-in'}
											>
												<span>{asset.claimInProgress ? 'Claiming...' : 'Claim'}</span>
											</S.GridElementAction>
										) : (
											<ReactSVG src={ASSETS.question} className={'fade-in'} />
										)}
									</S.GridElementOverlay>
								)}
								<img src={getTxEndpoint(asset.id)} alt={'Atomic Asset'} />
							</S.GridElement>
						))}
					</>
				);
			case 'Omega':
				return (
					<S.PrimaryAsset claimable={primaryAsset.claimable}>
						{!primaryAsset.completed && (
							<S.PrimaryAssetOverlay>
								{primaryAsset.claimable ? (
									<S.PrimaryAssetAction
										onClick={() => handleClaim(primaryAsset.id, true)}
										disabled={primaryAsset.claimInProgress}
										className={'fade-in'}
									>
										<span>{primaryAsset.claimInProgress ? 'Claiming...' : 'Claim'}</span>
									</S.PrimaryAssetAction>
								) : (
									<ReactSVG src={ASSETS.question} className={'fade-in'} />
								)}
							</S.PrimaryAssetOverlay>
						)}
						<img src={getTxEndpoint(primaryAsset.id)} alt={'Atomic Asset'} />
					</S.PrimaryAsset>
				);
		}
	}, [fetching, currentView, primaryAsset, assets]);

	const notification = React.useMemo(() => {
		if (claimResponse) {
			console.log(assets);
			return (
				<Modal header={null} handleClose={() => setClaimResponse(null)}>
					<S.MWrapper>
						<S.MTextWrapper>
							<p>Congratulations!</p>
							<span>You've earned</span>
						</S.MTextWrapper>
						<img src={getTxEndpoint(claimResponse.assetId)} alt={'Atomic Asset'} />
						<S.MDescription>
							<p>{claimResponse.message}</p>
						</S.MDescription>
						<S.MActionWrapper>
							<button onClick={() => setClaimResponse(null)}>Close</button>
						</S.MActionWrapper>
					</S.MWrapper>
				</Modal>
			);
		}
		return null;
	}, [claimResponse]);

	return (
		<>
			<S.Wrapper className={'border-wrapper-alt2 fade-in'}>
				<S.Header>
					<S.HeaderAction>
						<button onClick={() => setCurrentView(currentView === 'SubSet' ? 'Omega' : 'SubSet')}>
							<span>{currentView === 'SubSet' ? 'Visit the Omega One' : 'Visit pieces of the Omega One'}</span>
						</button>
					</S.HeaderAction>
					<img src={getTxEndpoint(BACKGROUND_TX)} alt={'Atomic Asset'} />
					{subheader}
				</S.Header>
				<S.Body>{body}</S.Body>
			</S.Wrapper>
			{showProfileManage && (
				<Panel
					open={showProfileManage}
					header={arProvider.profile && arProvider.profile.id ? language.editProfile : `${language.createProfile}!`}
					handleClose={() => setShowProfileManage(false)}
				>
					<S.PManageWrapper>
						<ProfileManage
							profile={arProvider.profile && arProvider.profile.id ? arProvider.profile : null}
							handleClose={() => setShowProfileManage(false)}
							handleUpdate={null}
						/>
					</S.PManageWrapper>
				</Panel>
			)}
			{claimResponse && notification}
		</>
	);
}
