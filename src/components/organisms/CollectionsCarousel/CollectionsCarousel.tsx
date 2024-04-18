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

export default function CollectionsCarousel(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [nextSlideClicked, setNextSlideClicked] = React.useState<boolean>(false);

	const responsive = {
		desktopInitial: {
			breakpoint: { max: 3000, min: 1325 },
			items: 4,
			partialVisibilityGutter: 20,
		},
		desktopSecondary: {
			breakpoint: { max: 1325, min: 1100 },
			items: 3,
		},
		tablet: {
			breakpoint: { max: 1100, min: 700 },
			items: 2,
		},
		mobile: {
			breakpoint: { max: 700, min: 0 },
			items: 1,
		},
	};

	return (
		<S.Wrapper className={'fade-in'}>
			<S.Header>
				<h4>{language.collections}</h4>
			</S.Header>
			<S.CollectionsWrapper previousDisabled={!nextSlideClicked}>
				{(props.collections || props.loading) && (
					<Carousel
						responsive={responsive}
						renderButtonGroupOutside={true}
						draggable={false}
						arrows={!props.loading}
						infinite={!props.loading}
						partialVisbile={true}
						removeArrowOnDeviceType={['tablet', 'mobile']}
						customTransition={'transform 500ms ease'}
						afterChange={() => {
							if (!nextSlideClicked) setNextSlideClicked(true);
						}}
					>
						{props.collections &&
							props.collections.map((collection: CollectionType, index: number) => {
								return (
									<S.CollectionWrapper
										key={index}
										className={'fade-in border-wrapper-alt2'}
										backgroundImage={getTxEndpoint(collection.data.thumbnail || DEFAULTS.thumbnail)}
										disabled={false}
									>
										<Link to={`${URLS.collection}${collection.data.id}`}>
											<S.InfoWrapper>
												<S.InfoTile>
													<S.InfoDetail>
														<span>{collection.data.title}</span>
													</S.InfoDetail>
													<S.InfoDetailAlt>
														<span>{`${language.createdOn} ${formatDate(collection.data.dateCreated, 'iso')}`}</span>
													</S.InfoDetailAlt>
												</S.InfoTile>
											</S.InfoWrapper>
										</Link>
									</S.CollectionWrapper>
								);
							})}
						{props.loading &&
							Array.from({ length: 5 }, (_, i) => i + 1).map((index) => {
								return (
									<S.CollectionWrapper
										key={index}
										className={'fade-in border-wrapper-alt1'}
										backgroundImage={null}
										disabled={true}
									/>
								);
							})}
					</Carousel>
				)}
			</S.CollectionsWrapper>
		</S.Wrapper>
	);
}
