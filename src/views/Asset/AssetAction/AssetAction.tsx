import React from 'react';
import { Link } from 'react-router-dom';

import { getProfiles } from 'api';

import * as GS from 'app/styles';
import { Modal } from 'components/molecules/Modal';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { Tabs } from 'components/molecules/Tabs';
import { ASSETS, REDIRECTS } from 'helpers/config';
import { OwnerType, ProfileType } from 'helpers/types';
import { getOwners } from 'helpers/utils';
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

	const [associatedProfiles, setAssociatedProfiles] = React.useState<ProfileType[] | null>(null);
	const [currentOwners, setCurrentOwners] = React.useState<OwnerType[] | null>(null);

	const [showCurrentOwnersModal, setShowCurrentOwnersModal] = React.useState<boolean>(false);
	const [currentTab, setCurrentTab] = React.useState<string>(ACTION_TABS[0]!.label);

	// TODO: merge sale order profiles and current owners to perform only one profile query
	React.useEffect(() => {
		(async function () {
			const associatedAddresses = [];
			if (props.asset && props.asset.state) {
				associatedAddresses.push(...Object.keys(props.asset.state.balances).map((address: string) => address));
			}
			if (associatedAddresses.length) {
				try {
					setAssociatedProfiles(await getProfiles({ addresses: associatedAddresses }));
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [props.asset]);

	React.useEffect(() => {
		(async function () {
			if (props.asset && props.asset.state) {
				setCurrentOwners(await getOwners(props.asset, associatedProfiles));
			}
		})();
	}, [props.asset, associatedProfiles]);

	function getTab() {
		switch (currentTab) {
			case ACTION_TAB_OPTIONS.market:
				return <AssetActionMarket asset={props.asset} />;
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
				</S.Header>
				<S.TabsWrapper>
					<Tabs onTabPropClick={(label: string) => setCurrentTab(label)} type={'alt1'}>
						{ACTION_TABS.map((tab: { label: string; icon?: string }, index: number) => {
							return <S.TabWrapper key={index} label={tab.label} icon={tab.icon ? tab.icon : null} />;
						})}
					</Tabs>
					<S.TabContent>{getTab()}</S.TabContent>
				</S.TabsWrapper>
			</S.Wrapper>
			{showCurrentOwnersModal && currentOwners && (
				<Modal header={language.currentlyOwnedBy} handleClose={() => setShowCurrentOwnersModal(false)}>
					<GS.DrawerContent transparent className={'modal-wrapper'}>
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
									<GS.DrawerContentDetailAlt>{`${(owner.ownerPercentage * 100).toFixed(
										2
									)}%`}</GS.DrawerContentDetailAlt>
								</GS.DrawerContentLine>
							);
						})}
					</GS.DrawerContent>
				</Modal>
			)}
		</>
	) : null;
}
