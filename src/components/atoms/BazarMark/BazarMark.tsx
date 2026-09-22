import bazarLogo from 'assets/logo.svg';

export default function BazarMark(props: { className?: string }) {
	return (
		<img
			className={`bazar-mark${props.className ?? '' ? ` ${props.className ?? ''}` : ''}`}
			src={bazarLogo}
			alt=""
			aria-hidden="true"
		/>
	);
}
