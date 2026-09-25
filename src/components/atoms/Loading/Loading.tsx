import * as S from './styles';

export default function Loading(props: { label: string }) {
	return (
		<S.Indicator aria-live="polite" className="loading" role="status">
			<span aria-hidden="true" />
			{props.label}
		</S.Indicator>
	);
}
