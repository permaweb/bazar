import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { getCollectionById } from 'api/collections';

import * as GS from 'app/styles';
import { Drawer } from 'components/atoms/Drawer';
import { TxAddress } from 'components/atoms/TxAddress';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { AssetData } from 'components/organisms/AssetData';
import { ASSETS, LICENSES, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { CollectionDetailType } from 'helpers/types';
import { checkValidAddress, cleanTagValue, formatCount, formatDate, getTagDisplay, splitTagValue } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { RootState } from 'store';

import * as S from './styles';
import { IProps } from './types';

export default function AssetInfo(props: IProps) {
	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);

	const permawebProvider = usePermawebProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [creator, setCreator] = React.useState<any | null>(null);
	const [collectionDetails, setCollectionDetails] = React.useState<CollectionDetailType | null>(null);
	const [isLoadingCollection, setIsLoadingCollection] = React.useState<boolean>(false);
	const [collectionError, setCollectionError] = React.useState<string | null>(null);

	// Fetch creator profile
	React.useEffect(() => {
		(async function () {
			if (props.asset && props.asset.data.creator && checkValidAddress(props.asset.data.creator)) {
				try {
					setCreator(await permawebProvider.libs.getProfileById(props.asset.data.creator));
				} catch (e: any) {
					console.error(e);
				}
			}
		})();
	}, [props.asset]);

	// Fetch collection details if needed
	React.useEffect(() => {
		(async function () {
			try {
				if (!props.asset) {
					return;
				}

				// Only fetch if we have a collectionId but no collectionName
				if (
					props.asset.data.collectionId &&
					checkValidAddress(props.asset.data.collectionId) &&
					!props.asset.data.collectionName
				) {
					setIsLoadingCollection(true);
					setCollectionError(null);

					const collection = await getCollectionById({ id: props.asset.data.collectionId });

					if (collection) {
						setCollectionDetails(collection);
					}
				}
			} catch (e: any) {
				console.error('Error in collection effect:', e);
				setCollectionError(e.message || 'Failed to fetch collection details');
			} finally {
				setIsLoadingCollection(false);
			}
		})();
	}, [props.asset]);

	function getLicenseValue(licenseKey: string) {
		if (!props.asset || !props.asset.data.udl || !props.asset.data.udl[licenseKey]) return null;
		const licenseElement = props.asset.data.udl[licenseKey];

		if (typeof licenseElement === 'object') {
			return (
				<GS.DrawerContentDetail>
					{licenseElement.value ? splitTagValue(licenseElement.value) : '-'}{' '}
					{props.asset.data.udl.currency &&
						currenciesReducer &&
						currenciesReducer[props.asset.data.udl.currency] &&
						currenciesReducer[props.asset.data.udl.currency].Logo &&
						/\d/.test(licenseElement.value) && (
							<S.CurrencyIcon src={getTxEndpoint(currenciesReducer[props.asset.data.udl.currency].Logo)} />
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

	// Helper function to render collection name
	const renderCollectionName = () => {
		if (isLoadingCollection) {
			return <span>Loading...</span>;
		}

		if (collectionError) {
			return <span title={collectionError}>{props.asset.data.collectionId}</span>;
		}

		if (props.asset.data.collectionName) {
			return cleanTagValue(props.asset.data.collectionName);
		}

		if (collectionDetails) {
			return cleanTagValue(collectionDetails.title);
		}

		return props.asset.data.collectionId;
	};

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
								<GS.DrawerContentDescription>{props.asset.data.description}</GS.DrawerContentDescription>
							)}
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
						</GS.DrawerContent>
					}
				/>
			</GS.DrawerWrapper>
			{props.asset.data.collectionId && checkValidAddress(props.asset.data.collectionId) && (
				<GS.DrawerWrapper>
					<Drawer
						title={language.collection}
						icon={ASSETS.collection}
						content={
							<GS.DrawerContent>
								<GS.DrawerContentDetail>
									<Link to={URLS.collectionAssets(props.asset.data.collectionId)}>{renderCollectionName()}</Link>
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
