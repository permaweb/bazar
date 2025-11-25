import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

import { getProfiles } from 'api';

import * as GS from 'app/styles';
import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { IconButton } from 'components/atoms/IconButton';
import { Loader } from 'components/atoms/Loader';
import { Modal } from 'components/molecules/Modal';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { Tabs } from 'components/molecules/Tabs';
import { AssetData } from 'components/organisms/AssetData';
import { OrderCancel } from 'components/organisms/OrderCancel';
import { ASSETS, STYLING } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { ListingType, OwnerType } from 'helpers/types';
import { formatCount, getOwners, sortOrders } from 'helpers/utils';
import * as windowUtils from 'helpers/window';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { useTokenProvider } from 'providers/TokenProvider';
import { RootState } from 'store';

import { AssetActionActivity } from './AssetActionActivity';
import { AssetActionComments } from './AssetActionComments';
import { AssetActionMarket } from './AssetActionMarket';
import { AssetActionsOwners } from './AssetActionOwners';
import * as S from './styles';
import { IProps } from './types';

const GROUP_COUNT = 250;

export default function AssetAction(props: IProps) {
	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);
	const profilesReducer = useSelector((state: RootState) => state.profilesReducer);

	const permawebProvider = usePermawebProvider();
	const arProvider = useArweaveProvider();
	const tokenProvider = useTokenProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const ACTION_TAB_OPTIONS = {
		market: language.market,
		owners: language.owners,
		comments: language.comments,
		activity: language.activity,
	};

	const ACTION_TABS = [
		{
			label: ACTION_TAB_OPTIONS.market,
			icon: ASSETS.market,
		},
		{
			label: ACTION_TAB_OPTIONS.activity,
			icon: ASSETS.activity,
		},
		// {
		// 	label: ACTION_TAB_OPTIONS.owners,
		// 	icon: ASSETS.users,
		// },
	];

	const [mobile, setMobile] = React.useState(!windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.secondary)));

	const [_totalAssetBalance, setTotalAssetBalance] = React.useState<number>(0);

	const [addressGroups, setAddressGroups] = React.useState<string[][] | null>(null);
	const [ownerCount, setOwnerCount] = React.useState<number | null>(null);
	const [ownersCursor, setOwnersCursor] = React.useState<number>(0);
	const [updating, setUpdating] = React.useState<boolean>(false);

	const [currentOwners, setCurrentOwners] = React.useState<OwnerType[] | null>(null);
	const [currentListings, setCurrentListings] = React.useState<ListingType[] | null>(null);
	const [currentBids, setCurrentBids] = React.useState<ListingType[] | null>(null);

	const [showCurrentOwnersModal, setShowCurrentOwnersModal] = React.useState<boolean>(false);
	const [showCurrentListingsModal, setShowCurrentListingsModal] = React.useState<boolean>(false);
	const [showCurrentBidsModal, setShowCurrentBidsModal] = React.useState<boolean>(false);

	const [currentTab, setCurrentTab] = React.useState<string>(ACTION_TABS[0]!.label);
	const [urlCopied, setUrlCopied] = React.useState<boolean>(false);

	React.useEffect(() => {
		if (props.asset && props.asset.state?.balances) {
			const balances: any = Object.keys(props.asset.state.balances).map((address: string) => {
				return Number(props.asset.state.balances[address]);
			});
			const totalBalance = balances.reduce((a: number, b: number) => a + b, 0);
			setTotalAssetBalance(totalBalance);
			setOwnerCount(
				Object.keys(props.asset.state.balances).filter((owner: string) => owner !== props.asset.orderbook?.id).length
			);
		}
	}, [props.asset]);

	React.useEffect(() => {
		(async function () {
			const associatedAddresses = [];
			if (props.asset && props.asset.state && props.asset.state?.balances) {
				associatedAddresses.push(...Object.keys(props.asset.state.balances).map((address: string) => address));
			}
			if (props.asset && props.asset.orderbook?.orders) {
				associatedAddresses.push(...props.asset.orderbook?.orders.map((order: any) => order.creator));
			}
			if (associatedAddresses.length) {
				let groups = [];
				for (let i = 0, j = 0; i < associatedAddresses.length; i += GROUP_COUNT, j++) {
					groups[j] = associatedAddresses.slice(i, i + GROUP_COUNT);
				}
				setAddressGroups(groups);
			}
		})();
	}, [props.asset]);

	React.useEffect(() => {
		(async function () {
			if (props.asset && props.asset.state && addressGroups && addressGroups.length > 0) {
				setUpdating(true);
				try {
					let subAddresses = {};
					addressGroups[ownersCursor].forEach((address: string) => {
						if (props.asset.state?.balances?.hasOwnProperty(address)) {
							subAddresses[address] = props.asset.state.balances[address];
						}
					});

					const asset = {
						data: props.asset.data,
						state: {
							name: props.asset.state.name,
							ticker: props.asset.state.ticker,
							denomination: props.asset.state.denomination,
							logo: props.asset.state.logo,
							transferable: props.asset.state.transferable,
							balances: subAddresses,
						},
						orderbook: {
							id: props.asset.orderbook?.id,
							orders: props.asset.orderbook?.orders,
						},
					};

					let profiles: any[] = await getProfiles(addressGroups[ownersCursor]);
					let owners = getOwners(asset, profiles);

					if (owners) {
						owners = owners
							.filter((owner: OwnerType) => owner.address !== props.asset.orderbook?.id)
							.filter((owner: OwnerType) => owner.ownerPercentage > 0);
						setCurrentOwners((prevOwners) => {
							const allOwners = [...(prevOwners || []), ...owners];
							const uniqueOwners = Array.from(new Map(allOwners.map((owner) => [owner.address, owner])).values());
							return uniqueOwners;
						});
					}
				} catch (e: any) {
					console.error(e);
				}
				setUpdating(false);
			}
		})();
	}, [props.asset, addressGroups, ownersCursor, profilesReducer?.registryProfiles]);

	React.useEffect(() => {
		(async function () {
			if (props.asset && props.asset.orderbook?.id) {
				// Check if orders are already available
				if (props.asset.orderbook?.orders) {
					if (props.asset.orderbook.orders.length > 0) {
						// Separate asks and bids
						const askOrders = props.asset.orderbook.orders.filter((order: any) => !order.side || order.side === 'Ask');
						const bidOrders = props.asset.orderbook.orders.filter((order: any) => order.side === 'Bid');

						const sortedAsks = sortOrders(askOrders, 'low-to-high');
						const sortedBids = sortOrders(bidOrders, 'high-to-low');

						// Get profiles for all orders
						const allCreators = [...sortedAsks, ...sortedBids].map((order: any) => order.creator);
						let profiles: any[] = await getProfiles(allCreators);

						// Map asks
						const mappedListings = sortedAsks.map((order: any) => {
							let currentProfile = null;
							if (profiles) {
								currentProfile = profiles.find((profile: any) => profile.id === order.creator);
							}

							return {
								profile: currentProfile || null,
								orderbookId: props.asset.orderbook.id,
								...order,
							};
						});

						// Map bids
						const mappedBids = sortedBids.map((order: any) => {
							let currentProfile = null;
							if (profiles) {
								currentProfile = profiles.find((profile: any) => profile.id === order.creator);
							}

							return {
								profile: currentProfile || null,
								orderbookId: props.asset.orderbook.id,
								...order,
							};
						});

						setCurrentListings(mappedListings);
						setCurrentBids(mappedBids);
					} else {
						setCurrentListings([]);
						setCurrentBids([]);
					}
				}
				// else {
				// 	// Fetch orders from orderbook (for global orderbook or when orders not loaded)
				// 	try {
				// 		const response = await permawebProvider.libs.readState({
				// 			processId: props.asset.orderbook.id,
				// 			path: 'asset',
				// 			fallbackAction: 'Info',
				// 		});

				// 		if (response?.Orderbook) {
				// 			const assetPairs = response.Orderbook.filter(
				// 				(pair: any) => pair.Pair && pair.Pair.includes(props.asset.data.id)
				// 			);

				// 			let allOrders: any[] = [];

				// 			assetPairs.forEach((pair: any) => {
				// 				if (pair.Orders && Array.isArray(pair.Orders)) {
				// 					const pairOrders = pair.Orders.map((order: any) => ({
				// 						creator: order.Creator || order.creator,
				// 						dateCreated: order.DateCreated || order.dateCreated,
				// 						id: order.Id || order.id,
				// 						originalQuantity: order.OriginalQuantity || order.originalQuantity,
				// 						quantity: order.Quantity || order.quantity,
				// 						token: order.Token || order.token,
				// 						currency: pair.Pair[1],
				// 						price: order.Price || order.price || '0',
				// 					}));
				// 					allOrders = allOrders.concat(pairOrders);
				// 				}
				// 			});

				// 			if (allOrders.length > 0) {
				// 				const sortedOrders = sortOrders(allOrders, 'low-to-high');

				// 				let profiles: any[] = await getProfiles(sortedOrders.map((order: any) => order.creator));
				// 				const mappedListings = sortedOrders.map((order: any) => {
				// 					let currentProfile = null;
				// 					if (profiles) {
				// 						currentProfile = profiles.find((profile: any) => profile.id === order.creator);
				// 					}

				// 					const currentListing = {
				// 						profile: currentProfile || null,
				// 						orderbookId: props.asset.orderbook.id,
				// 						...order,
				// 					};

				// 					return currentListing;
				// 				});

				// 				setCurrentListings(mappedListings);
				// 			} else {
				// 				setCurrentListings([]);
				// 			}
				// 		} else {
				// 			setCurrentListings([]);
				// 		}
				// 	} catch (error) {
				// 		console.error('Error fetching orderbook orders:', error);
				// 		setCurrentListings([]);
				// 	}
				// }
			}
		})();
	}, [props.asset]);

	React.useEffect(() => {
		if (currentListings && currentListings.length <= 0) setShowCurrentListingsModal(false);
	}, [currentListings]);

	React.useEffect(() => {
		if (currentBids && currentBids.length <= 0) setShowCurrentBidsModal(false);
	}, [currentBids]);

	function handleWindowResize() {
		if (windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.secondary))) {
			setMobile(false);
		} else {
			setMobile(true);
		}
	}

	windowUtils.checkWindowResize(handleWindowResize);

	function getDenominatedTokenValue(amount: number, currency: string) {
		if (
			currenciesReducer &&
			currenciesReducer[currency] &&
			currenciesReducer[currency].Denomination &&
			currenciesReducer[currency].Denomination > 1
		) {
			const denomination = currenciesReducer[currency].Denomination;
			return `${formatCount((amount / Math.pow(10, denomination)).toString())}`;
		} else if (
			props.asset &&
			props.asset.state &&
			props.asset.state.denomination &&
			props.asset.state.denomination > 1
		) {
			const denomination = props.asset.state.denomination;
			return `${formatCount((amount / Math.pow(10, denomination)).toString())}`;
		} else return formatCount(amount.toString());
	}

	function getOwnerOrder(listing: ListingType) {
		if (!arProvider.walletAddress) return false;
		if (!permawebProvider.profile || !permawebProvider.profile.id) return false;
		return listing.creator === permawebProvider.profile.id || listing.creator === arProvider.walletAddress;
	}

	const copyPageUrl = React.useCallback(async () => {
		await navigator.clipboard.writeText(window.location.href);
		setUrlCopied(true);
		setTimeout(() => setUrlCopied(false), 2000);
	}, []);

	const getCurrentOwners = React.useMemo(() => {
		return (
			<>
				{!mobile && (
					<GS.DrawerHeaderWrapper>
						<GS.DrawerContentFlex>
							{language.owner.charAt(0).toUpperCase() + language.owner.slice(1)}
						</GS.DrawerContentFlex>
						<GS.DrawerContentDetail>{language.quantity}</GS.DrawerContentDetail>
						{/* <GS.DrawerContentDetail>{language.percentage}</GS.DrawerContentDetail> */}
					</GS.DrawerHeaderWrapper>
				)}
				{currentOwners &&
					currentOwners.length > 0 &&
					currentOwners.map((owner: OwnerType, index: number) => {
						return (
							<S.DrawerContentLine key={index}>
								{mobile && (
									<S.MDrawerHeader>
										<GS.DrawerContentHeader>
											{language.owner.charAt(0).toUpperCase() + language.owner.slice(1)}
										</GS.DrawerContentHeader>
									</S.MDrawerHeader>
								)}
								<S.DrawerContentFlex>
									<OwnerLine owner={owner} callback={() => setShowCurrentOwnersModal(false)} />
								</S.DrawerContentFlex>
								{mobile && (
									<S.MDrawerHeader>
										<GS.DrawerContentHeader>{language.quantity}</GS.DrawerContentHeader>
									</S.MDrawerHeader>
								)}
								<S.DrawerContentDetailAlt>
									{getDenominatedTokenValue(owner.ownerQuantity, props.asset.data.id)}
								</S.DrawerContentDetailAlt>
								{/* {mobile && (
									<S.MDrawerHeader>
										<GS.DrawerContentHeader>{language.percentage}</GS.DrawerContentHeader>
									</S.MDrawerHeader>
								)} */}
								{/* <S.DrawerContentDetailAlt>{formatPercentage(owner.ownerPercentage)}</S.DrawerContentDetailAlt> */}
							</S.DrawerContentLine>
						);
					})}
				{(!currentOwners || updating) && (
					<S.MLoadingWrapper>
						<Loader sm relative />
					</S.MLoadingWrapper>
				)}
				{ownerCount && ownerCount > GROUP_COUNT && (
					<S.MActionsWrapper>
						<Button
							type={'primary'}
							label={language.close}
							handlePress={() => setShowCurrentOwnersModal(false)}
							disabled={false}
							height={40}
						/>
						<Button
							type={'alt1'}
							label={language.loadMore}
							handlePress={() => setOwnersCursor(ownersCursor + 1)}
							disabled={
								(addressGroups && addressGroups.length > 0 ? ownersCursor >= addressGroups.length - 1 : true) ||
								updating
							}
							height={40}
						/>
					</S.MActionsWrapper>
				)}
			</>
		);
	}, [currentOwners, mobile, updating]);

	const getCurrentListings = React.useMemo(() => {
		const filteredListings = currentListings?.filter(
			(listing: ListingType) => listing.currency === tokenProvider.selectedToken.id
		);
		if (filteredListings?.length > 0) {
			return (
				<>
					{!mobile && (
						<GS.DrawerHeaderWrapper>
							<GS.DrawerContentFlex>{'Asks'}</GS.DrawerContentFlex>
							<GS.DrawerContentDetail>{language.quantity}</GS.DrawerContentDetail>
							{/* <GS.DrawerContentDetail>{language.percentage}</GS.DrawerContentDetail> */}
							<GS.DrawerContentDetail>{language.unitPrice}</GS.DrawerContentDetail>
						</GS.DrawerHeaderWrapper>
					)}
					{filteredListings.map((listing: ListingType, index: number) => {
						return (
							<S.DrawerContentLine key={index}>
								{mobile && (
									<S.MDrawerHeader>
										<GS.DrawerContentHeader>{'Asks'}</GS.DrawerContentHeader>
									</S.MDrawerHeader>
								)}
								<S.DrawerContentFlex>
									<OwnerLine
										owner={{
											address: listing.creator,
											profile: listing.profile,
										}}
										callback={() => setShowCurrentOwnersModal(false)}
									/>
									{getOwnerOrder(listing) && (
										<S.OrderCancel>
											<OrderCancel listing={listing} toggleUpdate={props.toggleUpdate} />
										</S.OrderCancel>
									)}
								</S.DrawerContentFlex>
								{mobile && (
									<S.MDrawerHeader>
										<GS.DrawerContentHeader>{language.quantity}</GS.DrawerContentHeader>
									</S.MDrawerHeader>
								)}
								<S.DrawerContentDetailAlt>
									{getDenominatedTokenValue(Number(listing.quantity), props.asset.data.id)}
								</S.DrawerContentDetailAlt>
								{/* {mobile && (
									<S.MDrawerHeader>
										<GS.DrawerContentHeader>{language.percentage}</GS.DrawerContentHeader>
									</S.MDrawerHeader>
								)}
								<S.DrawerContentDetailAlt>
									{formatPercentage(Number(listing.quantity) / totalAssetBalance)}
								</S.DrawerContentDetailAlt> */}
								{mobile && (
									<S.MDrawerHeader>
										<GS.DrawerContentHeader>{language.unitPrice}</GS.DrawerContentHeader>
									</S.MDrawerHeader>
								)}
								<GS.DrawerContentFlexEnd>
									<CurrencyLine
										amount={listing.price}
										currency={listing.currency}
										callback={() => setShowCurrentListingsModal(false)}
									/>
								</GS.DrawerContentFlexEnd>
							</S.DrawerContentLine>
						);
					})}
				</>
			);
		} else return <p>{props.updating ? `${language.updating}...` : 'No Active Asks'}</p>;
	}, [
		currentListings,
		showCurrentListingsModal,
		mobile,
		permawebProvider.profile,
		props.updating,
		tokenProvider.selectedToken.id,
	]);

	const getCurrentBids = React.useMemo(() => {
		const filteredBids = currentBids?.filter((bid: ListingType) => bid.token === tokenProvider.selectedToken.id);
		if (filteredBids?.length > 0) {
			return (
				<>
					{!mobile && (
						<GS.DrawerHeaderWrapper>
							<GS.DrawerContentFlex>{'Bids'}</GS.DrawerContentFlex>
							<GS.DrawerContentDetail>{language.quantity}</GS.DrawerContentDetail>
							<GS.DrawerContentDetail>{language.unitPrice}</GS.DrawerContentDetail>
						</GS.DrawerHeaderWrapper>
					)}
					{filteredBids.map((bid: ListingType, index: number) => {
						return (
							<S.DrawerContentLine key={index}>
								{mobile && (
									<S.MDrawerHeader>
										<GS.DrawerContentHeader>{'Bids'}</GS.DrawerContentHeader>
									</S.MDrawerHeader>
								)}
								<S.DrawerContentFlex>
									<OwnerLine
										owner={{
											address: bid.creator,
											profile: bid.profile,
										}}
										callback={() => setShowCurrentBidsModal(false)}
									/>
									{getOwnerOrder(bid) && (
										<S.OrderCancel>
											<OrderCancel listing={bid} toggleUpdate={props.toggleUpdate} />
										</S.OrderCancel>
									)}
								</S.DrawerContentFlex>
								{mobile && (
									<S.MDrawerHeader>
										<GS.DrawerContentHeader>{language.quantity}</GS.DrawerContentHeader>
									</S.MDrawerHeader>
								)}
								<S.DrawerContentDetailAlt>
									{getDenominatedTokenValue(
										(Number(bid.quantity) / Number(bid.price)) * Math.pow(10, props.asset?.state?.denomination ?? 0),
										props.asset.data.id
									)}
								</S.DrawerContentDetailAlt>
								{mobile && (
									<S.MDrawerHeader>
										<GS.DrawerContentHeader>{language.unitPrice}</GS.DrawerContentHeader>
									</S.MDrawerHeader>
								)}
								<GS.DrawerContentFlexEnd>
									<CurrencyLine
										amount={bid.price}
										currency={bid.token}
										callback={() => setShowCurrentBidsModal(false)}
									/>
								</GS.DrawerContentFlexEnd>
							</S.DrawerContentLine>
						);
					})}
				</>
			);
		} else return <p>{props.updating ? `${language.updating}...` : 'No Active Bids'}</p>;
	}, [
		currentBids,
		showCurrentBidsModal,
		mobile,
		permawebProvider.profile,
		props.updating,
		tokenProvider.selectedToken.id,
	]);

	function getCurrentTab() {
		switch (currentTab) {
			case ACTION_TAB_OPTIONS.market:
				return (
					<AssetActionMarket
						asset={props.asset}
						getCurrentListings={getCurrentListings}
						getCurrentBids={getCurrentBids}
						toggleUpdate={props.toggleUpdate}
						updating={props.updating}
						hasLegacyOrderbook={props.hasLegacyOrderbook}
					/>
				);
			case ACTION_TAB_OPTIONS.owners:
				return <AssetActionsOwners asset={props.asset} />;
			case ACTION_TAB_OPTIONS.comments:
				return <AssetActionComments asset={props.asset} />;
			case ACTION_TAB_OPTIONS.activity:
				return <AssetActionActivity asset={props.asset} />;
			default:
				return null;
		}
	}

	const ownerCountDisplay = ownerCount
		? `${formatCount(ownerCount.toString())} ${
				ownerCount > 1 ? `${language.owner.toLowerCase()}s` : language.owner.toLowerCase()
		  }`
		: null;

	return props.asset ? (
		<>
			<S.Wrapper>
				<S.DataWrapper>
					<AssetData asset={props.asset} frameMinHeight={550} autoLoad />
				</S.DataWrapper>
				<S.Header>
					<S.HeaderTitle>
						<h4>{props.asset.data.title}</h4>
						<S.HeaderTitleActions>
							{/* <Stamps txId={props.asset.data.id} title={props.asset.data.description || props.asset.data.title} /> */}
							<IconButton
								type={'alt1'}
								src={urlCopied ? ASSETS.link : ASSETS.link}
								handlePress={copyPageUrl}
								dimensions={{
									wrapper: 33.5,
									icon: 17.5,
								}}
								disabled={urlCopied}
								tooltip={urlCopied ? `${language.copied}!` : language.copyPageUrl}
								useBottomToolTip
							/>
						</S.HeaderTitleActions>
					</S.HeaderTitle>
					<S.OrdersWrapper>
						{!props.updating && (
							<S.OwnerLinesWrapper>
								{/* {showCurrentlyOwnedBy() && (
									<S.OwnerLine>
										<span>{language.currentlyOwnedBy}</span>
										<button
											onClick={() => {
												setShowCurrentOwnersModal(true);
											}}
										>
											{ownerCountDisplay}
										</button>
									</S.OwnerLine>
								)} */}
								{currentListings && (
									<S.OwnerLine>
										{(() => {
											const filteredCount = currentListings.filter(
												(listing: ListingType) => listing.currency === tokenProvider.selectedToken.id
											).length;
											return filteredCount > 0 ? (
												<>
													<button
														onClick={() => {
															setShowCurrentListingsModal(true);
														}}
													>
														{filteredCount}{' '}
														{`Active ${tokenProvider.selectedToken.symbol} Listing${filteredCount > 1 ? 's' : ''}`}
													</button>
												</>
											) : (
												<span>{'No Asks Available'}</span>
											);
										})()}
									</S.OwnerLine>
								)}
								{currentListings && currentBids && <span>|</span>}
								{currentBids && (
									<S.OwnerLine>
										{(() => {
											const filteredCount = currentBids.filter(
												(bid: ListingType) => bid.token === tokenProvider.selectedToken.id
											).length;
											return filteredCount > 0 ? (
												<>
													<button
														onClick={() => {
															setShowCurrentBidsModal(true);
														}}
													>
														{filteredCount}{' '}
														{`Active ${tokenProvider.selectedToken.symbol} Bid${filteredCount > 1 ? 's' : ''}`}
													</button>
												</>
											) : (
												<span>{'No Bids Available'}</span>
											);
										})()}
									</S.OwnerLine>
								)}
							</S.OwnerLinesWrapper>
						)}
						{props.updating && (
							<S.OwnerLine>
								<span>{`${language.updatingAsset}...`}</span>
							</S.OwnerLine>
						)}
					</S.OrdersWrapper>
					<S.ACActionWrapper>
						<S.ACAction>
							<button onClick={() => props.toggleViewType()}>
								<ReactSVG src={ASSETS.zen} />
								{language.viewInZenMode}
							</button>
						</S.ACAction>
						<S.ACAction>
							<Link target={'_blank'} to={getTxEndpoint(props.asset.data.id)}>
								<ReactSVG src={ASSETS.view} />
								{language.viewOnArweave}
							</Link>
						</S.ACAction>
					</S.ACActionWrapper>
				</S.Header>
				<S.TabsWrapper>
					<Tabs onTabPropClick={(label: string) => setCurrentTab(label)} type={'alt1'}>
						{ACTION_TABS.map((tab: { label: string; icon?: string }, index: number) => {
							return <S.TabWrapper key={index} label={tab.label} icon={tab.icon ? tab.icon : null} />;
						})}
					</Tabs>
					<S.TabContent>{getCurrentTab()}</S.TabContent>
				</S.TabsWrapper>
			</S.Wrapper>
			{showCurrentOwnersModal && (
				<Modal
					header={`${language.currentlyOwnedBy} ${ownerCountDisplay}`}
					handleClose={() => setShowCurrentOwnersModal(false)}
				>
					<S.DrawerContent transparent className={'modal-wrapper'}>
						{getCurrentOwners}
					</S.DrawerContent>
				</Modal>
			)}
			{showCurrentListingsModal && currentListings && currentListings.length > 0 && (
				<Modal
					header={`${
						currentListings.filter((listing: ListingType) => listing.currency === tokenProvider.selectedToken.id).length
					} Active ${tokenProvider.selectedToken.symbol} Listings`}
					handleClose={() => setShowCurrentListingsModal(false)}
				>
					<S.DrawerContent className={'modal-wrapper'}>{getCurrentListings}</S.DrawerContent>
				</Modal>
			)}
			{showCurrentBidsModal && currentBids && currentBids.length > 0 && (
				<Modal
					header={`${
						currentBids.filter((bid: ListingType) => bid.token === tokenProvider.selectedToken.id).length
					} Active ${tokenProvider.selectedToken.symbol} Bids`}
					handleClose={() => setShowCurrentBidsModal(false)}
				>
					<S.DrawerContent className={'modal-wrapper'}>{getCurrentBids}</S.DrawerContent>
				</Modal>
			)}
		</>
	) : null;
}
