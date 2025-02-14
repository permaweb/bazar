import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { getProfileById } from 'api';

import * as GS from 'app/styles';
import { Drawer } from 'components/atoms/Drawer';
import { TxAddress } from 'components/atoms/TxAddress';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { AssetData } from 'components/organisms/AssetData';
import { ASSETS, LICENSES, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { ProfileType } from 'helpers/types';
import { checkValidAddress, cleanTagValue, formatCount, formatDate, getTagDisplay, splitTagValue } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import * as S from './styles';
import { IProps } from './types';

export default function AssetInfo(props: IProps) {
	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [creator, setCreator] = React.useState<ProfileType | null>(null);

	React.useEffect(() => {
		(async function () {
			if (props.asset && props.asset.creator && checkValidAddress(props.asset.creator)) {
				try {
					setCreator(await getProfileById({ profileId: props.asset.creator }));
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [props.asset]);

	function getLicenseValue(licenseKey: string) {
		if (!props.asset || !props.asset?.metadata?.udl?.[licenseKey]) return null;
		const licenseElement = props.asset.metadata.udl[licenseKey];

		if (typeof licenseElement === 'object') {
			return (
				<GS.DrawerContentDetail>
					{licenseElement.value ? splitTagValue(licenseElement.value) : '-'}{' '}
					{props.asset.metadata.udl.currency &&
						currenciesReducer &&
						currenciesReducer[props.asset.metadata.udl.currency] &&
						currenciesReducer[props.asset.metadata.udl.currency].Logo &&
						/\d/.test(licenseElement.value) && (
							<S.CurrencyIcon src={getTxEndpoint(currenciesReducer[props.asset.metadata.udl.currency].Logo)} />
						)}
				</GS.DrawerContentDetail>
			);
		} else if (checkValidAddress(licenseElement)) {
			return licenseElement ? <TxAddress address={licenseElement} wrap={false} /> : '-';
		} else {
			return <GS.DrawerContentDetail>{licenseElement}</GS.DrawerContentDetail>;
		}
	}

	function getLicense() {
		if (props.asset && props.asset.metadata.license) {
			let licenseDisplay: string | null = null;

			Object.keys(LICENSES).forEach((license: string) => {
				if (props.asset.metadata.license === LICENSES[license].address) {
					licenseDisplay = LICENSES[license].label;
				}
			});

			return (
				<>
					<GS.DrawerContentLine>
						<GS.DrawerContentHeader>{language.license}</GS.DrawerContentHeader>
						{licenseDisplay ? (
							<GS.DrawerContentLink href={getTxEndpoint(props.asset.metadata.license)} target={'_blank'}>
								{licenseDisplay}
							</GS.DrawerContentLink>
						) : (
							<TxAddress address={props.asset.metadata.license} wrap={false} />
						)}
					</GS.DrawerContentLine>
					{props.asset.metadata.udl && (
						<>
							{Object.keys(props.asset.metadata.udl).map((element: string, index: number) => {
								return (
									<GS.DrawerContentLine key={index}>
										<GS.DrawerContentHeader>{getTagDisplay(element)}</GS.DrawerContentHeader>
										{getLicenseValue(element)}
									</GS.DrawerContentLine>
								);
							})}
						</>
					)}
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
							<GS.DrawerHeader>{props.asset.name}</GS.DrawerHeader>
							{props.asset.metadata?.description && (
								<GS.DrawerContentDescription>{props.asset.metadata.description}</GS.DrawerContentDescription>
							)}
							{creator && (
								<GS.DrawerContentFlex>
									<S.OwnerLine>
										<GS.DrawerContentDetail>{language.createdBy}</GS.DrawerContentDetail>
										<OwnerLine
											owner={{
												address: props.asset.creator,
												profile: creator,
											}}
											callback={null}
										/>
									</S.OwnerLine>
								</GS.DrawerContentFlex>
							)}
						</GS.DrawerContent>
					}
				/>
			</GS.DrawerWrapper>
			{props.asset.metadata?.collectionId && checkValidAddress(props.asset.metadata.collectionId) && (
				<GS.DrawerWrapper>
					<Drawer
						title={language.collection}
						icon={ASSETS.collection}
						content={
							<GS.DrawerContent>
								<GS.DrawerContentDetail>
									<Link to={URLS.collectionAssets(props.asset.metadata.collectionId)}>
										{props.asset.metadata.collectionName
											? cleanTagValue(props.asset.metadata.collectionName)
											: props.asset.metadata.collectionId}
									</Link>
								</GS.DrawerContentDetail>
							</GS.DrawerContent>
						}
					/>
				</GS.DrawerWrapper>
			)}
			<GS.DrawerWrapper>
				<Drawer
					title={language.provenanceDetails}
					icon={ASSETS.provenance}
					content={
						<GS.DrawerContent>
							{parseInt(props.asset.dateCreated) !== 0 && (
								<GS.DrawerContentLine>
									<GS.DrawerContentHeader>{language.dateCreated}</GS.DrawerContentHeader>
									<GS.DrawerContentDetail>{formatDate(props.asset.dateCreated, 'iso')}</GS.DrawerContentDetail>
								</GS.DrawerContentLine>
							)}
							{parseInt(props.asset.metadata?.blockHeight ?? 0) !== 0 && (
								<GS.DrawerContentLine>
									<GS.DrawerContentHeader>{language.blockHeight}</GS.DrawerContentHeader>
									<GS.DrawerContentDetail>{formatCount(props.asset.metadata.blockHeight)}</GS.DrawerContentDetail>
								</GS.DrawerContentLine>
							)}
							<GS.DrawerContentLine>
								<GS.DrawerContentHeader>{language.transaction}</GS.DrawerContentHeader>
								<TxAddress address={props.asset.id} wrap={false} />
							</GS.DrawerContentLine>
						</GS.DrawerContent>
					}
				/>
			</GS.DrawerWrapper>
			{props.asset.metadata?.license && (
				<GS.DrawerWrapper>
					<Drawer
						title={language.assetRights}
						icon={ASSETS.license}
						content={<GS.DrawerContent>{getLicense()}</GS.DrawerContent>}
					/>
				</GS.DrawerWrapper>
			)}
		</S.Wrapper>
	) : null;
}
