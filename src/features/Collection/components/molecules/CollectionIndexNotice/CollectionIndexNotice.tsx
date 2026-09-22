import { RefreshCw } from 'lucide-react';

import type { Collection } from 'api/collections';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';

export default function CollectionIndexNotice(props: {
	collection: Collection;
	checking: boolean;
	directlyVerified?: boolean;
	onRetry(): void;
}) {
	if (props.collection.indexSource !== 'compiled-fallback') return null;
	const message = props.checking
		? 'Checking compute. This page remains available while the check finishes.'
		: 'Compute hasn’t completed yet. Please try again.';
	const compactMessage = props.checking ? 'Checking compute…' : 'Compute hasn’t completed yet. Please try again.';
	return (
		<div className="collection-source-notice collection-index-notice retry-notice">
			<span role="status">
				<span aria-hidden="true" className="collection-index-message-full">
					{message}
				</span>
				<span aria-hidden="true" className="collection-index-message-compact">
					{compactMessage}
				</span>
				<VisuallyHidden>{message}</VisuallyHidden>
			</span>
			<Button
				aria-disabled={props.checking}
				aria-label="Retry"
				className="with-icon"
				size="custom"
				type="button"
				onClick={() => {
					if (!props.checking) props.onRetry();
				}}
			>
				<Icon icon={RefreshCw} size="sm" />
				<span aria-hidden="true" className="collection-index-action-full">
					Retry
				</span>
				<span aria-hidden="true" className="collection-index-action-compact">
					Retry
				</span>
			</Button>
		</div>
	);
}
