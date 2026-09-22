import React from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { StatusNotice } from 'components/molecules/StatusNotice';

// Shown when saved signed work exists but local observation was paused by the user.
export default function PausedRecoveryNotice(props: {
	onResume: () => void;
	resumeButtonRef?: React.Ref<HTMLButtonElement>;
}) {
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
					<Icon icon={RefreshCw} size="sm" /> Resume pending action
				</Button>
			}
		>
			Local tracking is paused. Resume here to continue observing signed work or review any wallet approvals still
			required.
		</StatusNotice>
	);
}
