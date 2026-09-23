import React from 'react';

import { MyAssets } from 'features/MyAssets';
import { isArweaveId } from 'helpers/arweave-id';
import { useMessages } from 'providers/LanguageProvider';
import { useWallet } from 'providers/WalletProvider';

import { useAccountProfile } from '../../../hooks/useAccountProfile';
import { PROFILE_MESSAGES } from '../../../messages';
import { accountProfileNotice, type ProfileEditUpdate } from '../../../model/profile';
import { ProfileEditDialog } from '../ProfileEditDialog';
import { ProfilePage } from '../ProfilePage';

export default function AccountProfile(props: { address: string }) {
	const messages = useMessages(PROFILE_MESSAGES);
	const wallet = useWallet();
	const account = useAccountProfile(props.address);
	const editTrigger = React.useRef<HTMLButtonElement | null>(null);
	const [editOpen, setEditOpen] = React.useState(false);
	const notice = accountProfileNotice(props.address, account.profile, messages);

	const handleEdit = (trigger: HTMLButtonElement) => {
		editTrigger.current = trigger;
		setEditOpen(true);
	};
	const handleSave = async (update: ProfileEditUpdate, onStatus: (status: string) => void) => {
		await account.save(update, onStatus);
		setEditOpen(false);
	};

	return (
		<>
			<ProfilePage
				error={notice.error}
				isLoading={notice.isLoading}
				onEdit={wallet.address === props.address ? handleEdit : undefined}
				onRetry={account.retry}
				profile={account.summary}
			>
				{isArweaveId(props.address) ? <MyAssets address={props.address} embedded /> : null}
			</ProfilePage>
			<ProfileEditDialog
				onClose={() => setEditOpen(false)}
				onSave={handleSave}
				open={editOpen}
				profile={account.summary}
				restoreTarget={() => editTrigger.current}
			/>
		</>
	);
}
