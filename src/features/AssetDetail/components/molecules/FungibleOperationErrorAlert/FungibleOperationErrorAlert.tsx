import { OperationErrorAlert } from 'components/molecules/OperationOutcomeAnnouncement';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';

export default function FungibleOperationErrorAlert(props: { message: string }) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	return <OperationErrorAlert title={messages.operationErrorTitle} message={props.message} />;
}
