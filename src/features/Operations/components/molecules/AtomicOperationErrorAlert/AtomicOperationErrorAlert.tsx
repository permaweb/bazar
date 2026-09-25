import { OperationErrorAlert } from 'components/molecules/OperationOutcomeAnnouncement';
import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES } from '../../../messages';

export default function AtomicOperationErrorAlert(props: { message: string }) {
	const messages = useMessages(OPERATIONS_MESSAGES);
	return <OperationErrorAlert title={messages.failureAlertTitle} message={props.message} />;
}
