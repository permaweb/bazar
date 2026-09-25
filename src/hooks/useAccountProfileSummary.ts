import React from 'react';

import { profileAvatarUrl, profileDisplayName, readAccountProfile } from 'api/profile';

import { isArweaveId } from 'helpers/arweave-id';
import type { ProfileSummary } from 'types/profile';

export function useAccountProfileSummary(address: string): ProfileSummary {
	const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof readAccountProfile>>>();
	React.useEffect(() => {
		if (!isArweaveId(address)) {
			setProfile(undefined);
			return;
		}
		const controller = new AbortController();
		void readAccountProfile(address, { signal: controller.signal }).then(
			(value) => {
				if (!controller.signal.aborted) setProfile(value);
			},
			() => undefined
		);
		return () => controller.abort();
	}, [address]);
	return {
		address,
		...(profileDisplayName(profile) ? { displayName: profileDisplayName(profile) } : {}),
		...(profileAvatarUrl(profile) ? { avatar: profileAvatarUrl(profile) } : {}),
	};
}
