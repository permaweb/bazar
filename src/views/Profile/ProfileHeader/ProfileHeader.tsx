import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactSVG } from 'react-svg';

// import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import { Button } from 'components/atoms/Button';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { Streaks } from 'components/organisms/Streaks';
import { ASSETS, DEFAULTS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { checkValidAddress, formatAddress } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

// TODO: bio
export default function ProfileHeader(props: IProps) {
	const navigate = useNavigate();

	const arProvider = useArweaveProvider();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);
	// const [profileUpdating, setProfileUpdating] = React.useState<boolean>(false);
	// const [copied, setCopied] = React.useState<boolean>(false);

	React.useEffect(() => {
		(async function () {
			await new Promise((r) => setTimeout(r, 100));
			if (props.profile && !props.profile.id) setShowProfileManage(true);
		})();
	}, [props.profile]);

	// const copyAddress = React.useCallback(async () => {
	// 	if (props.profile && props.profile.walletAddress) {
	// 		if (props.profile.walletAddress.length > 0) {
	// 			await navigator.clipboard.writeText(props.profile.walletAddress);
	// 			setCopied(true);
	// 			setTimeout(() => setCopied(false), 2000);
	// 		}
	// 	}
	// }, [props.profile]);

	function getAvatar() {
		if (props.profile && props.profile.avatar) return <img src={getTxEndpoint(props.profile.avatar)} />;
		return <ReactSVG src={ASSETS.user} />;
	}

	function getHandle() {
		return props.profile.username ? `@${props.profile.username}` : formatAddress(props.profile.walletAddress, false);
	}

	// async function handleProfileSrcUpdate() {
	// 	if (arProvider.profile && arProvider.profile.id) {
	// 		setProfileUpdating(true);
	// 		const aos = connect();

	// 		let processSrc = null;
	// 		try {
	// 			const processSrcFetch = await fetch(getTxEndpoint(AOS.profileSrc));
	// 			if (processSrcFetch.ok) {
	// 				processSrc = await processSrcFetch.text();

	// 				console.log('Sending source eval...');
	// 				const evalMessage = await aos.message({
	// 					process: arProvider.profile.id,
	// 					signer: createDataItemSigner(arProvider.wallet),
	// 					tags: [{ name: 'Action', value: 'Eval' }],
	// 					data: processSrc,
	// 				});

	// 				console.log(evalMessage);

	// 				const evalResult = await aos.result({
	// 					message: evalMessage,
	// 					process: arProvider.profile.id,
	// 				});

	// 				console.log(evalResult);
	// 			}
	// 		} catch (e: any) {
	// 			console.error(e);
	// 		}
	// 		setProfileUpdating(false);
	// 	}
	// }

	function getHeaderDetails() {
		return props.profile ? (
			<S.HeaderHA>
				<h4>
					{props.profile.displayName ? props.profile.displayName : formatAddress(props.profile.walletAddress, false)}
				</h4>
				<S.HeaderInfoDetail>
					<span>{`${getHandle()}`}</span>
				</S.HeaderInfoDetail>
				{/* <S.HeaderAddress onClick={copyAddress}>
					<ReactSVG src={ASSETS.wallet} />
					<p>{formatAddress(props.profile.walletAddress, false)}</p>
					{copied && <span>{`${language.copied}!`}</span>}
				</S.HeaderAddress> */}
			</S.HeaderHA>
		) : null;
	}

	return props.profile ? (
		<>
			<S.Wrapper
				backgroundImage={getTxEndpoint(
					props.profile.banner && checkValidAddress(props.profile.banner) ? props.profile.banner : DEFAULTS.banner
				)}
				className={'border-wrapper-alt2 fade-in'}
			>
				<S.HeaderInfo>
					<S.HeaderAvatar>{getAvatar()}</S.HeaderAvatar>
					{getHeaderDetails()}
					<S.HeaderActions>
						<S.Action>
							<Streaks profile={props.profile} />
						</S.Action>
						{/* {arProvider.profile && arProvider.profile.id && arProvider.profile.id === props.profile.id && (
							<S.Action>
								<Button
									type={'primary'}
									label={'Update profile'}
									handlePress={handleProfileSrcUpdate}
									disabled={profileUpdating}
									loading={profileUpdating}
								/>
							</S.Action>
						)} */}
						{arProvider.profile && arProvider.profile.id === props.profile.id && (
							<S.Action>
								<Button
									type={'alt1'}
									label={language.editProfile}
									handlePress={() => setShowProfileManage(true)}
									className={'fade-in'}
								/>
							</S.Action>
						)}
					</S.HeaderActions>
				</S.HeaderInfo>
			</S.Wrapper>
			{showProfileManage && arProvider.profile && arProvider.profile.id === props.profile.id && (
				<Panel
					open={showProfileManage}
					header={props.profile.id ? language.editProfile : `${language.createProfile}!`}
					handleClose={props.profile.id ? () => setShowProfileManage(false) : () => navigate(URLS.base)}
				>
					<ProfileManage
						profile={props.profile}
						handleClose={props.profile.id ? () => setShowProfileManage(false) : null}
						handleUpdate={() => props.handleUpdate()}
					/>
				</Panel>
			)}
		</>
	) : null;
}
