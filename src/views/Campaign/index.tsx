import React from 'react';
import { ReactSVG } from 'react-svg';

import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { ASSET_SORT_OPTIONS, ASSETS } from 'helpers/config';
import { formatAddress } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

type AssetStateType = {
	id: string;
	description: string;
	completed: boolean;
	claimable: boolean;
};

const ASSET_CONFIG: any = [
	{ id: 'ptmfcEJv2SFtH6GtJ4AzJyq2AEr_ANOvEEjPjvgphQo', description: 'The Omega One' },
	{ id: 'ptmfcEJv2SFtH6GtJ4AzJyq2AEr_ANOvEEjPjvgphQo', description: 'The Omega One' },
	{ id: 'ptmfcEJv2SFtH6GtJ4AzJyq2AEr_ANOvEEjPjvgphQo', description: 'The Omega One' },
	{ id: 'ptmfcEJv2SFtH6GtJ4AzJyq2AEr_ANOvEEjPjvgphQo', description: 'The Omega One' },
	{ id: 'ptmfcEJv2SFtH6GtJ4AzJyq2AEr_ANOvEEjPjvgphQo', description: 'The Omega One' },
];

export default function Campaign() {
	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);

	const [assets, setAssets] = React.useState<AssetStateType[]>(
		ASSET_CONFIG.map((asset: { id: string; description: string }) => ({ ...asset, completed: false, claimable: false }))
	);

	const [claimingAsset, setClaimingAsset] = React.useState<boolean>(false);

	const profile = React.useMemo(() => {
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
			<S.ProfileWrapper onClick={action} completed={completed}>
				<S.ProfileIndicator completed={completed} />
				<span>{label}</span>
			</S.ProfileWrapper>
		);
	}, [arProvider.profile, arProvider.walletAddress]);

	async function handleClaim(id: string, index: number) {
		setClaimingAsset(true);
		// const gridElement = document.getElementById(`grid-element-${index}`);

		// if (gridElement) {
		// 	gridElement.classList.add('shine');

		// 	setTimeout(() => {
		// 		gridElement.classList.remove('shine');
		// 		setClaimingAsset(false);
		// 	}, 1000);
		// }

		setTimeout(() => {
			setClaimingAsset(false);
		}, 1000);

		console.log('Claiming asset', id);
	}

	return (
		<>
			<S.Wrapper className={'border-wrapper-alt2 fade-in'}>
				<S.Header>
					<h1>DumDum the Omega One</h1>
					<p>
						Collect five unique atomic assets by completing each quest. Complete the set to unlock the powerful Omega
						DumDum, the god of our futuristic Mayan temples, and claim rewards including merch and AR prizes. Connect
						your Arweave wallet, track your progress, and start earning today!
					</p>
					{profile}
				</S.Header>
				<S.Body>
					{assets.map((asset: AssetStateType, index: number) => (
						<S.GridElement key={index} className={'fade-in'} id={`grid-element-${index}`}>
							{!asset.completed && (
								<S.GridElementOverlay>
									{asset.claimable ? (
										<S.GridElementAction onClick={() => handleClaim(asset.id, index)} disabled={claimingAsset}>
											<span>{claimingAsset ? 'Claiming...' : 'Claim'}</span>
										</S.GridElementAction>
									) : (
										<ReactSVG src={ASSETS.question} />
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
