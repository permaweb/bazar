import React from 'react';
import { ReactSVG } from 'react-svg';

import { messageResult } from 'api';

import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { ASSETS } from 'helpers/config';
import { formatAddress } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

type AssetStateType = {
	id: string;
	description: string;
	claimable: boolean;
	completed: boolean;
};

// TODO: Description tooltips
const ASSET_CONFIG: any = [
	{ id: '8zclBmynj2Pet7JKTs2uKJYAl869NsRJNZ4TfczDlsA', description: 'The Omega One' },
	{ id: 'o7fO4UeDfHsDbraCgXgTK2GRCy7D2IDDVV_Kt7IxPpU', description: 'The Omega One' },
];

// TODO: Claimable check
export default function Campaign() {
	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);

	const [assets, setAssets] = React.useState<AssetStateType[]>(
		ASSET_CONFIG.map((asset: { id: string; description: string }) => ({ ...asset, claimable: false, completed: false }))
	);

	const [claimingAsset, setClaimingAsset] = React.useState<boolean>(false);

	React.useEffect(() => {
		(async function () {
			if (arProvider.walletAddress) {
				for (const asset of assets) {
					try {
						await messageResult({
							processId: asset.id,
							wallet: arProvider.wallet,
							action: 'Get-Deposit-Info',
							tags: [{ name: 'Address', value: arProvider.walletAddress }],
							data: null,
						});
					} catch (e) {
						console.error(e);
					}
				}

				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		})();
	}, [arProvider.walletAddress]);

	React.useEffect(() => {
		(async function () {
			if (arProvider.walletAddress) {
				// for (const asset of assets) {
				// 	try {
				// 		await messageResult({
				// 			processId: asset.id,
				// 			wallet: arProvider.wallet,
				// 			action: 'Get-Deposit-Info',
				// 			tags: [{ name: 'Address', value: arProvider.walletAddress }],
				// 			data: null,
				// 		});
				// 	} catch (e) {
				// 		console.error(e);
				// 	}
				// }

				for (const asset of assets) {
					try {
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
									prevAsset.id === asset.id ? { ...prevAsset, claimable: claimable, completed: completed } : prevAsset
								);
							});
						}
					} catch (e) {
						console.error(e);
					}
				}
			}
		})();
	}, [arProvider.walletAddress]);

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

	async function handleClaim(id: string, index: number) {
		setClaimingAsset(true);

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
				setAssets((prevAssets) => {
					return prevAssets.map((prevAsset) =>
						prevAsset.id === id ? { ...prevAsset, claimable: false, completed: true } : prevAsset
					);
				});
			}
		} catch (e) {
			console.error(e);
		}

		setClaimingAsset(false);
	}

	return (
		<>
			<S.Wrapper className={'border-wrapper-alt2 fade-in'}>
				<S.Header>
					<img src={`https://arweave.net/D8YXt7eVLQq1v4eZhTQUmO2rfWmoH4vaiBrTFy0Bvtk`} alt={'Atomic Asset'} />
					{subheader}
				</S.Header>
				<S.Body>
					{assets.map((asset: AssetStateType, index: number) => (
						<S.GridElement key={index} className={'fade-in'} id={`grid-element-${index}`} claimable={asset.claimable}>
							{!asset.completed && (
								<S.GridElementOverlay>
									{asset.claimable ? (
										<S.GridElementAction
											onClick={() => handleClaim(asset.id, index)}
											disabled={claimingAsset}
											className={'fade-in'}
										>
											<span>{claimingAsset ? 'Claiming...' : 'Claim'}</span>
										</S.GridElementAction>
									) : (
										<ReactSVG src={ASSETS.question} className={'fade-in'} />
									)}
								</S.GridElementOverlay>
							)}
							<img src={`https://arweave.net/${asset.id}`} alt={'Atomic Asset'} />
						</S.GridElement>
					))}
				</S.Body>
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
		</>
	);
}
