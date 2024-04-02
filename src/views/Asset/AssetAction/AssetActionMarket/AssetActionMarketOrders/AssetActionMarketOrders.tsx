import React from 'react';

import { formatCount, formatPercentage } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

export default function AssetActionMarketOrders(props: IProps) {
	const arProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	// Total quantity of asset
	const [totalAssetBalance, setTotalAssetBalance] = React.useState<number>(0);

	// Total quantity of asset for sale
	const [totalSalesBalance, setTotalSalesBalance] = React.useState<number>(0);

	// Total quantity of asset available to sell or transfer
	const [connectedBalance, setConnectedBalance] = React.useState<number>(0);

	React.useEffect(() => {
		if (props.asset && props.asset.state) {
			const balances: any = Object.keys(props.asset.state.balances).map((address: string) => {
				return Number(props.asset.state.balances[address]);
			});
			const totalBalance = balances.reduce((a: number, b: number) => a + b, 0);
			setTotalAssetBalance(totalBalance);

			if (arProvider.walletAddress) {
				const ownerBalance = Number(props.asset.state.balances[arProvider.walletAddress]);
				if (ownerBalance) {
					setConnectedBalance(ownerBalance);
				}
			}
		}
	}, [props.asset, arProvider.walletAddress]);

	function getTotals() {
		let balanceHeader: string | null = null;
		let percentageHeader: string | null = null;
		let quantity: number | null = null;

		switch (props.type) {
			case 'buy':
				balanceHeader = language.totalSalesBalance;
				percentageHeader = language.totalSalesPercentage;
				quantity = 0;
				break;
			case 'sell':
				balanceHeader = language.connectedBalance;
				percentageHeader = language.totalSalesPercentageAvailable;
				quantity = connectedBalance;
				break;
			case 'transfer':
				balanceHeader = language.totalTransferBalanceAvailable;
				percentageHeader = language.totalTransferPercentageAvailable;
				quantity = connectedBalance;
				break;
		}

		return (
			<>
				<S.TotalQuantityLine>
					<p>
						{`${balanceHeader}: `}
						<span>{formatCount(quantity.toString())}</span>
					</p>
				</S.TotalQuantityLine>
				<S.TotalQuantityLine>
					<p>
						{`${percentageHeader}: `}
						<span>{formatPercentage(quantity / totalAssetBalance)}</span>
					</p>
				</S.TotalQuantityLine>
			</>
		);
	}

	return props.asset ? (
		<S.Wrapper>
			<S.TotalsWrapper>
				<S.TotalQuantityLine>
					<p>
						{`${language.totalAssetBalance}: `}
						<span>{formatCount(totalAssetBalance.toString())}</span>
					</p>
				</S.TotalQuantityLine>
				{getTotals()}
			</S.TotalsWrapper>
		</S.Wrapper>
	) : null;
}
