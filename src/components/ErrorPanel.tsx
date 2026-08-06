import { RefreshCw } from 'lucide-react';

export function ErrorPanel({
	message,
	onRetry,
	retryLabel = 'Retry',
}: {
	message: string;
	onRetry?: () => void;
	retryLabel?: string;
}) {
	return (
		<div className="error-panel">
			<strong>Unable to load</strong>
			<span aria-label={`Unable to load. ${message}`} role="alert">
				{message}
			</span>
			{onRetry ? (
				<button
					className="with-icon error-panel-retry"
					onClick={() => {
						onRetry();
						document.getElementById('main-content')?.focus({ preventScroll: true });
					}}
					type="button"
				>
					<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> {retryLabel}
				</button>
			) : null}
		</div>
	);
}
