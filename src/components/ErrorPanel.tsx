import { RefreshCw } from 'lucide-react';

import { ArCurrencyText, formatArCurrencyText } from './ArCurrencyLabel';
import { Button } from './Button';

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
			<span aria-label={formatArCurrencyText(`Unable to load. ${message}`)} role="alert">
				<ArCurrencyText>{message}</ArCurrencyText>
			</span>
			{onRetry ? (
				<Button
					className="with-icon error-panel-retry"
					onClick={() => {
						onRetry();
						document.getElementById('main-content')?.focus({ preventScroll: true });
					}}
				>
					<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> {retryLabel}
				</Button>
			) : null}
		</div>
	);
}
