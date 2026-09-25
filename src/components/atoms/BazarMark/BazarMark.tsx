import bazarLogo from 'assets/logo.svg';

import * as S from './styles';

export default function BazarMark(props: { className?: string }) {
	return (
		<S.Mark
			className={`bazar-mark${props.className ?? '' ? ` ${props.className ?? ''}` : ''}`}
			src={bazarLogo}
			alt=""
			aria-hidden="true"
		/>
	);
}
