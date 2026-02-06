import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { getCollectionById } from 'api/collections';

import * as GS from 'app/styles';
import { Drawer } from 'components/atoms/Drawer';
import { TxAddress } from 'components/atoms/TxAddress';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { AssetData } from 'components/organisms/AssetData';
import { MetadataSection } from 'components/organisms/MetadataSection';
import { ASSETS, CUSTOM_ORDERBOOKS, LICENSES, REFORMATTED_ASSETS, TOKEN_REGISTRY, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { CollectionDetailType } from 'helpers/types';
import {
	checkValidAddress,
	cleanTagValue,
	formatAddress,
	formatCount,
	formatDate,
	getTagDisplay,
	splitTagValue,
} from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { useTokenProvider } from 'providers/TokenProvider';
import { RootState } from 'store';

import * as S from './styles';
import { IProps } from './types';

export default function AssetInfo(props: IProps) {
	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);
	const collectionsReducer = useSelector((state: RootState) => state.collectionsReducer);

	const permawebProvider = usePermawebProvider();
	const tokenProvider = useTokenProvider();

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

				if (
					props.asset.data.collectionId &&
					checkValidAddress(props.asset.data.collectionId) &&
					!props.asset.data.collectionName
				) {
					setIsLoadingCollection(true);
					setCollectionError(null);

					let collection = collectionsReducer?.stamped?.collections.find(
						(collection) => collection.id === props.asset.data.collectionId
					);

					if (!collection) {
						collection = await getCollectionById({
							id: props.asset.data.collectionId,
							libs: permawebProvider.libs,
						});
					}

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

	function getTokenMetadata(currencyId: string) {
		// Try token provider first (has most complete data)
		const providerToken = tokenProvider.availableTokens.find((token) => token.id === currencyId);
		if (providerToken) {
			return {
				logo: providerToken.logo,
				name: providerToken.name,
				symbol: providerToken.symbol,
			};
		}

		// Try TOKEN_REGISTRY next
		if (TOKEN_REGISTRY[currencyId]) {
			return {
				logo: TOKEN_REGISTRY[currencyId].logo,
				name: TOKEN_REGISTRY[currencyId].name,
				symbol: TOKEN_REGISTRY[currencyId].symbol,
			};
		}

		// Try currenciesReducer (from Redux state)
		if (currenciesReducer && currenciesReducer[currencyId]) {
			return {
				logo: currenciesReducer[currencyId].Logo,
				name: currenciesReducer[currencyId].Name || currenciesReducer[currencyId].Ticker,
				symbol: currenciesReducer[currencyId].Ticker,
			};
		}

		// Final fallback: REFORMATTED_ASSETS
		if (REFORMATTED_ASSETS[currencyId]) {
			return {
				logo: REFORMATTED_ASSETS[currencyId].logo,
				name: REFORMATTED_ASSETS[currencyId].title,
				symbol: null,
			};
		}

		// Return null if no metadata found
		return null;
	}

	function getLicenseValue(licenseKey: string) {
		if (!props.asset || !props.asset.data.udl || !props.asset.data.udl[licenseKey]) return null;
		const licenseElement = props.asset.data.udl[licenseKey];

		// Special handling for the currency field itself
		if (licenseKey === 'currency' && checkValidAddress(licenseElement)) {
			const tokenMeta = getTokenMetadata(licenseElement);

			if (tokenMeta) {
				return (
					<Link to={`${URLS.asset}${licenseElement}`}>
						<S.CurrencyInfo>
							{tokenMeta.logo && (
								<S.CurrencyIcon src={getTxEndpoint(tokenMeta.logo)} alt={tokenMeta.symbol || tokenMeta.name} />
							)}
							<S.CurrencyName>{tokenMeta.symbol || tokenMeta.name}</S.CurrencyName>
						</S.CurrencyInfo>
					</Link>
				);
			} else {
				// Fallback for unknown tokens
				return (
					<Link to={`${URLS.asset}${licenseElement}`}>
						<S.CurrencyInfo>
							<span>🪙</span>
							<S.CurrencyName>{formatAddress(licenseElement, false)}</S.CurrencyName>
						</S.CurrencyInfo>
					</Link>
				);
			}
		}

		if (typeof licenseElement === 'object') {
			// Check if this field has a numeric value (indicating it's a currency amount)
			const hasNumericValue = /\d/.test(licenseElement.value);
			const currencyId = props.asset.data.udl.currency;

			if (hasNumericValue && currencyId) {
				const tokenMeta = getTokenMetadata(currencyId);

				return (
					<S.CurrencyWrapper>
						<span>{licenseElement.value ? splitTagValue(licenseElement.value) : '-'}</span>
						{tokenMeta && (
							<Link to={`${URLS.asset}${currencyId}`}>
								<S.CurrencyInfo>
									{tokenMeta.logo && (
										<S.CurrencyIcon src={getTxEndpoint(tokenMeta.logo)} alt={tokenMeta.symbol || tokenMeta.name} />
									)}
									<S.CurrencyName>{tokenMeta.symbol || tokenMeta.name}</S.CurrencyName>
								</S.CurrencyInfo>
							</Link>
						)}
						{!tokenMeta && (
							<Link to={`${URLS.asset}${currencyId}`}>
								<S.CurrencyInfo>
									<span>🪙</span>
									<S.CurrencyName>{formatAddress(currencyId, false)}</S.CurrencyName>
								</S.CurrencyInfo>
							</Link>
						)}
					</S.CurrencyWrapper>
				);
			}

			// Non-currency numeric values
			return (
				<GS.DrawerContentDetail>
					{licenseElement.value ? splitTagValue(licenseElement.value) : '-'}
				</GS.DrawerContentDetail>
			);
		} else if (checkValidAddress(licenseElement)) {
			// Special handling for currency field - show token logo and name
			if (licenseKey === 'currency') {
				const tokenMeta = getTokenMetadata(licenseElement);

				if (tokenMeta) {
					return (
						<Link to={`${URLS.asset}${licenseElement}`}>
							<S.CurrencyInfo>
								{tokenMeta.logo && (
									<S.CurrencyIcon src={getTxEndpoint(tokenMeta.logo)} alt={tokenMeta.symbol || tokenMeta.name} />
								)}
								<S.CurrencyName>{tokenMeta.symbol || tokenMeta.name}</S.CurrencyName>
							</S.CurrencyInfo>
						</Link>
					);
				}

				// Fallback for currency without metadata
				return (
					<Link to={`${URLS.asset}${licenseElement}`}>
						<S.CurrencyInfo>
							<span>🪙</span>
							<S.CurrencyName>{formatAddress(licenseElement, false)}</S.CurrencyName>
						</S.CurrencyInfo>
					</Link>
				);
			}

			// For non-currency addresses, use TxAddress
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
			return <span title={collectionError}>{formatAddress(props.asset.data.collectionId, false)}</span>;
		}

		if (props.asset.data.collectionName) {
			return cleanTagValue(props.asset.data.collectionName);
		}

		if (collectionDetails) {
			return collectionDetails.title ?? collectionDetails.name ?? formatAddress(collectionDetails.id, false);
		}

		return formatAddress(props.asset.data.collectionId, false);
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
							{props.asset?.data?.description && (
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
			{props.asset.state?.metadata && <MetadataSection metadata={props.asset.state.metadata} />}
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
							{props.asset?.orderbook?.id && (
								<GS.DrawerContentLine>
									<GS.DrawerContentHeader>Orderbook</GS.DrawerContentHeader>
									<TxAddress address={props.asset.orderbook.id} wrap={false} />
								</GS.DrawerContentLine>
							)}
							{(() => {
								// Check if asset is an ebook (but exclude tokens)
								const assetId = props.asset.data?.id || '';
								const isToken = TOKEN_REGISTRY[assetId] || CUSTOM_ORDERBOOKS[assetId];

								let isEbook = false;
								if (!isToken && assetId) {
									const topics = props.asset.data?.topics || [];
									const hasEbookTopics = topics.some((topic: string) => ['Book', 'Ebook', 'ISBN'].includes(topic));
									const contentType = props.asset.data?.contentType || '';
									isEbook = hasEbookTopics || contentType === 'application/pdf' || contentType === 'text/plain';
								}

								if (!isEbook) return null;

								const metadata = props.asset.state?.metadata || {};
								const author = metadata.Author || metadata.author;
								const bookLanguage = metadata.Language || metadata.language;
								const isbn = metadata.Isbn || metadata.isbn || metadata.ISBN;
								const genre = metadata.Genre || metadata.genre;
								const publicationDate =
									metadata.Publicationdate || metadata.PublicationDate || metadata.publicationDate;

								return (
									<>
										{author && (
											<GS.DrawerContentLine>
												<GS.DrawerContentHeader>{language.author}</GS.DrawerContentHeader>
												<GS.DrawerContentDetail>{author}</GS.DrawerContentDetail>
											</GS.DrawerContentLine>
										)}
										{bookLanguage && (
											<GS.DrawerContentLine>
												<GS.DrawerContentHeader>{language.bookLanguage}</GS.DrawerContentHeader>
												<GS.DrawerContentDetail>{bookLanguage}</GS.DrawerContentDetail>
											</GS.DrawerContentLine>
										)}
										{isbn && (
											<GS.DrawerContentLine>
												<GS.DrawerContentHeader>{language.isbn}</GS.DrawerContentHeader>
												<GS.DrawerContentDetail>{isbn}</GS.DrawerContentDetail>
											</GS.DrawerContentLine>
										)}
										{genre && (
											<GS.DrawerContentLine>
												<GS.DrawerContentHeader>{language.genre}</GS.DrawerContentHeader>
												<GS.DrawerContentDetail>{genre}</GS.DrawerContentDetail>
											</GS.DrawerContentLine>
										)}
										{publicationDate && (
											<GS.DrawerContentLine>
												<GS.DrawerContentHeader>{language.publicationDate}</GS.DrawerContentHeader>
												<GS.DrawerContentDetail>{publicationDate}</GS.DrawerContentDetail>
											</GS.DrawerContentLine>
										)}
									</>
								);
							})()}
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
