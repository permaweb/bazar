import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { connect } from '@permaweb/aoconnect';
import AOProfile from '@permaweb/aoprofile';

import { getCollectionById } from 'api';

import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { Loader } from 'components/atoms/Loader';
import { Modal } from 'components/molecules/Modal';
import { OwnerLine } from 'components/molecules/OwnerLine';
import { URLTabs } from 'components/molecules/URLTabs';
import { ActivityTable } from 'components/organisms/ActivityTable';
import { AssetsTable } from 'components/organisms/AssetsTable';
import { Stamps } from 'components/organisms/Stamps';
import { ASSETS, DEFAULTS, PAGINATORS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { CollectionDetailType } from 'helpers/types';
import { checkValidAddress, formatDate, formatPercentage } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

const MAX_DESCRIPTION_LENGTH = 50;

// TODO: Listing index in collection process
export default function Collection() {
	const { getProfileById } = AOProfile.init({ ao: connect({ MODE: 'legacy' }) });

	const { id, active } = useParams();
	const navigate = useNavigate();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [collection, setCollection] = React.useState<CollectionDetailType | null>(null);
	const [collectionLoading, setCollectionLoading] = React.useState<boolean>(false);
	const [collectionErrorResponse, setCollectionErrorResponse] = React.useState<string | null>(null);
	const [showFullDescription, setShowFullDescription] = React.useState<boolean>(false);

	React.useEffect(() => {
		if (!id && !active) navigate(URLS.notFound);
		if (id && !active) navigate(URLS.collectionAssets(id));
	}, [id, active, navigate]);

	React.useEffect(() => {
		(async function () {
			if (id && checkValidAddress(id)) {
				setCollectionLoading(true);
				try {
					setCollection(await getCollectionById({ id: id }));
				} catch (e: any) {
					setCollectionErrorResponse(e.message || language.collectionFetchFailed);
				}
				setCollectionLoading(false);
			} else navigate(URLS.notFound);
		})();
	}, [id]);

	console.log(collection);

	React.useEffect(() => {
		(async function () {
			if (collection && collection.creator) {
				try {
					const creatorProfile = await getProfileById({ profileId: collection.creator });
					setCollection((prev) => ({ ...prev, creatorProfile }));
				} catch (e: any) {
					console.error(e);
					setCollection((prev) => ({
						...prev,
						creatorProfile: {
							id: collection.creator,
							walletAddress: null,
							displayName: null,
							username: null,
							description: null,
							thumbnail: null,
							banner: null,
							version: null,
						},
					}));
				}
			}
		})();
	}, [collection?.creator]);

	const TABS = React.useMemo(
		() => [
			{
				label: language.assets,
				icon: ASSETS.asset,
				disabled: false,
				url: URLS.collectionAssets(id),
				view: () => (
					<>
						<S.AssetsWrapper>
							{collection.assetIds && (
								<AssetsTable
									ids={collection.assetIds}
									type={'grid'}
									pageCount={PAGINATORS.collection.assets}
									currentListings={collection.currentListings}
								/>
							)}
						</S.AssetsWrapper>
					</>
				),
			},
			{
				label: language.activity,
				icon: ASSETS.activity,
				disabled: false,
				url: URLS.collectionActivity(id),
				view: () => <>{collection.activityProcess && <ActivityTable activityId={collection.activityProcess} />}</>,
			},
		],
		[id, collection?.assetIds, collection?.activityProcess]
	);

	const urlTabs = React.useMemo(() => {
		return <URLTabs tabs={TABS} activeUrl={TABS[0].url} />;
	}, [TABS]);

	function getData() {
		if (collection) {
			return (
				<>
					<S.CardWrapper
						backgroundImage={getTxEndpoint(collection.banner || DEFAULTS.banner)}
						className={'border-wrapper-alt2'}
					>
						<S.OverlayWrapper />
						<S.StampWidgetWrapper>
							<Stamps txId={collection.id} title={collection.title} />
						</S.StampWidgetWrapper>
						<S.InfoWrapper>
							<S.Thumbnail>
								<img src={getTxEndpoint(collection.thumbnail || DEFAULTS.thumbnail)} alt={'Thumbnail'} />
							</S.Thumbnail>
							<S.InfoBody>
								<S.InfoBodyTile>
									<S.InfoHeaderFlex2>
										<span>{language.title}</span>
									</S.InfoHeaderFlex2>
									<S.InfoDetailFlex2>
										<span>{collection.title}</span>
									</S.InfoDetailFlex2>
								</S.InfoBodyTile>
								{collection.metrics && (
									<S.InfoMetrics>
										<S.InfoBodyTile>
											<S.InfoHeader>
												<span>{language.totalAssets}</span>
											</S.InfoHeader>
											<S.InfoDetail>
												<span>{collection.metrics.assetCount}</span>
											</S.InfoDetail>
										</S.InfoBodyTile>
										<S.InfoBodyTile>
											<S.InfoHeader>
												<span>{language.floorPrice}</span>
											</S.InfoHeader>
											<S.InfoDetail>
												<CurrencyLine
													amount={collection.metrics.floorPrice}
													currency={collection.metrics.defaultCurrency}
												/>
											</S.InfoDetail>
										</S.InfoBodyTile>
										<S.InfoBodyTile>
											<S.InfoHeader>
												<span>{language.percentageListed}</span>
											</S.InfoHeader>
											<S.InfoDetail>
												<span>{formatPercentage(collection.metrics.percentageListed)}</span>
											</S.InfoDetail>
										</S.InfoBodyTile>
									</S.InfoMetrics>
								)}
							</S.InfoBody>
							<S.InfoFooter>
								<S.InfoCreator>
									{collection.creatorProfile ? (
										<>
											<p>{language.createdBy}</p>
											<OwnerLine
												owner={{
													address: collection.creator,
													profile: collection.creatorProfile,
												}}
												callback={null}
											/>
											<p>{formatDate(collection.dateCreated, 'epoch')}</p>
										</>
									) : (
										<p>{`${language.fetching}...`}</p>
									)}
								</S.InfoCreator>
								{collection.description && (
									<S.InfoDescription>
										<S.DescriptionText>
											{collection.description.length > MAX_DESCRIPTION_LENGTH
												? collection.description.substring(0, MAX_DESCRIPTION_LENGTH) + '...'
												: collection.description}
											{collection.description.length > MAX_DESCRIPTION_LENGTH && (
												<button onClick={() => setShowFullDescription(true)}>{language.viewFullDescription}</button>
											)}
										</S.DescriptionText>
									</S.InfoDescription>
								)}
							</S.InfoFooter>
						</S.InfoWrapper>
					</S.CardWrapper>
					{urlTabs}
					{showFullDescription && collection && collection.description && (
						<Modal header={language.description} handleClose={() => setShowFullDescription(false)}>
							<div className={'modal-wrapper'}>
								<p>{collection.description}</p>
							</div>
						</Modal>
					)}
				</>
			);
		} else {
			if (collectionLoading) return <Loader />;
			else if (collectionErrorResponse) return <p>{collectionErrorResponse}</p>;
			else return null;
		}
	}

	return <S.Wrapper className={'fade-in'}>{getData()}</S.Wrapper>;
}
