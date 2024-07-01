import React from 'react';

import * as GS from 'app/styles';
import { Drawer } from 'components/atoms/Drawer';
import { Tabs } from 'components/molecules/Tabs';
import { AOS, ASSETS } from 'helpers/config';
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
		transfer: language.transfer,
	};

	const [tabs, setTabs] = React.useState<any>(null);
	const [currentTab, setCurrentTab] = React.useState<string | null>(null);

	React.useEffect(() => {
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
				label: MARKET_ACTION_TAB_OPTIONS.transfer,
				icon: ASSETS.transfer,
			},
		];

		const TRANSFER_ONLY_ASSETS = [AOS.defaultToken];

		// console.log(props.asset)
		// if (props.asset && !props.asset.state.transferable) {
		// 	setTabs([])
		// }
		// else {
		if (props.asset && TRANSFER_ONLY_ASSETS.includes(props.asset.data.id)) {
			setTabs(MARKET_ACTION_TABS.filter((tab: any) => tab.label === MARKET_ACTION_TAB_OPTIONS.transfer));
		} else {
			setTabs(MARKET_ACTION_TABS);
		}
		// }
	}, [props.asset]);

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
			case MARKET_ACTION_TAB_OPTIONS.transfer:
				type = 'transfer';
				break;

			default:
				break;
		}
		return <AssetActionMarketOrders asset={props.asset} type={type} toggleUpdate={props.toggleUpdate} />;
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
			{props.asset.orders && props.asset.orders.length > 0 && (
				<GS.DrawerWrapper>
					<Drawer
						title={language.activeSaleOrders}
						icon={ASSETS.orders}
						content={<S.DrawerContent>{props.getCurrentListings}</S.DrawerContent>}
					/>
				</GS.DrawerWrapper>
			)}
		</S.Wrapper>
	) : null;
}
