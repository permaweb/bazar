import React from 'react';

import { getProfileByWalletAddress } from 'api';

import * as GS from 'app/styles';
import { Drawer } from 'components/atoms/Drawer';
import { TxAddress } from 'components/atoms/TxAddress';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { AssetData } from 'components/organisms/AssetData';
import { ASSETS, LICENSES } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { ProfileHeaderType } from 'helpers/types';
import { checkValidAddress, formatCount, formatDate, getTagDisplay, splitTagValue } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

// TODO: creator
// TODO: license
// TODO: collection link
export default function AssetInfo(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [creator, setCreator] = React.useState<ProfileHeaderType | null>(null);

	React.useEffect(() => {
		(async function () {
			if (props.asset && props.asset.data.creator && checkValidAddress(props.asset.data.creator)) {
				try {
					setCreator(await getProfileByWalletAddress({ address: props.asset.data.creator }));
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [props.asset]);

	function getLicenseValue(licenseKey: string) {
		if (!props.asset || !props.asset.data.udl || !props.asset.data.udl[licenseKey]) return null;
		const licenseElement = props.asset.data.udl[licenseKey];

		if (typeof licenseElement === 'object') {
			return (
				<GS.DrawerContentDetail>
					{splitTagValue(licenseElement.value)}{' '}
					<img
						style={{ height: '17.5px', width: '17.5px', margin: '3.5px 0 0 10px' }}
						src={getTxEndpoint('L99jaxRKQKJt9CqoJtPaieGPEhJD3wNhR4iGqc8amXs')}
					/>
				</GS.DrawerContentDetail>
			);
		}

		if (checkValidAddress(licenseElement)) {
			return <TxAddress address={licenseElement} wrap={false} />;
		} else {
			return <GS.DrawerContentDetail>{licenseElement}</GS.DrawerContentDetail>;
		}
	}

	function getLicense() {
		if (props.asset && props.asset.data.license) {
			let licenseDisplay: string | null = null;

			Object.keys(LICENSES).forEach((license: string) => {
				if (props.asset.data.license === LICENSES[license].address) {
					licenseDisplay = LICENSES[license].label;
				}
			});

			return (
				<>
					<GS.DrawerContentLine>
						<GS.DrawerContentHeader>{language.license}</GS.DrawerContentHeader>
						{licenseDisplay ? (
							<GS.DrawerContentLink href={getTxEndpoint(props.asset.data.license)} target={'_blank'}>
								{licenseDisplay}
							</GS.DrawerContentLink>
						) : (
							<TxAddress address={props.asset.data.license} wrap={false} />
						)}
					</GS.DrawerContentLine>
					{props.asset.data.udl && (
						<>
							{Object.keys(props.asset.data.udl).map((element: string, index: number) => {
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
							<GS.DrawerHeader>{props.asset.data.title}</GS.DrawerHeader>
							{creator && (
								<GS.DrawerContentFlex>
									<S.OwnerLine>
										<GS.DrawerContentDetail>{language.createdBy}</GS.DrawerContentDetail>
										<OwnerLine
											owner={{
												address: props.asset.data.creator,
												profile: creator,
											}}
											callback={null}
										/>
									</S.OwnerLine>
								</GS.DrawerContentFlex>
							)}
							{props.asset.data.description && (
								<GS.DrawerContentDetail>{props.asset.data.description}</GS.DrawerContentDetail>
							)}
							{/* {sponsored && (
								<S.DCOwnerFlex>
									<p>{language.sponsoredAsset}</p>
								</S.DCOwnerFlex>
							)}
							{collection && (
								<S.DCCollectionFlex>
									<Link to={`${urls.collection}${collection.id}`}>{collection.title}</Link>
								</S.DCCollectionFlex>
							)} */}
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
						content={<GS.DrawerContent>{getLicense()}</GS.DrawerContent>}
					/>
				</GS.DrawerWrapper>
			)}
		</S.Wrapper>
	) : null;
}
