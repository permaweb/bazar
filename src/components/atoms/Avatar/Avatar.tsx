import React from 'react';
import { ReactSVG } from 'react-svg';

import { ASSETS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { checkValidAddress } from 'helpers/utils';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';

import * as S from './styles';
import { IProps } from './types';

export default function Avatar(props: IProps) {
	const arProvider = useArweaveProvider();
	const permawebProvider = usePermawebProvider();
	const [hasError, setHasError] = React.useState(false);

	// Check if this is the current user's avatar and if we have an ArNS avatar URL
	// We only use ArNS logos for the current user to avoid fetching ArNS data for every user
	const isCurrentUser =
		props.owner &&
		permawebProvider.profile &&
		(props.owner.id === permawebProvider.profile.id ||
			('walletAddress' in props.owner && props.owner.walletAddress === arProvider.walletAddress));

	// Determine image source: ArNS logo (for current user) > profile thumbnail > default
	const imageUrl = React.useMemo(() => {
		console.log('Avatar Debug - isCurrentUser:', isCurrentUser);
		console.log('Avatar Debug - arnsAvatarUrl:', permawebProvider.arnsAvatarUrl);
		console.log('Avatar Debug - hasError:', hasError);
		console.log('Avatar Debug - owner:', props.owner);

		if (isCurrentUser && permawebProvider.arnsAvatarUrl && !hasError) {
			console.log('Avatar Debug - Using ArNS avatar:', permawebProvider.arnsAvatarUrl);
			return permawebProvider.arnsAvatarUrl;
		} else if (props.owner && props.owner.thumbnail && checkValidAddress(props.owner.thumbnail)) {
			const thumbnailUrl = getTxEndpoint(props.owner.thumbnail);
			console.log('Avatar Debug - Using profile thumbnail:', thumbnailUrl);
			return thumbnailUrl;
		}
		console.log('Avatar Debug - Using default avatar');
		return null;
	}, [isCurrentUser, permawebProvider.arnsAvatarUrl, props.owner, hasError]);

	const hasImage = imageUrl !== null;

	const avatar = React.useMemo(() => {
		if (!hasError && imageUrl) {
			return <img src={imageUrl} onError={() => setHasError(true)} />;
		} else return <ReactSVG src={ASSETS.user} />;
	}, [imageUrl, hasError]);

	return (
		<S.Wrapper
			onClick={props.callback ? props.callback : () => {}}
			dimensions={props.dimensions}
			hasCallback={props.callback !== null}
			hasOwner={props.owner !== null}
			className={'fade-in'}
			hasImage={hasImage}
		>
			{avatar}
		</S.Wrapper>
	);
}
