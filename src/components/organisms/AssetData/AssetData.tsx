import React from 'react';
import { ReactSVG } from 'react-svg';

import { ASSETS, REFORMATTED_ASSETS } from 'helpers/config';
import { getRendererEndpoint, getTxEndpoint } from 'helpers/endpoints';
import { AssetRenderType } from 'helpers/types';
import { checkValidAddress } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';

import * as S from './styles';
import { IProps } from './types';

// TODO: Just imported @permaweb/libs
// Need to fix asset type and create an order to test collection activity
// If collection activity is getting the correct orderbook ids, the last piece
// would be to get individiual orders into the collection activity
export default function AssetData(props: IProps) {
	const arProvider = useArweaveProvider();

	const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
	const wrapperRef = React.useRef<any>(null);

	const [wrapperVisible, setWrapperVisible] = React.useState<boolean>(false);

	const [assetRender, setAssetRender] = React.useState<AssetRenderType | null>(null);

	const [loadError, setLoadError] = React.useState<boolean>(false);
	const [contain, setContain] = React.useState<boolean>(true);
	const [frameLoaded, setFrameLoaded] = React.useState<boolean>(false);

	const checkVisibility = () => {
		const element = wrapperRef.current;
		if (!element) return;
		if (props.scrolling) return;

		const scroll = window.scrollY || window.pageYOffset;
		const boundsTop = element.getBoundingClientRect().top + scroll;

		const viewport = {
			top: scroll,
			bottom: scroll + window.innerHeight,
		};

		const bounds = {
			top: boundsTop,
			bottom: boundsTop + element.clientHeight,
		};

		const visible = bounds.bottom >= viewport.top && bounds.top <= viewport.bottom;
		setWrapperVisible(visible);
		if (visible) setFrameLoaded(true);
	};

	React.useEffect(() => {
		checkVisibility();
		window.addEventListener('scroll', checkVisibility);
		window.addEventListener('resize', checkVisibility);

		return () => {
			window.removeEventListener('scroll', checkVisibility);
			window.removeEventListener('resize', checkVisibility);
		};
	}, [props.asset, props.scrolling]);

	async function handleGetAssetRender(assetId: string): Promise<AssetRenderType> {
		const assetResponse = await fetch(getTxEndpoint(assetId));
		const contentType = assetResponse.headers.get('content-type');

		if (assetResponse.status === 200 && contentType) {
			return {
				url: getAssetPath(assetResponse),
				type: 'raw',
				contentType: contentType,
			};
		}
	}

	React.useEffect(() => {
		(async function () {
			if (!assetRender && wrapperVisible) {
				if (props.assetRender) {
					setAssetRender(props.assetRender);
				} else {
					if (props.asset && !props.assetRender) {
						const renderWith = props.asset.data?.renderWith ? props.asset.data.renderWith : '[]';
						let parsedRenderWith: string | null = null;
						try {
							parsedRenderWith = JSON.parse(renderWith);
						} catch (e: any) {
							parsedRenderWith = renderWith;
						}
						if (parsedRenderWith && parsedRenderWith.length) {
							setAssetRender({
								url: getRendererEndpoint(parsedRenderWith, props.asset.data.id),
								type: 'renderer',
								contentType: 'renderer',
							});
						} else {
							const renderFetch = await handleGetAssetRender(props.asset.data.id);
							setAssetRender(renderFetch);
						}
					}
				}
			}
		})();
	}, [props.asset, props.assetRender, wrapperVisible]);

	React.useEffect(() => {
		if (assetRender) {
			if (assetRender.contentType.startsWith('image')) {
				let img = new Image();
				img.onload = function () {
					const imageElement = this as HTMLImageElement;
					if (imageElement.height > imageElement.width || imageElement.width >= 2 * imageElement.height) {
						setContain(true);
					} else {
						setContain(false);
					}
				};
				img.onerror = function () {
					console.error('Error loading the image.');
				};
				img.src = assetRender.url;
			}
		}
	}, [assetRender]);

	React.useEffect(() => {
		function sendFrameData() {
			if (iframeRef.current) {
				iframeRef.current.contentWindow.postMessage(
					{
						type: 'setHeight',
						height: `${props.frameMinHeight}px`,
						walletConnection: arProvider.walletAddress ? 'connected' : 'none',
						walletAddress: arProvider.walletAddress,
					},
					'*'
				);
			}
		}

		if (frameLoaded && iframeRef.current) {
			sendFrameData();
		}
	}, [arProvider.walletAddress, frameLoaded]);

	function getAssetPath(assetResponse: any) {
		if (props.asset) {
			return assetResponse.url;
		} else return '';
	}

	const handleError = () => {
		setLoadError(true);
	};

	function getUnsupportedWrapper() {
		return (
			<S.UnsupportedWrapper>
				<ReactSVG src={ASSETS.unsupported} />
			</S.UnsupportedWrapper>
		);
	}

	function getRendererIcon() {
		if (props.asset && props.asset.data) {
			if (props.asset.data.thumbnail && checkValidAddress(props.asset.data.thumbnail)) {
				return <img src={getTxEndpoint(props.asset.data.thumbnail)} />;
			} else {
				return <ReactSVG src={ASSETS.renderer} />;
			}
		}
		return <ReactSVG src={ASSETS.renderer} />;
	}

	function sendFrameData() {
		if (iframeRef.current && iframeRef.current.contentWindow) {
			iframeRef.current.contentWindow.postMessage(
				{
					type: 'setHeight',
					height: `${props.frameMinHeight || 0}px`,
					walletConnection: arProvider.walletAddress ? 'connected' : 'none',
					connectedAddress: arProvider.walletAddress,
					processId: props.asset ? props.asset.data.id : null,
				},
				'*'
			);
		}
	}

	function getData() {
		if (assetRender) {
			switch (assetRender.type) {
				case 'renderer':
					if (!props.preview) {
						return (props.loadRenderer || props.autoLoad) && (wrapperVisible || frameLoaded) ? (
							<S.Frame
								ref={iframeRef}
								src={assetRender.url}
								allowFullScreen
								onLoad={() => {
									setFrameLoaded(true);
									if (iframeRef.current) {
										sendFrameData();
									}
								}}
								onError={handleError}
							/>
						) : (
							<S.FramePreview>{getRendererIcon()}</S.FramePreview>
						);
					} else {
						return <S.Preview>{getRendererIcon()}</S.Preview>;
					}
				case 'raw':
					if (loadError) {
						return getUnsupportedWrapper();
					}
					if (props.asset && props.asset.state && props.asset.state.logo && checkValidAddress(props.asset.state.logo)) {
						return (
							<S.Logo
								src={getTxEndpoint(props.asset.state.logo)}
								contain={contain}
								onError={handleError}
								loading={'lazy'}
							/>
						);
					}
					if (props.asset && props.asset.data && REFORMATTED_ASSETS[props.asset.data.id]) {
						return (
							<S.Logo
								src={getTxEndpoint(REFORMATTED_ASSETS[props.asset.data.id].logo)}
								contain={contain}
								onError={handleError}
								loading={'lazy'}
							/>
						);
					}

					if (assetRender.contentType.includes('html')) {
						if (!props.preview && props.autoLoad) {
							return (
								<S.Frame
									src={assetRender.url}
									ref={iframeRef}
									allowFullScreen
									onError={handleError}
									onLoad={() => {
										setFrameLoaded(true);
										if (iframeRef.current) {
											sendFrameData();
										}
									}}
								/>
							);
						} else {
							return (
								<S.Preview>
									<ReactSVG src={ASSETS.html} />
								</S.Preview>
							);
						}
					}
					if (assetRender.contentType.includes('image')) {
						return <S.Image src={assetRender.url} contain={contain} onError={handleError} loading={'lazy'} />;
					}
					if (assetRender.contentType.includes('audio')) {
						if (!props.preview) {
							return (
								<S.AudioWrapper>
									<ReactSVG src={ASSETS.audio} />
									<S.Audio controls onError={handleError}>
										<source src={assetRender.url} type={assetRender.contentType} />
									</S.Audio>
								</S.AudioWrapper>
							);
						} else {
							return (
								<S.Preview>
									<ReactSVG src={ASSETS.audio} />
								</S.Preview>
							);
						}
					}
					if (assetRender.contentType.includes('video')) {
						if (!props.preview && props.autoLoad) {
							return (
								<S.Video controls onError={handleError}>
									<source src={assetRender.url} type={assetRender.contentType} />
								</S.Video>
							);
						} else {
							return (
								<S.Preview>
									<ReactSVG src={ASSETS.video} />
								</S.Preview>
							);
						}
					} else {
						return getUnsupportedWrapper();
					}
				default:
					return getUnsupportedWrapper();
			}
		} else {
			return <S.LoaderWrapper className={'border-wrapper-alt1'} />;
		}
	}

	return <S.Wrapper ref={wrapperRef}>{getData()}</S.Wrapper>;
}
