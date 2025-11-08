import React from 'react';

import * as GS from 'app/styles';
import { Drawer } from 'components/atoms/Drawer';
import { Tabs } from 'components/molecules/Tabs';
import { AO, ASSETS } from 'helpers/config';
import { useLanguageProvider } from 'providers/LanguageProvider';

import { AssetActionMarketOrders } from './AssetActionMarketOrders';
import * as S from './styles';
import { IProps } from './types';

export default function AssetActionMarket(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const MARKET_ACTION_TAB_OPTIONS = {
		buy: language.buy,
		sell: language.sell,
		list: 'List',
		bid: 'Bid',
		transfer: language.transfer,
	};

	const [tabs, setTabs] = React.useState<any>(null);
	const [currentTab, setCurrentTab] = React.useState<string | null>(null);

	React.useEffect(() => {
		const TRANSFER_ONLY_ASSETS = [AO.defaultToken];

		if (props.asset && TRANSFER_ONLY_ASSETS.includes(props.asset.data.id)) {
			const MARKET_ACTION_TABS = [
				{
					label: MARKET_ACTION_TAB_OPTIONS.transfer,
					icon: ASSETS.transfer,
				},
			];
			setTabs(MARKET_ACTION_TABS);
		} else if (props.hasLegacyOrderbook) {
			// Legacy orderbook: show buy, list, transfer tabs
			const MARKET_ACTION_TABS = [
				{
					label: MARKET_ACTION_TAB_OPTIONS.buy,
					icon: ASSETS.buy,
				},
				{
					label: MARKET_ACTION_TAB_OPTIONS.list,
					icon: ASSETS.listing,
				},
				{
					label: MARKET_ACTION_TAB_OPTIONS.transfer,
					icon: ASSETS.transfer,
				},
			];
			setTabs(MARKET_ACTION_TABS);
		} else {
			// New orderbook: show all 5 tabs
			const MARKET_ACTION_TABS = [
				{
					label: MARKET_ACTION_TAB_OPTIONS.buy,
					icon: ASSETS.buy,
				},
				{
					label: MARKET_ACTION_TAB_OPTIONS.sell,
					icon: ASSETS.sell,
				},
				{
					label: MARKET_ACTION_TAB_OPTIONS.bid,
					icon: ASSETS.bid,
				},
				{
					label: MARKET_ACTION_TAB_OPTIONS.list,
					icon: ASSETS.listing,
				},
				{
					label: MARKET_ACTION_TAB_OPTIONS.transfer,
					icon: ASSETS.transfer,
				},
			];
			setTabs(MARKET_ACTION_TABS);
		}
	}, [props.asset, props.hasLegacyOrderbook]);

	React.useEffect(() => {
		if (tabs && tabs.length > 0 && !currentTab) setCurrentTab(tabs[0].label);
	}, [tabs]);

	function getCurrentTab() {
		let type = null;
		switch (currentTab) {
			case MARKET_ACTION_TAB_OPTIONS.buy:
				type = 'buy';
				break;
			case MARKET_ACTION_TAB_OPTIONS.sell:
				type = 'sell';
				break;
			case MARKET_ACTION_TAB_OPTIONS.list:
				type = 'list';
				break;
			case MARKET_ACTION_TAB_OPTIONS.bid:
				type = 'bid';
				break;
			case MARKET_ACTION_TAB_OPTIONS.transfer:
				type = 'transfer';
				break;

			default:
				break;
		}
		return (
			<AssetActionMarketOrders
				asset={props.asset}
				type={type}
				toggleUpdate={props.toggleUpdate}
				updating={props.updating}
			/>
		);
	}

	return tabs && currentTab ? (
		<S.Wrapper>
			<S.TabsWrapper className={'border-wrapper-alt2'}>
				<Tabs onTabPropClick={(label: string) => setCurrentTab(label)} type={'alt1'}>
					{tabs.map((tab: { label: string; icon?: string }, index: number) => {
						return <S.TabWrapper key={index} label={tab.label} icon={tab.icon ? tab.icon : null} />;
					})}
				</Tabs>
				<S.TabContent>{getCurrentTab()}</S.TabContent>
			</S.TabsWrapper>
			{(currentTab === MARKET_ACTION_TAB_OPTIONS.buy || currentTab === MARKET_ACTION_TAB_OPTIONS.list) && (
				<GS.DrawerWrapper>
					<Drawer
						title={language.activeSaleOrders}
						icon={ASSETS.orders}
						content={<S.DrawerContent>{props.getCurrentListings}</S.DrawerContent>}
					/>
				</GS.DrawerWrapper>
			)}
			{(currentTab === MARKET_ACTION_TAB_OPTIONS.sell || currentTab === MARKET_ACTION_TAB_OPTIONS.bid) && (
				<GS.DrawerWrapper>
					<Drawer
						title={'Active Bids'}
						icon={ASSETS.orders}
						content={<S.DrawerContent>{props.getCurrentBids}</S.DrawerContent>}
					/>
				</GS.DrawerWrapper>
			)}
		</S.Wrapper>
	) : null;
}
