export function Loading({ label }: { label: string }) {
	return (
		<div aria-live="polite" className="loading" role="status">
			<span aria-hidden="true" />
			{label}
		</div>
	);
}
