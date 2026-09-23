import React from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';

// Inline notice for a recoverable read failure with a retry action. The message is announced
// politely; the retry control stays outside the live region.
export const RetryNotice = React.forwardRef<
	HTMLDivElement,
	{
		children: React.ReactNode;
		onRetry: () => void;
		retryLabel: string;
		retrying?: boolean;
		retryDescribedBy?: string;
		tabIndex?: number;
	}
>(function RetryNotice(props, ref) {
	return (
		<div className="inline-error retry-notice" ref={ref} tabIndex={props.tabIndex}>
			<span role="status">{props.children}</span>
			<Button
				aria-describedby={props.retryDescribedBy}
				className="with-icon"
				disabled={props.retrying}
				onClick={props.onRetry}
				size="custom"
				type="button"
			>
				<Icon icon={RefreshCw} size="sm" /> {props.retryLabel}
			</Button>
		</div>
	);
});

export default RetryNotice;
