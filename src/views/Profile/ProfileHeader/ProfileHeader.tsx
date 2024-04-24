import React from 'react';
import { ReactSVG } from 'react-svg';

import { Button } from 'components/atoms/Button';
import { Modal } from 'components/molecules/Modal';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { ASSETS, DEFAULTS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { checkValidAddress, formatAddress } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

// TODO: handle close / reload on manage
export default function ProfileHeader(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [showManage, setShowManage] = React.useState<boolean>(false);
	const [copied, setCopied] = React.useState<boolean>(false);

	React.useEffect(() => {
		if (props.profile && !props.profile.id) setShowManage(true);
	}, [props.profile]);

	const copyAddress = React.useCallback(async () => {
		if (props.profile && props.profile.walletAddress) {
			if (props.profile.walletAddress.length > 0) {
				await navigator.clipboard.writeText(props.profile.walletAddress);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}
		}
	}, [props.profile]);

	function getAvatar() {
		if (props.profile && props.profile.avatar) return <img src={getTxEndpoint(props.profile.avatar)} />;
		return <ReactSVG src={ASSETS.user} />;
	}

	function getHandle() {
		return props.profile.username ? `@${props.profile.username}` : formatAddress(props.profile.walletAddress, false);
	}

	function getHeaderDetails() {
		return props.profile && props.profile.id ? (
			<S.HeaderHA>
				<h4>
					{props.profile.displayName ? props.profile.displayName : formatAddress(props.profile.walletAddress, false)}
				</h4>
				<S.HeaderInfoDetail>
					<span>{`${getHandle()}`}</span>
				</S.HeaderInfoDetail>
				<S.HeaderAddress onClick={copyAddress}>
					<ReactSVG src={ASSETS.wallet} />
					<p>{formatAddress(props.profile.walletAddress, false)}</p>
					{copied && <span>{`${language.copied}!`}</span>}
				</S.HeaderAddress>
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
						<Button type={'primary'} label={language.editProfile} handlePress={() => setShowManage(true)} />
					</S.HeaderActions>
				</S.HeaderInfo>
			</S.Wrapper>
			{showManage && (
				<Modal
					header={props.profile.id ? language.editProfile : language.createProfile}
					handleClose={props.profile.id ? () => setShowManage(false) : null}
				>
					<S.MWrapper className={'modal-wrapper'}>
						<ProfileManage profile={props.profile} handleClose={null} />
					</S.MWrapper>
				</Modal>
			)}
		</>
	) : null;
}
