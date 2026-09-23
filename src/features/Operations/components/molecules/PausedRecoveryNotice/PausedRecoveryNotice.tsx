import React from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { StatusNotice } from 'components/molecules/StatusNotice';
import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES } from '../../../messages';

// Shown when saved signed work exists but local observation was paused by the user.
export default function PausedRecoveryNotice(props: {
	onResume: () => void;
	resumeButtonRef?: React.Ref<HTMLButtonElement>;
}) {
	const messages = useMessages(OPERATIONS_MESSAGES);
	return (
		<StatusNotice
			actions={
				<Button
					ref={props.resumeButtonRef}
					className="with-icon"
					size="custom"
					type="button"
					onClick={props.onResume}
				>
					<Icon icon={RefreshCw} size="sm" /> {messages.pausedRecoveryResume}
				</Button>
			}
		>
			{messages.pausedRecoveryDetail}
		</StatusNotice>
	);
}
