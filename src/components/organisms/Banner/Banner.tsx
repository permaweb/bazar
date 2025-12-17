import React from 'react';
import { CurrentZoneVersion } from '@permaweb/libs';

import { Notification } from 'components/atoms/Notification';
import { NotificationType } from 'helpers/types';
import { isVersionGreater } from 'helpers/utils';
import { usePermawebProvider } from 'providers/PermawebProvider';

import * as S from './styles';

export default function Banner() {
	const permawebProvider = usePermawebProvider();

	// const [showInfo, setShowInfo] = React.useState<boolean>(false);
	const [_showUpdate, setShowUpdate] = React.useState<boolean>(false);

	// const [showVouch, setShowVouch] = React.useState<boolean>(false);
	// const [showVouchAlert, setShowVouchAlert] = React.useState<boolean>(false);

	// const [legacyProfile, setLegacyProfile] = React.useState<any>(null);
	// const [showLegacyAssetMigration, setShowLegacyAssetMigration] = React.useState<boolean>(false);

	const [loading, setLoading] = React.useState<boolean>(false);
	const [updateApplied, setUpdateApplied] = React.useState<boolean>(true);
	const [response, setResponse] = React.useState<NotificationType | null>(null);

	const hasCheckedProfileRef = React.useRef(false);

	React.useEffect(() => {
		(async function () {
			if (hasCheckedProfileRef.current) return;
			if (
				permawebProvider.profile &&
				typeof permawebProvider.profile.id === 'string' &&
				permawebProvider.profile.id.length === 43
			) {
				const userVersion = permawebProvider.profile.version;
				if (!userVersion || isVersionGreater(CurrentZoneVersion, userVersion)) {
					setUpdateApplied(false);
					hasCheckedProfileRef.current = true;
				}
			}
		})();
	}, [permawebProvider.profile?.id]);

	async function handleUpdate() {
		setLoading(true);
		try {
			await permawebProvider.libs.updateProfileVersion({
				profileId: permawebProvider.profile.id,
			});
			setResponse({ status: 'success', message: 'Profile Updated!' });
			setUpdateApplied(true);
		} catch (e: any) {
			console.error(e);
			setResponse({ status: 'warning', message: e.message ?? 'Error Updating Profile' });
		}
		setLoading(false);
	}

	return (
		<>
			{!updateApplied && (
				<S.Wrapper>
					{!updateApplied && (
						<button onClick={handleUpdate} disabled={loading}>
							{loading ? 'Loading...' : 'Update your profile'}
						</button>
					)}
				</S.Wrapper>
			)}
			{response && (
				<Notification
					message={response.message}
					type={response.status}
					callback={() => {
						setResponse(null);
						setShowUpdate(false);
					}}
				/>
			)}
		</>
	);
}
