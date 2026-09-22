import { OperationErrorAlert } from 'components/molecules/OperationOutcomeAnnouncement';

export default function FungibleOperationErrorAlert(props: { message: string }) {
	return <OperationErrorAlert title="Could not complete this action" message={props.message} />;
}
