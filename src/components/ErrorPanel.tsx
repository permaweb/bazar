import { ArrowRight, RefreshCw } from 'lucide-react';

import { ArCurrencyText, formatArCurrencyText } from './ArCurrencyLabel';
import { Button } from './Button';

export type ErrorPanelAction = {
	label: string;
	onClick(): void;
};

export function ErrorPanel({
	message,
	onRetry,
	secondaryAction,
}: {
	message: string;
	onRetry?: () => void;
	secondaryAction?: ErrorPanelAction;
}) {
	const heading = 'Unable to load';
	return (
		<div className={`error-panel${onRetry ? ' retry-notice' : ''}`}>
			<strong>{heading}</strong>
			<span aria-label={formatArCurrencyText(`${heading}. ${message}`)} role={onRetry ? 'status' : 'alert'}>
				<ArCurrencyText>{message}</ArCurrencyText>
			</span>
			{onRetry || secondaryAction ? (
				<div className="error-panel-actions">
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
					{secondaryAction ? (
						<Button className="with-icon error-panel-action" onClick={secondaryAction.onClick}>
							{secondaryAction.label} <ArrowRight className="ui-icon ui-icon--sm" aria-hidden="true" />
						</Button>
					) : null}
				</div>
			) : null}
		</div>
	);
}
