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

export default function MusicCollectionsCarousel(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [nextSlideClicked, setNextSlideClicked] = React.useState<boolean>(false);
	const [firstClick, setFirstClick] = React.useState<boolean>(false);

	// Debug logging
	React.useEffect(() => {
		console.log('🎵 MusicCollectionsCarousel - Collections received:', props.collections?.length || 0);
		if (props.collections) {
			props.collections.forEach((col, i) => {
				console.log(`  ${i + 1}. ${col.title} (ID: ${col.id})`);
			});
		}

		// Force carousel refresh when collections change
		setTimeout(() => {
			window.dispatchEvent(new Event('resize'));
		}, 100);
	}, [props.collections]);

	const responsive = {
		desktopInitial: {
			breakpoint: { max: 3000, min: 1325 },
			items: 3, // Changed from 4 to 3 to show all collections
			partialVisibilityGutter: 10,
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

	console.log('🎵 Carousel responsive config:', responsive);
	console.log('🎵 Current window width:', window.innerWidth);

	const triggerResize = () => {
		window.dispatchEvent(new Event('resize'));
	};

	const handleAfterChange = () => {
		if (!nextSlideClicked) setNextSlideClicked(true);
		if (!firstClick) {
			triggerResize();
			setFirstClick(true);
		}
	};

	return (
		<S.Wrapper className={'fade-in'}>
			<S.Header>
				<h4>Music/Casts</h4>
			</S.Header>
			<S.CollectionsWrapper previousDisabled={!nextSlideClicked}>
				{console.log(
					'🎵 Carousel visibility check:',
					'collections:',
					props.collections?.length || 0,
					'loading:',
					props.loading
				)}
				{(props.collections || props.loading) && (
					<Carousel
						key={`music-carousel-${props.collections?.length || 0}-${props.loading}`}
						responsive={responsive}
						renderButtonGroupOutside={true}
						draggable={false}
						swipeable={true}
						arrows={!props.loading}
						infinite={!props.loading}
						removeArrowOnDeviceType={['tablet', 'mobile']}
						customTransition={'transform 500ms ease'}
						partialVisible
						autoPlay={!props.loading}
						autoPlaySpeed={5000}
						afterChange={handleAfterChange}
						onChange={(currentSlide) => console.log('🎵 Carousel changed to slide:', currentSlide)}
					>
						{props.collections &&
							(() => {
								console.log('🎵 Rendering collections in carousel:', props.collections.length);
								return props.collections.map((collection: CollectionType, index: number) => (
									<S.CollectionWrapper
										key={collection.id}
										className={'fade-in border-wrapper-alt2'}
										backgroundImage={getTxEndpoint(collection.thumbnail || DEFAULTS.thumbnail)}
										disabled={false}
										onClick={() => console.log('🎵 Clicked collection:', collection.title, '(Index:', index, ')')}
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
								));
							})()}
						{props.loading &&
							Array.from({ length: 5 }, (_, i) => i + 1).map((index) => (
								<S.CollectionWrapper
									key={`loading-${index}`}
									className={'fade-in border-wrapper-alt1'}
									backgroundImage={null}
									disabled={true}
								/>
							))}
					</Carousel>
				)}
			</S.CollectionsWrapper>
		</S.Wrapper>
	);
}
