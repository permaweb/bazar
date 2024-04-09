import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { getProfiles } from 'api';

import * as GS from 'app/styles';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { Modal } from 'components/molecules/Modal';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { Tabs } from 'components/molecules/Tabs';
import { OrderCancel } from 'components/organisms/OrderCancel';
import { ASSETS, REDIRECTS } from 'helpers/config';
import { ListingType, OwnerType, ProfileType } from 'helpers/types';
import { formatCount, formatPercentage, getOwners, sortOrders } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import { AssetActionActivity } from './AssetActionActivity';
import { AssetActionComments } from './AssetActionComments';
import { AssetActionMarket } from './AssetActionMarket';
import * as S from './styles';
import { IProps } from './types';

export default function AssetAction(props: IProps) {
	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);

	const arProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const ACTION_TAB_OPTIONS = {
		market: language.market,
		comments: language.comments,
		activity: language.activity,
	};

	const ACTION_TABS = [
		{
			label: ACTION_TAB_OPTIONS.market,
			icon: ASSETS.market,
		},
		{
			label: ACTION_TAB_OPTIONS.comments,
			icon: ASSETS.comments,
		},
		{
			label: ACTION_TAB_OPTIONS.activity,
			icon: ASSETS.activity,
		},
	];

	const [totalAssetBalance, setTotalAssetBalance] = React.useState<number>(0);
	const [associatedProfiles, setAssociatedProfiles] = React.useState<ProfileType[] | null>(null);

	const [currentOwners, setCurrentOwners] = React.useState<OwnerType[] | null>(null);
	const [currentListings, setCurrentListings] = React.useState<ListingType[] | null>(null);

	const [showCurrentOwnersModal, setShowCurrentOwnersModal] = React.useState<boolean>(false);
	const [showCurrentListingsModal, setShowCurrentListingsModal] = React.useState<boolean>(false);

	const [currentTab, setCurrentTab] = React.useState<string>(ACTION_TABS[0]!.label);

	React.useEffect(() => {
		if (props.asset && props.asset.state) {
			const balances: any = Object.keys(props.asset.state.balances).map((address: string) => {
				return Number(props.asset.state.balances[address]);
			});
			const totalBalance = balances.reduce((a: number, b: number) => a + b, 0);
			setTotalAssetBalance(totalBalance);
		}
	}, [props.asset]);

	React.useEffect(() => {
		(async function () {
			const associatedAddresses = [];
			if (props.asset && props.asset.state) {
				associatedAddresses.push(...Object.keys(props.asset.state.balances).map((address: string) => address));
			}
			if (props.asset && props.asset.orders) {
				associatedAddresses.push(...props.asset.orders.map((order: any) => order.creator));
			}
			if (associatedAddresses.length) {
				const uniqueAddresses = [...new Set(associatedAddresses)];
				try {
					setAssociatedProfiles(await getProfiles({ addresses: uniqueAddresses }));
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [props.asset]);

	React.useEffect(() => {
		(async function () {
			if (props.asset && props.asset.state) {
				setCurrentOwners(getOwners(props.asset, associatedProfiles));
			}
			if (props.asset && props.asset.orders) {
				const sortedOrders = sortOrders(props.asset.orders, 'low-to-high');

				const mappedListings = sortedOrders.map((order: any) => {
					let currentProfile = null;
					if (associatedProfiles) {
						currentProfile = associatedProfiles.find((profile: ProfileType) => profile.walletAddress === order.creator);
					}

					const currentListing = {
						profile: currentProfile || null,
						...order,
					};

					return currentListing;
				});

				setCurrentListings(mappedListings);
			}
		})();
	}, [props.asset, associatedProfiles]);

	function getDenominatedTokenValue(amount: number, currency: string) {
		if (
			currenciesReducer &&
			currenciesReducer[currency] &&
			currenciesReducer[currency].Denomination &&
			currenciesReducer[currency].Denomination > 1
		) {
			const denomination = currenciesReducer[currency].Denomination;
			return `${formatCount((amount / Math.pow(10, denomination)).toString())}`;
		}
		return formatCount(amount.toString());
	}

	function getOwnerOrder(listing: ListingType) {
		if (!arProvider.walletAddress) return false;
		return listing.creator === arProvider.walletAddress;
	}

	function getCurrentOwners() {
		return (
			<>
				<GS.DrawerHeaderWrapper>
					<GS.DrawerContentFlex>
						{language.owner.charAt(0).toUpperCase() + language.owner.slice(1)}
					</GS.DrawerContentFlex>
					<GS.DrawerContentDetail>{language.quantity}</GS.DrawerContentDetail>
					<GS.DrawerContentDetail>{language.percentage}</GS.DrawerContentDetail>
				</GS.DrawerHeaderWrapper>
				{currentOwners.map((owner: OwnerType, index: number) => {
					return (
						<GS.DrawerContentLine key={index}>
							<GS.DrawerContentFlex>
								<OwnerLine owner={owner} callback={() => setShowCurrentOwnersModal(false)} />
							</GS.DrawerContentFlex>
							<GS.DrawerContentDetailAlt>
								{getDenominatedTokenValue(owner.ownerQuantity, props.asset.data.id)}
							</GS.DrawerContentDetailAlt>
							<GS.DrawerContentDetailAlt>{formatPercentage(owner.ownerPercentage)}</GS.DrawerContentDetailAlt>
						</GS.DrawerContentLine>
					);
				})}
			</>
		);
	}

	function getCurrentListings() {
		if (currentListings) {
			return (
				<>
					<GS.DrawerHeaderWrapper>
						<GS.DrawerContentFlex>{language.seller}</GS.DrawerContentFlex>
						<GS.DrawerContentDetail>{language.quantity}</GS.DrawerContentDetail>
						<GS.DrawerContentDetail>{language.percentage}</GS.DrawerContentDetail>
						<GS.DrawerContentDetail>{language.price}</GS.DrawerContentDetail>
					</GS.DrawerHeaderWrapper>
					{currentListings.map((listing: ListingType, index: number) => {
						return (
							<GS.DrawerContentLine key={index}>
								<GS.DrawerContentFlex>
									<OwnerLine
										owner={{
											address: listing.creator,
											profile: listing.profile,
										}}
										callback={() => setShowCurrentOwnersModal(false)}
									/>
									{getOwnerOrder(listing) && (
										<S.OrderCancel>
											<OrderCancel listing={listing} />
										</S.OrderCancel>
									)}
								</GS.DrawerContentFlex>
								<GS.DrawerContentDetailAlt>
									{getDenominatedTokenValue(Number(listing.quantity), props.asset.data.id)}
								</GS.DrawerContentDetailAlt>
								<GS.DrawerContentDetailAlt>
									{formatPercentage(Number(listing.quantity) / totalAssetBalance)}
								</GS.DrawerContentDetailAlt>
								<GS.DrawerContentFlexEnd>
									<CurrencyLine
										amount={listing.price}
										currency={listing.currency}
										callback={() => setShowCurrentListingsModal(false)}
									/>
								</GS.DrawerContentFlexEnd>
							</GS.DrawerContentLine>
						);
					})}
				</>
			);
		} else return null;
	}

	function getCurrentTab() {
		switch (currentTab) {
			case ACTION_TAB_OPTIONS.market:
				return <AssetActionMarket asset={props.asset} getCurrentListings={getCurrentListings} />;
			case ACTION_TAB_OPTIONS.comments:
				return <AssetActionComments asset={props.asset} />;
			case ACTION_TAB_OPTIONS.activity:
				return <AssetActionActivity asset={props.asset} />;
			default:
				return null;
		}
	}

	return props.asset ? (
		<>
			<S.Wrapper>
				<S.Header className={'border-wrapper-alt2'}>
					<h4>{props.asset.data.title}</h4>
					<S.ACLink>
						<Link target={'_blank'} to={REDIRECTS.viewblock(props.asset.data.id)}>
							{language.viewblock}
						</Link>
					</S.ACLink>
					{currentOwners && currentOwners.length > 0 && (
						<S.OwnerLine>
							<span>{language.currentlyOwnedBy}</span>
							<button
								onClick={() => {
									setShowCurrentOwnersModal(true);
								}}
							>{`${currentOwners.length} ${
								currentOwners.length > 1 ? `${language.owner.toLowerCase()}s` : language.owner.toLowerCase()
							}`}</button>
						</S.OwnerLine>
					)}
					{currentListings && currentListings.length > 0 && (
						<S.OwnerLine>
							<span>{language.currentlyBeingSoldBy}</span>
							<button
								onClick={() => {
									setShowCurrentListingsModal(true);
								}}
							>{`${currentListings.length} ${
								currentListings.length > 1 ? `${language.owner.toLowerCase()}s` : language.owner.toLowerCase()
							}`}</button>
						</S.OwnerLine>
					)}
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
			{showCurrentOwnersModal && currentOwners && currentOwners.length > 0 && (
				<Modal header={language.currentlyOwnedBy} handleClose={() => setShowCurrentOwnersModal(false)}>
					<GS.DrawerContent transparent className={'modal-wrapper'}>
						{getCurrentOwners()}
					</GS.DrawerContent>
				</Modal>
			)}
			{showCurrentListingsModal && currentListings && currentListings.length > 0 && (
				<Modal header={language.currentlyBeingSoldBy} handleClose={() => setShowCurrentListingsModal(false)}>
					<GS.DrawerContent transparent className={'modal-wrapper'}>
						{getCurrentListings()}
					</GS.DrawerContent>
				</Modal>
			)}
		</>
	) : null;
}
