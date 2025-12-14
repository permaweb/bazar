import React from 'react';
import Carousel from 'react-multi-carousel';
import { Link } from 'react-router-dom';

import { DEFAULTS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { CollectionType } from 'helpers/types';
import { formatDate } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import 'react-multi-carousel/lib/styles.css';

import * as S from './styles';
import { IProps } from './types';

export default function EbookCollectionsCarousel(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const responsive = {
		desktop: {
			breakpoint: { max: 3000, min: 1024 },
			items: 3,
			slidesToSlide: 1,
		},
		tablet: {
			breakpoint: { max: 1024, min: 464 },
			items: 2,
			slidesToSlide: 1,
		},
		mobile: {
			breakpoint: { max: 464, min: 0 },
			items: 1,
			slidesToSlide: 1,
		},
	};

	return (
		<S.Wrapper>
			<S.CollectionsWrapper>
				{props.loading || (props.collections && props.collections.length > 0) ? (
					<>
						<h4>Books</h4>
						<Carousel
							responsive={responsive}
							infinite={props.collections && props.collections.length > 3}
							autoPlay={false}
							keyBoardControl={true}
							customTransition="all .5"
							transitionDuration={500}
							containerClass="carousel-container"
							removeArrowOnDeviceType={['tablet', 'mobile']}
							itemClass="carousel-item-padding-40-px"
						>
							{props.collections &&
								props.collections.map((collection: CollectionType, index: number) => {
									return (
										<S.CollectionWrapper
											key={collection.id}
											className={'fade-in border-wrapper-alt2'}
											backgroundImage={getTxEndpoint(collection.thumbnail || DEFAULTS.thumbnail)}
											disabled={false}
										>
											<Link to={URLS.collectionAssets(collection.id)}>
												<S.InfoWrapper>
													<S.InfoTile>
														<S.InfoDetail>
															<span>{collection.title}</span>
														</S.InfoDetail>
														<S.InfoDetailAlt>
															<span>{`${language.createdOn} ${formatDate(collection.dateCreated, 'epoch')}`}</span>
														</S.InfoDetailAlt>
													</S.InfoTile>
												</S.InfoWrapper>
											</Link>
										</S.CollectionWrapper>
									);
								})}
							{props.loading &&
								Array.from({ length: 3 }, (_, i) => i + 1).map((index) => (
									<S.CollectionWrapper
										key={`loading-${index}`}
										className={'fade-in border-wrapper-alt1'}
										backgroundImage={null}
										disabled={true}
									/>
								))}
						</Carousel>
					</>
				) : null}
			</S.CollectionsWrapper>
		</S.Wrapper>
	);
}
