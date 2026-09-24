import { RefreshCw } from 'lucide-react';

import type { Collection } from 'api/collections';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';
import { useMessages } from 'providers/LanguageProvider';

import { COLLECTION_MESSAGES } from '../../../messages';

import * as S from './styles';

export default function CollectionIndexNotice(props: {
	collection: Collection;
	checking: boolean;
	directlyVerified?: boolean;
	onRetry(): void;
}) {
	const language = useMessages(COLLECTION_MESSAGES);
	if (props.collection.indexSource !== 'compiled-fallback') return null;
	const message = props.checking ? language.indexNoticeChecking : language.computeIncompleteNotice;
	const compactMessage = props.checking ? language.indexNoticeCheckingCompact : language.computeIncompleteNotice;
	return (
		<S.Notice className="collection-source-notice collection-index-notice retry-notice">
			<span role="status">
				<S.FullText aria-hidden="true" className="collection-index-message-full">
					{message}
				</S.FullText>
				<S.CompactText aria-hidden="true" className="collection-index-message-compact">
					{compactMessage}
				</S.CompactText>
				<VisuallyHidden>{message}</VisuallyHidden>
			</span>
			<Button
				aria-disabled={props.checking}
				aria-label={language.retry}
				className="with-icon"
				size="custom"
				type="button"
				onClick={() => {
					if (!props.checking) props.onRetry();
				}}
			>
				<Icon icon={RefreshCw} size="sm" />
				<S.FullText aria-hidden="true" className="collection-index-action-full">
					{language.retry}
				</S.FullText>
				<S.CompactText aria-hidden="true" className="collection-index-action-compact">
					{language.retry}
				</S.CompactText>
			</Button>
		</S.Notice>
	);
}
