import React from 'react';
import { ReactSVG } from 'react-svg';

import { ASSETS } from 'helpers/config';
import { getRendererEndpoint, getTxEndpoint } from 'helpers/endpoints';
import { AssetRenderType } from 'helpers/types';
import { checkValidAddress } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';

import * as S from './styles';
import { IProps } from './types';

export default function AssetData(props: IProps) {
	const arProvider = useArweaveProvider();

	const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
	const wrapperRef = React.useRef<any>(null);

	const [wrapperVisible, setWrapperVisible] = React.useState<boolean>(false);
	const [frameLoaded, setFrameLoaded] = React.useState<boolean>(false);

	const [assetRender, setAssetRender] = React.useState<AssetRenderType | null>(null);

	const [loadError, setLoadError] = React.useState<boolean>(false);
	const [contain, setContain] = React.useState<boolean>(true);

	const checkVisibility = () => {
		const element = wrapperRef.current;
		if (!element) return;

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
	}, [props.asset]);

	function getAssetPath(assetResponse: any) {
		if (props.asset) {
			return assetResponse.url;
		} else return '';
	}

	React.useEffect(() => {
		(async function () {
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
						const assetResponse = await fetch(getTxEndpoint(props.asset.data.id));
						const contentType = assetResponse.headers.get('content-type');

						if (assetResponse.status === 200 && contentType) {
							setAssetRender({
								url: getAssetPath(assetResponse),
								type: 'raw',
								contentType: contentType,
							});
						}
					}
				}
			}
		})();
	}, [props.asset, props.assetRender]);

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
		function sendWalletConnection() {
			if (iframeRef && iframeRef.current) {
				iframeRef.current.contentWindow.postMessage(
					{
						type: 'setHeight',
						height: `${props.frameMinHeight}px`,
						walletConnection: arProvider.walletAddress ? 'connected' : 'none',
					},
					'*'
				);
			}
		}

		sendWalletConnection();
	}, [arProvider.walletAddress]);

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
									if (iframeRef.current && iframeRef.current.contentWindow && props.frameMinHeight) {
										iframeRef.current.contentWindow.postMessage(
											{
												type: 'setHeight',
												height: `${props.frameMinHeight}px`,
												walletConnection: arProvider.walletAddress ? 'connected' : 'none',
											},
											'*'
										);
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
					if (assetRender.contentType.includes('html')) {
						if (!props.preview && props.autoLoad)
							return <S.Frame src={assetRender.url} ref={iframeRef} allowFullScreen onError={handleError} />;
						else {
							return (
								<S.Preview>
									<ReactSVG src={ASSETS.html} />
								</S.Preview>
							);
						}
					}
					if (assetRender.contentType.includes('image')) {
						return <S.Image src={assetRender.url} contain={contain} onError={handleError} />;
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
		} else return null;
	}

	return <S.Wrapper ref={wrapperRef}>{getData()}</S.Wrapper>;
}
