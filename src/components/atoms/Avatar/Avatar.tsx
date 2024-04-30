import React from 'react';
import { ReactSVG } from 'react-svg';

import { ASSETS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { checkValidAddress } from 'helpers/utils';

import * as S from './styles';
import { IProps } from './types';

export default function Avatar(props: IProps) {
	const [hasError, setHasError] = React.useState(false);

	function getAvatar() {
		if (!hasError && props.owner && props.owner.avatar && checkValidAddress(props.owner.avatar)) {
			return <img src={getTxEndpoint(props.owner.avatar)} onError={() => setHasError(true)} />;
		} else return <ReactSVG src={ASSETS.user} />;
	}

	return (
		<S.Wrapper
			onClick={props.callback ? props.callback : () => {}}
			dimensions={props.dimensions}
			hasCallback={props.callback !== null}
			hasOwner={props.owner !== null}
		>
			{getAvatar()}
		</S.Wrapper>
	);
}
