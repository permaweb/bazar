import React from 'react';
import { ReactSVG } from 'react-svg';

import { ASSETS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { formatAddress } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

export default function ProfileHeader(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [copied, setCopied] = React.useState<boolean>(false);

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
		return props.profile.handle ? `@${props.profile.handle}` : formatAddress(props.profile.walletAddress, false);
	}

	function getHeaderDetails() {
		return (
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
		);
	}

	function getProfile() {
		if (props.profile) {
			return (
				<S.Wrapper>
					<S.HeaderInfo>
						<S.HeaderAvatar>{getAvatar()}</S.HeaderAvatar>
						{getHeaderDetails()}
					</S.HeaderInfo>
				</S.Wrapper>
			);
		} else {
			return null;
		}
	}

	return <>{getProfile()}</>;
}
