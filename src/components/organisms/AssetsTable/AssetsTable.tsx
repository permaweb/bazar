import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from 'components/atoms/Button';
import { CurrencyLine } from 'components/atoms/CurrencyLine';
import { IconButton } from 'components/atoms/IconButton';
import { Select } from 'components/atoms/Select';
import { ASSET_SORT_OPTIONS, ASSETS, PAGINATORS, URLS } from 'helpers/config';
import { AssetDetailType, AssetSortType, SelectOptionType } from 'helpers/types';
import { sortOrders } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import { AssetData } from '../AssetData';

import * as S from './styles';
import { IProps } from './types';

export default function AssetsTable(props: IProps) {
	const navigate = useNavigate();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const scrollRef = React.useRef(null);

	function getListing(asset: AssetDetailType) {
		if (asset && asset.orders && asset.orders.length) {
			const sortedOrders = sortOrders(asset.orders, props.currentSortType.id as AssetSortType);

			if (sortedOrders && sortedOrders.length) {
				return <CurrencyLine amount={sortedOrders[0].price || '0'} currency={sortedOrders[0].currency} />;
			}
		}
		return <S.NoListings>{language.noListings}</S.NoListings>;
	}

	function getAssetIndexDisplay(assetIndex: number, sectionIndex: number, sectionLength: number) {
		let index = assetIndex + 1;
		if (sectionIndex > 0) index += sectionLength;
		if (props.assets && props.currentPage && props.pageCount) {
			index += Number(props.currentPage) * props.pageCount;
		}
		return index;
	}

	function handlePaginationAction(type: 'next' | 'previous') {
		if (props.nextAction || props.previousAction) {
			switch (type) {
				case 'next':
					props.nextAction();
					break;
				case 'previous':
					props.previousAction();
					break;
			}
			setTimeout(function () {
				if (scrollRef && scrollRef.current) {
					scrollRef.current.scrollIntoView({
						behavior: 'smooth',
						block: 'start',
					});
				}
			}, 1);
		}
	}

	function getActionDisabled() {
		if (!props.assets) return true;
		if (props.loading) return true;
		if (props.assets && props.assets.length) {
			return props.assets.every((asset: AssetDetailType) => (asset.orders ? asset.orders.length <= 0 : true));
		}
	}

	function getSectionHeader() {
		return (
			<S.AssetsListSectionHeader>
				<span>{language.asset}</span>
				<span>{language.listing}</span>
			</S.AssetsListSectionHeader>
		);
	}

	function getData() {
		if (props.loading) {
			let Wrapper: any;
			let Element: any;

			const keys = Array.from({ length: props.pageCount || PAGINATORS.default }, (_, i) => i + 1);
			switch (props.type) {
				case 'list':
					Wrapper = S.AssetsListWrapper;
					Element = S.AssetsListSectionElement;
					break;
				case 'grid':
					Wrapper = S.AssetsGridWrapper;
					Element = S.AssetGridDataWrapper;
					break;
			}

			const elements = keys.map((index) => (
				<Element key={index} className={'fade-in border-wrapper-alt1'} disabled={true} />
			));

			if (props.type === 'list') {
				const splitElements = [
					elements.slice(0, Math.ceil((props.pageCount || PAGINATORS.default) / 2)),
					elements.slice(Math.ceil((props.pageCount || PAGINATORS.default) / 2)),
				];
				return (
					<S.AssetsListWrapper>
						<S.AssetsListSection>
							{getSectionHeader()}
							<S.AssetsListSectionElements>{splitElements[0]}</S.AssetsListSectionElements>
						</S.AssetsListSection>
						<S.AssetsListSection>
							{getSectionHeader()}
							<S.AssetsListSectionElements>{splitElements[1]}</S.AssetsListSectionElements>
						</S.AssetsListSection>
					</S.AssetsListWrapper>
				);
			}

			return <Wrapper>{elements}</Wrapper>;
		}
		if (props.assets) {
			switch (props.type) {
				case 'list':
					const splitSections = [
						props.assets.slice(0, Math.ceil(props.assets.length / 2)),
						props.assets.slice(Math.ceil(props.assets.length / 2)),
					];
					return (
						<S.AssetsListWrapper>
							{splitSections.map((section: AssetDetailType[], index: number) => {
								let sectionIndex = index;
								return (
									<S.AssetsListSection key={index}>
										{getSectionHeader()}
										<S.AssetsListSectionElements>
											{section.map((asset: AssetDetailType, index: number) => {
												const redirect = `${URLS.asset}${asset.data.id}`;
												return (
													<S.AssetsListSectionElement
														key={index}
														className={'border-wrapper-primary'}
														onClick={() => navigate(redirect)}
														disabled={false}
													>
														<S.FlexElement>
															<S.Index>
																<p>{getAssetIndexDisplay(index, sectionIndex, splitSections[0].length)}</p>
															</S.Index>
															<S.Thumbnail>
																<AssetData asset={asset} preview />
															</S.Thumbnail>
															<S.Title>
																<p>{asset.data.title}</p>
															</S.Title>
														</S.FlexElement>
														<S.FlexElement>
															<S.Listings>{getListing(asset)}</S.Listings>
														</S.FlexElement>
													</S.AssetsListSectionElement>
												);
											})}
										</S.AssetsListSectionElements>
									</S.AssetsListSection>
								);
							})}
						</S.AssetsListWrapper>
					);
				case 'grid':
					return (
						<S.AssetsGridWrapper>
							{props.assets.map((asset: AssetDetailType, index: number) => {
								const redirect = `${URLS.asset}${asset.data.id}`;
								return (
									<S.AssetGridElement key={index} className={'fade-in'}>
										<Link to={redirect}>
											<S.AssetGridDataWrapper disabled={false}>
												<AssetData asset={asset} />
											</S.AssetGridDataWrapper>
										</Link>
										<S.AssetGridInfoWrapper>
											<Link to={redirect}>
												<S.Title>
													<p>{asset.data.title}</p>
												</S.Title>
											</Link>
											<S.Description>
												<p>{asset.data.description || asset.data.title}</p>
											</S.Description>
											<S.Listings>{getListing(asset)}</S.Listings>
										</S.AssetGridInfoWrapper>
									</S.AssetGridElement>
								);
							})}
						</S.AssetsGridWrapper>
					);
			}
		}
	}

	return (
		<S.Wrapper className={'fade-in'} ref={scrollRef}>
			<S.Header>
				<h4>{language.assets}</h4>
				<S.HeaderActions>
					{props.setFilterListings && props.setCurrentSortType && (
						<>
							<S.SelectWrapper>
								<Select
									label={null}
									activeOption={props.currentSortType}
									setActiveOption={(option: SelectOptionType) => props.setCurrentSortType(option)}
									options={ASSET_SORT_OPTIONS.map((option: SelectOptionType) => option)}
									disabled={getActionDisabled()}
								/>
							</S.SelectWrapper>
							<Button
								type={'primary'}
								label={language.filterListings}
								handlePress={props.setFilterListings}
								disabled={getActionDisabled()}
								active={props.filterListings}
								icon={props.filterListings ? ASSETS.close : null}
								className={'filter-listings'}
							/>
						</>
					)}
					<S.HeaderPaginator>
						<IconButton
							type={'alt1'}
							src={ASSETS.arrow}
							handlePress={() => handlePaginationAction('previous')}
							disabled={!props.assets || !props.previousAction}
							dimensions={{
								wrapper: 30,
								icon: 12.5,
							}}
							tooltip={language.previous}
							useBottomToolTip
							className={'table-previous'}
						/>
						<IconButton
							type={'alt1'}
							src={ASSETS.arrow}
							handlePress={() => handlePaginationAction('next')}
							disabled={!props.assets || !props.nextAction}
							dimensions={{
								wrapper: 30,
								icon: 12.5,
							}}
							tooltip={language.next}
							useBottomToolTip
							className={'table-next'}
						/>
					</S.HeaderPaginator>
				</S.HeaderActions>
			</S.Header>
			{getData()}
			<S.Footer>
				<Button
					type={'primary'}
					label={language.previous}
					handlePress={() => handlePaginationAction('previous')}
					disabled={!props.assets || !props.previousAction}
				/>
				<Button
					type={'primary'}
					label={language.next}
					handlePress={() => handlePaginationAction('next')}
					disabled={!props.assets || !props.nextAction}
				/>
			</S.Footer>
		</S.Wrapper>
	);
}
