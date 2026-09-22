import React from 'react';

import {
	profileAvatarUrl,
	ProfileClient,
	profileDisplayName,
	type ProfileUpdate,
	readAccountProfile,
} from 'api/profile';

import { MyAssets } from 'features/MyAssets';
import { isArweaveId } from 'helpers/arweave-id';
import { useWallet } from 'providers/WalletProvider';
import type { ProfileSummary } from 'types/profile';

import { ProfileEditDialog } from '../ProfileEditDialog';
import { ProfileEditUpdate, ProfilePage } from '../ProfilePage';

export default function AccountProfile(props: { address: string }) {
	const wallet = useWallet();
	const [retry, setRetry] = React.useState(0);
	const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof readAccountProfile>>>();
	const [error, setError] = React.useState('');
	const [editOpen, setEditOpen] = React.useState(false);
	const editTrigger = React.useRef<HTMLButtonElement | null>(null);

	React.useEffect(() => {
		setError('');
		setProfile(undefined);
		if (!isArweaveId(props.address)) {
			setError('This is not a valid Arweave profile address.');
			return;
		}
		const controller = new AbortController();
		void readAccountProfile(props.address, { signal: controller.signal }).then(
			(value) => {
				if (!controller.signal.aborted) setProfile(value);
			},
			() => {
				if (!controller.signal.aborted) setError('This profile could not be read from Arweave.');
			}
		);
		return () => controller.abort();
	}, [props.address, retry]);

	const summary: ProfileSummary = {
		address: props.address,
		...(profileDisplayName(profile) ? { displayName: profileDisplayName(profile) } : {}),
		...(profile?.bio ? { bio: profile.bio } : {}),
		...(profileAvatarUrl(profile) ? { avatar: profileAvatarUrl(profile) } : {}),
	};
	const openEditor = (trigger: HTMLButtonElement) => {
		editTrigger.current = trigger;
		setEditOpen(true);
	};
	const saveProfile = async (update: ProfileEditUpdate, onStatus: (status: string) => void) => {
		const client = new ProfileClient();
		const fields: ProfileUpdate = update.displayNameChanged ? { displayName: update.displayName } : {};
		if (update.removeAvatar) fields.avatar = '';
		if (update.avatarFile) {
			const data = new Uint8Array(await update.avatarFile.arrayBuffer());
			fields.avatar = await client.uploadAvatar(props.address, data, update.avatarFile.type, {
				onPhase: (phase) => onStatus(phase === 'signing' ? 'Approve picture…' : 'Uploading picture…'),
			});
		}
		onStatus('Preparing profile…');
		const updated = await client.update(props.address, fields, {
			onPhase: (phase) => onStatus(phase === 'signing' ? 'Approve profile…' : 'Publishing profile…'),
		});
		setProfile(updated);
		setEditOpen(false);
	};
	return (
		<>
			<ProfilePage
				error={error}
				isLoading={isArweaveId(props.address) && profile === undefined && !error}
				onEdit={wallet.address === props.address ? openEditor : undefined}
				onRetry={() => setRetry((value) => value + 1)}
				profile={summary}
			>
				{isArweaveId(props.address) ? <MyAssets address={props.address} embedded /> : null}
			</ProfilePage>
			<ProfileEditDialog
				onClose={() => setEditOpen(false)}
				onSave={saveProfile}
				open={editOpen}
				profile={summary}
				restoreTarget={() => editTrigger.current}
			/>
		</>
	);
}
