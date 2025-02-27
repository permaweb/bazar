import React from 'react';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { messageResult, readHandler } from 'api';

import { Modal } from 'components/molecules/Modal';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { ASSETS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { formatAddress, formatCount } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

type AssetStateType = {
	id: string;
	name: string;
	cover: string;
	info: string;
	claimRedirect: string;
	claimable: boolean;
	claimInProgress: boolean;
	claimed: boolean;
};

const MAIN_PROCESS = 'paQoFK6zVdqjHSY_s-O0Hzu_HD50zOUAWk-WibMDe8g';

const BRIDGE_DRIVE_VERSION_KEY = 'bridge-drive-version';
const CURRENT_VERSION = '2.4';
const DRIVE_CONFIG_KEY = 'drive-config';

export default function Campaign() {
	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);

	const [assets, setAssets] = React.useState<AssetStateType[] | null>(null);
	const [primaryAsset, setPrimaryAsset] = React.useState<AssetStateType | null>(null);

	const [fetching, setFetching] = React.useState<boolean>(false);
	const [currentView, setCurrentView] = React.useState<'SubSet' | 'Main' | null>(null);

	const [claimsCount, setClaimsCount] = React.useState<{ current: string; total: string } | null>(null);
	const [toggleClaimCheck, setToggleClaimCheck] = React.useState<boolean>(false);

	const [claimNotification, setClaimNotification] = React.useState<{ assetId: string }>(null);

	React.useEffect(() => {
		(async function () {
			setCurrentView(null);
			setFetching(true);
			try {
				let config: any;
				const storedVersion = localStorage.getItem(BRIDGE_DRIVE_VERSION_KEY);
				const storedConfig = localStorage.getItem(DRIVE_CONFIG_KEY);

				if (storedConfig) {
					config = JSON.parse(storedConfig);
				}

				if (!storedConfig || storedVersion !== CURRENT_VERSION) {
					try {
						const response = await readHandler({
							processId: MAIN_PROCESS,
							action: 'Get-Config',
						});

						localStorage.setItem(DRIVE_CONFIG_KEY, JSON.stringify(response));
						localStorage.setItem(BRIDGE_DRIVE_VERSION_KEY, CURRENT_VERSION);
						config = JSON.parse(localStorage.getItem(DRIVE_CONFIG_KEY));
					} catch (e) {
						console.error('Failed to fetch drive config:', e);
					}
				}

				try {
					setPrimaryAsset({
						id: MAIN_PROCESS,
						name: config.Name,
						cover: config.Cover,
						info: config.Info,
						claimRedirect: null,
						claimable: false,
						claimInProgress: false,
						claimed: false,
					});

					setAssets(
						Object.keys(config.Assets)
							.map((key) => ({
								index: config.Assets[key].GridPlacement,
								id: config.Assets[key].Id,
								name: config.Assets[key].Name,
								cover: config.Assets[key].Cover,
								info: config.Assets[key].Info,
								claimRedirect: config.Assets[key].ClaimRedirect,
								claimable: false,
								claimInProgress: false,
								claimed: false,
							}))
							.sort((a, b) => {
								return parseInt(a.index) - parseInt(b.index);
							})
					);

					const claimsResponse = await readHandler({
						processId: MAIN_PROCESS,
						action: 'Get-Total-Claims',
					});

					if (claimsResponse && claimsResponse.CurrentClaims && claimsResponse.TotalSupply) {
						setClaimsCount({ current: claimsResponse.CurrentClaims, total: claimsResponse.TotalSupply });
					}
				} catch (e) {
					console.error(e);
				}
			} catch (e) {
				console.error(e);
			}
		})();
	}, [arProvider.walletAddress]);

	React.useEffect(() => {
		(async function () {
			if (arProvider.profile && arProvider.profile.id) {
				try {
					await checkClaimStatus('Main', null);
				} catch (e) {
					console.error(e);
				}
			}
		})();
	}, [arProvider.walletAddress, arProvider.profile]);

	React.useEffect(() => {
		(async function () {
			if (primaryAsset && (primaryAsset.claimable || primaryAsset.claimed)) {
				setCurrentView('Main');
				setFetching(false);
			} else {
				setCurrentView('SubSet');
			}
		})();
	}, [primaryAsset]);

	React.useEffect(() => {
		(async function () {
			if (currentView && arProvider.walletAddress) {
				switch (currentView) {
					case 'SubSet':
						setFetching(true);
						try {
							await checkClaimStatus('SubSet', arProvider.walletAddress);
							setFetching(false);
						} catch (e) {
							console.error(e);
						}
						break;
					case 'Main':
						break;
				}
			}
		})();
	}, [currentView, arProvider.walletAddress, arProvider.profile, toggleClaimCheck]);

	async function checkClaimStatus(type: 'SubSet' | 'Main', userAddress: string | null) {
		const ids = type === 'SubSet' && assets && assets.length > 0 ? assets.map((asset) => asset.id) : [MAIN_PROCESS];

		const tags = [{ name: 'Address', value: arProvider.walletAddress }];
		if (arProvider.profile && arProvider.profile.id) {
			tags.push({ name: 'ProfileId', value: arProvider.profile.id });
		}
		if (userAddress) {
			tags.push({ name: 'UserAddress', value: userAddress });
		}

		try {
			for (const id of ids) {
				await messageResult({
					processId: id,
					wallet: arProvider.wallet,
					action: 'Init-Claim-Check',
					tags: tags,
					data: null,
				});
			}

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
					const claimed = response['Claim-Status-Response'].status === 'Claimed';

					switch (type) {
						case 'SubSet':
							if (assets) {
								setAssets((prevAssets) => {
									return prevAssets.map((prevAsset) =>
										prevAsset.id === id ? { ...prevAsset, claimable: claimable, claimed: claimed } : prevAsset
									);
								});
							}
							break;
						case 'Main':
							setPrimaryAsset((prevAsset) => ({ ...prevAsset, claimable: claimable, claimed: claimed }));
							break;
					}
				}
			}
		} catch (e) {
			console.error(e);
		}
	}

	async function handleClaim(e: any, id: string, usePrimaryAsset?: boolean) {
		e.preventDefault();
		e.stopPropagation();
		if (usePrimaryAsset) {
			setPrimaryAsset((prevAsset) => ({ ...prevAsset, claimInProgress: true }));
		} else {
			if (assets) {
				setAssets((prevAssets) => {
					return prevAssets.map((prevAsset) =>
						prevAsset.id === id ? { ...prevAsset, claimInProgress: true } : prevAsset
					);
				});
			}
		}

		const tags = [{ name: 'Address', value: arProvider.walletAddress }];
		tags.push({ name: 'ProfileId', value: arProvider.profile?.id ?? arProvider.walletAddress });

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
					setPrimaryAsset((prevAsset) => ({ ...prevAsset, claimable: false, claimInProgress: false, claimed: true }));
					setClaimNotification({ assetId: id });
				} else {
					if (assets) {
						setAssets((prevAssets) => {
							return prevAssets.map((prevAsset) =>
								prevAsset.id === id
									? { ...prevAsset, claimable: false, claimInProgress: false, claimed: true }
									: prevAsset
							);
						});
					}
					setClaimNotification({ assetId: id });
				}
			}
		} catch (e) {
			console.error(e);
		}

		if (usePrimaryAsset) {
			setPrimaryAsset((prevAsset) => ({ ...prevAsset, claimInProgress: false }));
		} else {
			if (assets) {
				setAssets((prevAssets) => {
					return prevAssets.map((prevAsset) =>
						prevAsset.id === id ? { ...prevAsset, claimInProgress: false } : prevAsset
					);
				});
			}
		}
	}

	function getLoader() {
		return (
			<S.BodyLoading className={'fade-in'}>
				<img src={getTxEndpoint('U0k8z-2EDScxE6PYcGbWBJP_7pBlwg1CALZ9-CjvOEY')} alt={'Atomic Asset'} />
			</S.BodyLoading>
		);
	}

	function getAssetGrid() {
		if (assets) {
			return (
				<>
					{assets.map((asset: AssetStateType, index: number) => (
						<S.GridElement
							key={index}
							className={'fade-in'}
							id={`grid-element-${index}`}
							claimable={asset.claimable}
							claimed={asset.claimed}
						>
							<Link to={`${URLS.asset}${asset.id}`} target={'_blank'}>
								{!asset.claimed && (
									<S.GridElementOverlay>
										{asset.claimable ? (
											<S.GridElementAction
												onClick={(e) => handleClaim(e, asset.id)}
												disabled={!assets || asset.claimInProgress}
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
							</Link>
							<S.GridElementInfoWrapper>
								<a href={asset.claimRedirect} target={'_blank'}>
									{asset.info}
								</a>
							</S.GridElementInfoWrapper>
						</S.GridElement>
					))}
				</>
			);
		}
		return getLoader();
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

		const active = arProvider.walletAddress !== null;

		return (
			<S.Subheader>
				<p>
					The Dumdum trials are here! Unlock the Bronze, Silver, and Gold Dumdum to reveal the ultra-rare Platinum
					Dumdum. A challenge fit for the ultimate collector. Are you up for it?
				</p>
				<S.ProfileWrapper onClick={action} active={active}>
					<S.ProfileIndicator active={active} />
					<span>{label}</span>
				</S.ProfileWrapper>
			</S.Subheader>
		);
	}, [arProvider.profile, arProvider.walletAddress]);

	const body = React.useMemo(() => {
		if (!arProvider.walletAddress) {
			return getAssetGrid();
		} else if (fetching) {
			return getLoader();
		} else {
			if (assets) {
				switch (currentView) {
					case 'SubSet':
						return getAssetGrid();
					case 'Main':
						return (
							<S.PrimaryAssetWrapper>
								<S.PrimaryAsset claimable={primaryAsset.claimable} claimed={primaryAsset.claimed}>
									<Link to={`${URLS.asset}${primaryAsset.id}`} target={'_blank'}>
										{!primaryAsset.claimed && (
											<S.GridElementOverlay>
												{primaryAsset.claimable ? (
													<S.GridElementAction
														onClick={(e) => handleClaim(e, primaryAsset.id)}
														disabled={!assets || primaryAsset.claimInProgress}
														className={'fade-in'}
													>
														<span>{primaryAsset.claimInProgress ? 'Claiming...' : 'Claim'}</span>
													</S.GridElementAction>
												) : (
													<ReactSVG src={ASSETS.question} className={'fade-in'} />
												)}
											</S.GridElementOverlay>
										)}
										<video src={getTxEndpoint(primaryAsset.id)} muted autoPlay loop />
									</Link>
								</S.PrimaryAsset>
								{primaryAsset.claimed && (
									<S.AssetTextWrapper>
										<p>Congratulations!</p>
										<span>You've earned</span>
										<span>The Platinum DumDum</span>
									</S.AssetTextWrapper>
								)}
							</S.PrimaryAssetWrapper>
						);
				}
			} else return null;
		}
	}, [fetching, currentView, primaryAsset, assets, arProvider.walletAddress]);

	function getAssetName(id: string, isMainAsset: boolean) {
		if (isMainAsset) return primaryAsset.name || 'Platinum DumDum';
		return assets?.find((asset: AssetStateType) => asset.id === id).name || 'DumDum';
	}

	const notification = React.useMemo(() => {
		if (claimNotification) {
			return (
				<Modal header={null} handleClose={() => setClaimNotification(null)}>
					<S.MWrapper className={'fade-in'} primaryAsset={claimNotification.assetId === MAIN_PROCESS}>
						<S.MContentWrapper>
							<S.AssetTextWrapper>
								<p>Congratulations!</p>
								<span>You've unlocked</span>
							</S.AssetTextWrapper>
							<img src={getTxEndpoint(claimNotification.assetId)} alt={'Atomic Asset'} />
							<S.AssetTextWrapper>
								<span>{getAssetName(claimNotification.assetId, claimNotification.assetId === MAIN_PROCESS)}</span>
							</S.AssetTextWrapper>
						</S.MContentWrapper>
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
		return (
			<>
				<S.Wrapper className={'border-wrapper-alt2 fade-in'}>
					<S.Header>
						<S.HeaderMain>
							<h1>DumDum Trials</h1>
						</S.HeaderMain>
						{subheader}
						{claimsCount && currentView === 'Main' && (
							<S.ClaimsWrapper>
								<span>
									{formatCount(claimsCount.current)} / {formatCount(claimsCount.total)} Claimed
								</span>
							</S.ClaimsWrapper>
						)}
					</S.Header>
					<S.Body>{body}</S.Body>
					<S.ViewAction className={'fade-in'}>
						<button
							onClick={() => setCurrentView(currentView === 'SubSet' ? 'Main' : 'SubSet')}
							disabled={!assets || fetching || !arProvider.walletAddress}
						>
							<span>{currentView === 'SubSet' ? 'Reveal Platinum DumDum' : 'Go Back'}</span>
						</button>
					</S.ViewAction>
					{currentView === 'SubSet' && (
						<S.SyncAction className={'fade-in'}>
							<button
								onClick={() => setToggleClaimCheck(!toggleClaimCheck)}
								disabled={!assets || fetching || !arProvider.walletAddress}
							>
								<span>{fetching ? 'Checking claims...' : 'Run claim checks'}</span>
							</button>
						</S.SyncAction>
					)}
					{/* <S.Footer>
						<p>
							· New DAI deposits and updated wAR balances may take up to 1 hour to trigger eligibility for these atomic
							assets.
						</p>
						<br />
						<p>
							· The 5 relics of Omega Dumdum are non transferable (soulbound). However, the final Omega Dumdum atomic
							asset is transferable and can be traded on Bazar.
						</p>
						<br />
						<p>
							· Persons in the US cannot participate in AO bridging and are therefore not eligible for these prizes, or
							for AO bridging rewards.
						</p>
					</S.Footer> */}
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
