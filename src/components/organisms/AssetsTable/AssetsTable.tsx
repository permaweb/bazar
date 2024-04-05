import { Link } from 'react-router-dom';

import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { URLS } from 'helpers/config';
import { AssetDetailType } from 'helpers/types';
import { sortOrders } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import { AssetData } from '../AssetData';

import * as S from './styles';
import { IProps } from './types';

export default function AssetsTable(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	function getListings(asset: AssetDetailType) {
		if (asset && asset.orders && asset.orders.length) {
			const sortedOrders = sortOrders(asset.orders);

			if (sortedOrders && sortedOrders.length) {
				return <CurrencyLine amount={sortedOrders[0].price || '0'} currency={sortedOrders[0].currency} />;
			}
		}
		return <span>{language.noListings}</span>;
	}

	return props.assets ? (
		<S.Wrapper className={'fade-in'}>
			<S.AssetsWrapper>
				{props.assets.map((asset: AssetDetailType, index: number) => {
					const redirect = `${URLS.asset}${asset.data.id}`;

					return (
						<S.AssetWrapper key={index} className={'fade-in'}>
							<Link to={redirect}>
								<S.AssetDataWrapper>
									<AssetData asset={asset} />
								</S.AssetDataWrapper>
							</Link>
							<S.AssetInfoWrapper>
								<Link to={redirect}>
									<S.Title>
										<p>{asset.data.title}</p>
									</S.Title>
								</Link>
								<S.Description>
									<p>{asset.data.description || asset.data.title}</p>
								</S.Description>
								<S.Listings>{getListings(asset)}</S.Listings>
							</S.AssetInfoWrapper>
						</S.AssetWrapper>
					);
				})}
			</S.AssetsWrapper>
		</S.Wrapper>
	) : null;
}
