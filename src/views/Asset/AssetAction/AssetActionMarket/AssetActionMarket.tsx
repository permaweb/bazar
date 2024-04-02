import React from 'react';

import { Tabs } from 'components/molecules/Tabs';
import { ASSETS } from 'helpers/config';
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

	const [currentTab, setCurrentTab] = React.useState<string>(MARKET_ACTION_TABS[0]!.label);

	function getTab() {
		switch (currentTab) {
			case MARKET_ACTION_TAB_OPTIONS.buy:
				return <AssetActionMarketOrders asset={props.asset} type={'buy'} />;
			case MARKET_ACTION_TAB_OPTIONS.sell:
				return <AssetActionMarketOrders asset={props.asset} type={'sell'} />;
			case MARKET_ACTION_TAB_OPTIONS.transfer:
				return <AssetActionMarketOrders asset={props.asset} type={'transfer'} />;
			default:
				return null;
		}
	}

	return (
		<S.Wrapper>
			<S.TabsWrapper className={'border-wrapper-alt2'}>
				<Tabs onTabPropClick={(label: string) => setCurrentTab(label)} type={'alt1'}>
					{MARKET_ACTION_TABS.map((tab: { label: string; icon?: string }, index: number) => {
						return <S.TabWrapper key={index} label={tab.label} icon={tab.icon ? tab.icon : null} />;
					})}
				</Tabs>
				<S.TabContent>{getTab()}</S.TabContent>
			</S.TabsWrapper>
		</S.Wrapper>
	);
}