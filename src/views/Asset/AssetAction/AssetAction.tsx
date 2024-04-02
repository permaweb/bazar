import React from 'react';
import { Link } from 'react-router-dom';

import { getProfiles } from 'api';

import * as GS from 'app/styles';
import { Modal } from 'components/molecules/Modal';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { Tabs } from 'components/molecules/Tabs';
import { ASSETS, REDIRECTS } from 'helpers/config';
import { OwnerType, ProfileType } from 'helpers/types';
import { formatCount, formatPercentage, getOwners } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import { AssetActionActivity } from './AssetActionActivity';
import { AssetActionComments } from './AssetActionComments';
import { AssetActionMarket } from './AssetActionMarket';
import * as S from './styles';
import { IProps } from './types';

// TODO: sale orders
export default function AssetAction(props: IProps) {
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
	const [currentListings, setCurrentListings] = React.useState<any[] | null>(null);

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

	// TODO: merge sale order profiles and current owners to perform only one profile query
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
				const mappedListings = props.asset.orders.map((order: any) => {
					let currentProfile = null;
					if (associatedProfiles)
						currentProfile = associatedProfiles.find((profile: ProfileType) => profile.walletAddress === order.creator);

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

	function getCurrentOwners() {
		return (
			<>
				<GS.DrawerHeaderWrapper>
					<GS.DrawerContentDetail>
						{language.owner.charAt(0).toUpperCase() + language.owner.slice(1)}
					</GS.DrawerContentDetail>
					<GS.DrawerContentDetail>{language.percentage}</GS.DrawerContentDetail>
				</GS.DrawerHeaderWrapper>
				{currentOwners.map((owner: OwnerType, index: number) => {
					return (
						<GS.DrawerContentLine key={index}>
							<OwnerLine owner={owner} callback={() => setShowCurrentOwnersModal(false)} />
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
						<GS.DrawerContentDetail>{language.seller}</GS.DrawerContentDetail>
						<GS.DrawerContentDetail>{language.quantity}</GS.DrawerContentDetail>
						<GS.DrawerContentDetail>{language.percentage}</GS.DrawerContentDetail>
						<GS.DrawerContentDetail>{language.price}</GS.DrawerContentDetail>
					</GS.DrawerHeaderWrapper>
					{currentListings.map((listing: any, index: number) => {
						return (
							<GS.DrawerContentLine key={index}>
								<OwnerLine
									owner={{
										address: listing.creator,
										profile: listing.profile,
									}}
									callback={() => setShowCurrentOwnersModal(false)}
								/>
								<GS.DrawerContentDetailAlt>{listing.quantity}</GS.DrawerContentDetailAlt>
								<GS.DrawerContentDetailAlt>
									{formatPercentage(listing.quantity / totalAssetBalance)}
								</GS.DrawerContentDetailAlt>
								<GS.DrawerContentDetailAlt>{formatCount(listing.price || '0')}</GS.DrawerContentDetailAlt>
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
			{showCurrentOwnersModal && currentOwners && (
				<Modal header={language.currentlyOwnedBy} handleClose={() => setShowCurrentOwnersModal(false)}>
					<GS.DrawerContent transparent className={'modal-wrapper'}>
						{getCurrentOwners()}
					</GS.DrawerContent>
				</Modal>
			)}
			{showCurrentListingsModal && currentListings && (
				<Modal header={language.currentlyBeingSoldBy} handleClose={() => setShowCurrentListingsModal(false)}>
					<GS.DrawerContent transparent className={'modal-wrapper'}>
						{getCurrentListings()}
					</GS.DrawerContent>
				</Modal>
			)}
		</>
	) : null;
}
