import * as S from './styles';

export default function InteractiveHtmlArtwork(props: { src: string; title: string }) {
	return (
		<S.Frame
			allow="fullscreen"
			allowFullScreen
			className="asset-interactive-frame"
			loading="eager"
			referrerPolicy="no-referrer"
			sandbox="allow-scripts allow-pointer-lock"
			src={props.src}
			title={props.title}
		/>
	);
}
