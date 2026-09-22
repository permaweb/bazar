import React from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';

export const COMPUTE_RETRY_MESSAGE = 'Compute hasn’t completed yet. Please try again.';

// Inline notice for a recoverable read failure with a retry action. The message is announced
// politely; the retry control stays outside the live region.
export const RetryNotice = React.forwardRef<
	HTMLDivElement,
	{
		children?: React.ReactNode;
		onRetry: () => void;
		retryLabel?: string;
		retrying?: boolean;
		retryDescribedBy?: string;
		tabIndex?: number;
	}
>(function RetryNotice(props, ref) {
	return (
		<div className="inline-error retry-notice" ref={ref} tabIndex={props.tabIndex}>
			<span role="status">{props.children ?? COMPUTE_RETRY_MESSAGE}</span>
			<Button
				aria-describedby={props.retryDescribedBy}
				className="with-icon"
				disabled={props.retrying}
				onClick={props.onRetry}
				size="custom"
				type="button"
			>
				<Icon icon={RefreshCw} size="sm" /> {props.retryLabel ?? 'Retry'}
			</Button>
		</div>
	);
});

export default RetryNotice;
