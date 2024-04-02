import * as GS from 'app/styles';
import { Drawer } from 'components/atoms/Drawer';
import { TxAddress } from 'components/atoms/TxAddress';
import { AssetData } from 'components/organisms/AssetData';
import { ASSETS } from 'helpers/config';
import { formatCount, formatDate } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

// TODO creator
// TODO license
export default function AssetInfo(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	function getAssetLicense() {
		if (props.asset && props.asset.data.license) {
			return (
				<>
					<GS.DrawerContentLine>
						<GS.DrawerContentHeader>{language.license}</GS.DrawerContentHeader>
						<TxAddress address={props.asset.data.license} wrap={false} />
					</GS.DrawerContentLine>
				</>
			);
		} else return null;
	}

	return props.asset ? (
		<S.Wrapper>
			<S.DataWrapper>
				<AssetData asset={props.asset} frameMinHeight={550} autoLoad />
			</S.DataWrapper>
			<GS.DrawerWrapper>
				<Drawer
					title={language.overview}
					icon={ASSETS.overview}
					content={
						<GS.DrawerContent>
							<GS.DrawerHeader>{props.asset.data.title}</GS.DrawerHeader>
							{props.asset.data.description && (
								<GS.DrawerContentDetail>{props.asset.data.description}</GS.DrawerContentDetail>
							)}
							{/* {creator && !sponsored && (
								<S.DCOwnerFlex>
									<p>{language.createdBy}</p>
									<OwnerInfo
										owner={creator}
										asset={props.asset}
										isSaleOrder={false}
										handleUpdate={() => {}}
										loading={false}
										hideOrderCancel={false}
									/>
								</S.DCOwnerFlex>
							)}
							{sponsored && (
								<S.DCOwnerFlex>
									<p>{language.sponsoredAsset}</p>
								</S.DCOwnerFlex>
							)}
							{collection && (
								<S.DCCollectionFlex>
									<Link to={`${urls.collection}${collection.id}`}>{collection.title}</Link>
								</S.DCCollectionFlex>
							)}
							<S.DCLineNoMax>{props.asset.data.description}</S.DCLineNoMax> */}
						</GS.DrawerContent>
					}
				/>
			</GS.DrawerWrapper>
			<GS.DrawerWrapper>
				<Drawer
					title={language.provenanceDetails}
					icon={ASSETS.provenance}
					content={
						<GS.DrawerContent>
							{props.asset.data.dateCreated !== 0 && (
								<GS.DrawerContentLine>
									<GS.DrawerContentHeader>{language.dateCreated}</GS.DrawerContentHeader>
									<GS.DrawerContentDetail>{formatDate(props.asset.data.dateCreated, 'iso')}</GS.DrawerContentDetail>
								</GS.DrawerContentLine>
							)}
							{props.asset.data.blockHeight !== 0 && (
								<GS.DrawerContentLine>
									<GS.DrawerContentHeader>{language.blockHeight}</GS.DrawerContentHeader>
									<GS.DrawerContentDetail>
										{formatCount(props.asset.data.blockHeight.toString())}
									</GS.DrawerContentDetail>
								</GS.DrawerContentLine>
							)}
							<GS.DrawerContentLine>
								<GS.DrawerContentHeader>{language.transaction}</GS.DrawerContentHeader>
								<TxAddress address={props.asset.data.id} wrap={false} />
							</GS.DrawerContentLine>
							{props.asset.data.implementation && (
								<GS.DrawerContentLine>
									<GS.DrawerContentHeader>{language.implements}</GS.DrawerContentHeader>
									<GS.DrawerContentDetail>{props.asset.data.implementation}</GS.DrawerContentDetail>
								</GS.DrawerContentLine>
							)}
						</GS.DrawerContent>
					}
				/>
			</GS.DrawerWrapper>
			{props.asset.data.license && (
				<GS.DrawerWrapper>
					<Drawer
						title={language.assetRights}
						icon={ASSETS.license}
						content={<GS.DrawerContent>{getAssetLicense()}</GS.DrawerContent>}
					/>
				</GS.DrawerWrapper>
			)}
		</S.Wrapper>
	) : null;
}
