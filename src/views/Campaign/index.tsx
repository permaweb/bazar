import React from 'react';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { messageResult, readHandler } from 'api';

import { Loader } from 'components/atoms/Loader';
import { Modal } from 'components/molecules/Modal';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { ASSETS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { formatAddress } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

type AssetStateType = {
	id: string;
	cover: string;
	info: string;
	claimResponse: string;
	claimRedirect: string;
	claimable: boolean;
	claimInProgress: boolean;
	completed: boolean;
};

const MAIN_PROCESS = '4SWaYpBL2A8CPDBowcEUdhls9k_sqSChL0wRJfMPQAk';

// TODO: Silhouettes (done)
// TODO: Links to mint / war depot (done)
// TODO: IP blocker (done)
// TODO: Footer disclaimer (done)
// TODO: Profile Id only (done)
// TODO: Send assets to profile (done)
// TODO: Load assets from config (done)
// TODO: Claimable check hot update (done)
// TODO: Claim notification (done)
// TODO: Handle primary claim
// TODO: Audio
// TODO: Landing popup
// TODO: Loading state
// TODO: Multiple wallet popups
// TODO: Link to asset when claimed

function BlockMessage() {
	return (
		<S.BlockWrapper className={'fade-in'}>
			<S.BlockMessage>
				<p>Unfortunately, US persons are not eligible for bridging rewards or prizes on this page.</p>
			</S.BlockMessage>
			<Link to={URLS.base}>Go back</Link>
		</S.BlockWrapper>
	);
}

export default function Campaign() {
	const arProvider = useArweaveProvider();

	const audioRef = React.useRef<HTMLAudioElement | null>(null);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);

	const [assets, setAssets] = React.useState<AssetStateType[] | null>(null);
	const [primaryAsset, setPrimaryAsset] = React.useState<AssetStateType | null>(null);

	const [fetching, setFetching] = React.useState<boolean>(false);
	const [currentView, setCurrentView] = React.useState<'SubSet' | 'Main' | null>(null);

	const [audioPlaying, setAudioPlaying] = React.useState<boolean>(false);

	const [blockLoading, setBlockLoading] = React.useState<boolean>(false);
	const [isBlocked, setIsBlocked] = React.useState<boolean>(false);

	const [claimNotification, setClaimNotification] = React.useState<{
		assetId: string;
		message: string;
	}>(null);

	React.useEffect(() => {
		const checkLocation = async () => {
			setBlockLoading(true);
			try {
				const response = await fetch(`https://ipinfo.io?token=04c286535ab4dc`);
				const data = await response.json();
				if (data.country === 'US') {
					setIsBlocked(true);
				}
			} catch (error) {
				console.error('Error fetching location data', error.message);
			}
			setBlockLoading(false);
		};

		checkLocation();
	}, []);

	React.useEffect(() => {
		(async function () {
			setFetching(true);
			try {
				if (!localStorage.getItem('drive-config')) {
					const response = await readHandler({
						processId: MAIN_PROCESS,
						action: 'Get-Config',
					});
					localStorage.setItem('drive-config', JSON.stringify(response));
				}
				const config = JSON.parse(localStorage.getItem('drive-config'));

				try {
					setPrimaryAsset({
						id: MAIN_PROCESS,
						cover: config.Cover,
						info: config.Info,
						claimResponse: config.ClaimResponse,
						claimRedirect: null,
						claimable: false,
						claimInProgress: false,
						completed: false,
					});

					setAssets(
						Object.keys(config.Assets)
							.map((key) => ({
								index: config.Assets[key].GridPlacement,
								id: config.Assets[key].Id,
								cover: config.Assets[key].Cover,
								info: config.Assets[key].Info,
								claimResponse: config.Assets[key].ClaimResponse,
								claimRedirect: config.Assets[key].ClaimRedirect,
								claimable: false,
								claimInProgress: false,
								completed: false,
							}))
							.sort((a, b) => {
								return parseInt(a.index) - parseInt(b.index);
							})
					);
				} catch (e) {
					console.error(e);
				}
			} catch (e) {
				console.error(e);
			}
		})();
	}, []);

	React.useEffect(() => {
		(async function () {
			if (arProvider.profile && arProvider.profile.id) {
				try {
					await checkClaimStatus('Main');
					setFetching(false);
				} catch (e) {
					console.error(e);
				}
			}
		})();
	}, [arProvider.walletAddress, arProvider.profile]);

	React.useEffect(() => {
		(async function () {
			if (primaryAsset && (primaryAsset.claimable || primaryAsset.completed)) {
				setCurrentView('Main');
			} else {
				setCurrentView('SubSet');
			}
		})();
	}, [primaryAsset]);

	React.useEffect(() => {
		(async function () {
			if (currentView && arProvider.walletAddress && arProvider.profile && arProvider.profile.id) {
				switch (currentView) {
					case 'SubSet':
						await checkClaimStatus('SubSet');
						break;
					case 'Main':
						break;
				}
			}
		})();
	}, [currentView, arProvider.walletAddress, arProvider.profile]);

	async function checkClaimStatus(type: 'SubSet' | 'Main') {
		const ids = type === 'SubSet' && assets && assets.length > 0 ? assets.map((asset) => asset.id) : [MAIN_PROCESS];

		const tags = [{ name: 'Address', value: arProvider.walletAddress }];
		if (arProvider.profile && arProvider.profile.id) {
			tags.push({ name: 'ProfileId', value: arProvider.profile.id });
		}

		try {
			for (const id of ids) {
				messageResult({
					processId: id,
					wallet: arProvider.wallet,
					action: 'Init-Claim-Check',
					tags: tags,
					data: null,
				});
			}

			for (let i = 0; i < 2; i++) {
				for (const id of ids) {
					const response = await messageResult({
						processId: id,
						wallet: arProvider.wallet,
						action: 'Get-Claim-Status',
						tags: tags,
						data: null,
					});
					if (response && response['Claim-Status-Response'] && response['Claim-Status-Response'].status) {
						const claimable = response['Claim-Status-Response'].status === 'Claimable';
						const completed = response['Claim-Status-Response'].status === 'Claimed';

						switch (type) {
							case 'SubSet':
								setAssets((prevAssets) => {
									return prevAssets.map((prevAsset) =>
										prevAsset.id === id ? { ...prevAsset, claimable: claimable, completed: completed } : prevAsset
									);
								});
								break;
							case 'Main':
								setPrimaryAsset((prevAsset) => ({ ...prevAsset, claimable: claimable, completed: completed }));
								break;
						}
					}
				}
			}
		} catch (e) {
			console.error(e);
		}
	}

	async function handleClaim(id: string, usePrimaryAsset?: boolean) {
		if (usePrimaryAsset) {
			setPrimaryAsset((prevAsset) => ({ ...prevAsset, claimInProgress: true }));
		} else {
			setAssets((prevAssets) => {
				return prevAssets.map((prevAsset) =>
					prevAsset.id === id ? { ...prevAsset, claimInProgress: true } : prevAsset
				);
			});
		}

		const tags = [{ name: 'Address', value: arProvider.walletAddress }];
		if (arProvider.profile && arProvider.profile.id) {
			tags.push({ name: 'ProfileId', value: arProvider.profile.id });
		}

		try {
			const response = await messageResult({
				processId: id,
				wallet: arProvider.wallet,
				action: 'Handle-Claim',
				tags: tags,
				data: null,
			});
			if (response && response['Claim-Status-Response'] && response['Claim-Status-Response'].status === 'Claimed') {
				if (usePrimaryAsset) {
					setPrimaryAsset((prevAsset) => ({ ...prevAsset, claimable: false, claimInProgress: false, completed: true }));
					setClaimNotification({
						assetId: id,
						message: primaryAsset.claimResponse,
					});
				} else {
					setAssets((prevAssets) => {
						return prevAssets.map((prevAsset) =>
							prevAsset.id === id
								? { ...prevAsset, claimable: false, claimInProgress: false, completed: true }
								: prevAsset
						);
					});
					setClaimNotification({
						assetId: id,
						message: assets.find((asset: { id: string }) => asset.id === id).claimResponse,
					});
				}
			}
		} catch (e) {
			console.error(e);
		}

		if (usePrimaryAsset) {
			setPrimaryAsset((prevAsset) => ({ ...prevAsset, claimInProgress: false }));
		} else {
			setAssets((prevAssets) => {
				return prevAssets.map((prevAsset) =>
					prevAsset.id === id ? { ...prevAsset, claimInProgress: false } : prevAsset
				);
			});
		}
	}

	const toggleAudio = () => {
		if (audioRef.current) {
			if (audioPlaying) {
				audioRef.current.pause();
			} else {
				audioRef.current.play();
			}
			setAudioPlaying(!audioPlaying);
		}
	};

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
					A tomb opens, and a legend stirs. Do you have what it takes to awaken The Omega One? Complete each quest
					below, and claim all 5 pieces of the puzzle to summon the ultra rare Omega Dumdum. Only true Arweavers can
					finish these tasks. Good luck.
				</p>
				<S.ProfileWrapper onClick={action} completed={completed}>
					<S.ProfileIndicator completed={completed} />
					<span>{label}</span>
				</S.ProfileWrapper>
			</S.Subheader>
		);
	}, [arProvider.profile, arProvider.walletAddress]);

	const body = React.useMemo(() => {
		if (!arProvider.walletAddress) {
			return (
				<S.BodyLoading className={'fade-in'}>
					<span>{language.connectWallet}</span>
				</S.BodyLoading>
			);
		} else if (fetching) {
			return (
				<S.BodyLoading className={'fade-in'}>
					<span>{`${language.fetching}...`}</span>
				</S.BodyLoading>
			);
		} else {
			if (assets) {
				switch (currentView) {
					case 'SubSet':
						return (
							<>
								{assets.map((asset: AssetStateType, index: number) => (
									<S.GridElement
										key={index}
										className={'fade-in'}
										id={`grid-element-${index}`}
										claimable={asset.claimable}
									>
										{asset.completed ? (
											<img src={getTxEndpoint(asset.id)} alt={'Atomic Asset'} />
										) : (
											<>
												<S.GridElementOverlay>
													{asset.claimable ? (
														<S.GridElementAction
															onClick={() => handleClaim(asset.id)}
															disabled={!assets || asset.claimInProgress}
															className={'fade-in'}
														>
															<span>{asset.claimInProgress ? 'Claiming...' : 'Claim'}</span>
														</S.GridElementAction>
													) : (
														<ReactSVG src={ASSETS.question} className={'fade-in'} />
													)}
												</S.GridElementOverlay>
												<img src={getTxEndpoint(asset.cover)} alt={'Atomic Asset'} />
											</>
										)}
										{!asset.claimable && !asset.completed && (
											<S.GridElementLink href={asset.claimRedirect} target={'_blank'} />
										)}
									</S.GridElement>
								))}
							</>
						);
					case 'Main':
						return (
							<S.PrimaryAssetWrapper>
								<S.PrimaryAsset claimable={primaryAsset.claimable}>
									{primaryAsset.completed ? (
										<img src={getTxEndpoint(primaryAsset.id)} alt={'Atomic Asset'} />
									) : (
										<>
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
											<img src={getTxEndpoint(primaryAsset.cover)} alt={'Atomic Asset'} />
										</>
									)}
								</S.PrimaryAsset>
								{primaryAsset.completed && (
									<S.AssetTextWrapper>
										<p>Congratulations!</p>
										<span>You've earned</span>
										<span>The Legendary DumDum Omega</span>
									</S.AssetTextWrapper>
								)}
							</S.PrimaryAssetWrapper>
						);
				}
			} else return null;
		}
	}, [fetching, currentView, primaryAsset, assets, arProvider.walletAddress]);

	const notification = React.useMemo(() => {
		if (claimNotification) {
			return (
				<Modal header={null} handleClose={() => setClaimNotification(null)}>
					<S.MWrapper className={'fade-in'} primaryAsset={claimNotification.assetId === MAIN_PROCESS}>
						<S.AssetTextWrapper>
							<p>Congratulations!</p>
							<span>You've unlocked</span>
						</S.AssetTextWrapper>
						<img src={getTxEndpoint(claimNotification.assetId)} alt={'Atomic Asset'} />
						<S.MDescription>
							<p>{claimNotification.message}</p>
						</S.MDescription>
						<S.MActionWrapper>
							<button onClick={() => setClaimNotification(null)}>Close</button>
						</S.MActionWrapper>
					</S.MWrapper>
				</Modal>
			);
		}
		return null;
	}, [claimNotification]);

	function getView() {
		if (blockLoading) return <Loader />;
		if (isBlocked) return <BlockMessage />;
		return (
			<>
				<S.Wrapper className={'border-wrapper-alt2 fade-in'}>
					<S.AudioWrapper>
						<button onClick={() => toggleAudio()} title={audioPlaying ? 'Pause' : 'Play'}>
							<ReactSVG src={audioPlaying ? ASSETS.pause : ASSETS.play} />
						</button>
						<audio ref={audioRef} loop>
							<source src={`https://arweave.net/YsDMcgdBS-L9d-t1LVd4m45GRZRjSHkiG1Qr6UT9pNw`} type="audio/wav" />
							Your browser does not support the audio element.
						</audio>
					</S.AudioWrapper>
					<S.Header>
						<img src={getTxEndpoint('D8YXt7eVLQq1v4eZhTQUmO2rfWmoH4vaiBrTFy0Bvtk')} alt={'Atomic Asset'} />
						{subheader}
						<S.HeaderAction className={'fade-in'}>
							<button
								onClick={() => setCurrentView(currentView === 'SubSet' ? 'Main' : 'SubSet')}
								disabled={!assets || fetching || !arProvider.walletAddress}
							>
								<span>{currentView === 'SubSet' ? 'Visit the Omega One' : 'Visit relics of the Omega One'}</span>
							</button>
						</S.HeaderAction>
					</S.Header>
					<S.Body>{body}</S.Body>
					<S.Footer>
						<p>US persons not eligible for bridging rewards or prizes on this page.</p>
					</S.Footer>
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
				{claimNotification && notification}
			</>
		);
	}

	return getView();
}
