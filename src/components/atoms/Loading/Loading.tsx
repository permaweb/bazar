export default function Loading(props: { label: string }) {
	return (
		<div aria-live="polite" className="loading" role="status">
			<span aria-hidden="true" />
			{props.label}
		</div>
	);
}
