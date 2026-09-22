export default function InteractiveHtmlArtwork(props: { name: string; src: string }) {
	return (
		<iframe
			allow="fullscreen"
			allowFullScreen
			className="asset-interactive-frame"
			loading="eager"
			referrerPolicy="no-referrer"
			sandbox="allow-scripts allow-pointer-lock"
			src={props.src}
			title={`${props.name} interactive artwork`}
		/>
	);
}
