import { RefreshCw } from 'lucide-react';

import { ArCurrencyText, formatArCurrencyText } from './ArCurrencyLabel';
import { Button } from './Button';

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
	const retryMessage = onRetry ? 'Please try again.' : message;
	const heading = onRetry ? 'Compute hasn’t completed yet' : 'Unable to load';
	return (
		<div className={`error-panel${onRetry ? ' retry-notice' : ''}`}>
			<strong>{heading}</strong>
			<span aria-label={formatArCurrencyText(`${heading}. ${retryMessage}`)} role={onRetry ? 'status' : 'alert'}>
				<ArCurrencyText>{retryMessage}</ArCurrencyText>
			</span>
			{onRetry ? (
				<Button
					className="with-icon error-panel-retry"
					onClick={() => {
						onRetry();
						document.getElementById('main-content')?.focus({ preventScroll: true });
					}}
				>
					<RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Retry
				</Button>
			) : null}
		</div>
	);
}
