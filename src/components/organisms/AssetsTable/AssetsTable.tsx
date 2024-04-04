import { Link } from 'react-router-dom';

import { URLS } from 'helpers/config';
import { AssetDetailType } from 'helpers/types';

import { AssetData } from '../AssetData';

import * as S from './styles';
import { IProps } from './types';

export default function AssetsTable(props: IProps) {
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
							</S.AssetInfoWrapper>
						</S.AssetWrapper>
					);
				})}
			</S.AssetsWrapper>
		</S.Wrapper>
	) : null;
}
