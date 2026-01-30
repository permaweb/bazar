import { Link, useNavigate } from 'react-router-dom';

import { Avatar } from 'components/atoms/Avatar';
import { REDIRECTS, URLS } from 'helpers/config';
import { formatAddress } from 'helpers/utils';

import * as S from './styles';
import { IProps } from './types';

export default function OwnerLine(props: IProps) {
	const navigate = useNavigate();

	function handleViewProfile() {
		if (props.owner && props.owner.profile && props.owner.profile.id) {
			navigate(URLS.profileAssets(props.owner.profile.id));
		} else {
			window.open(REDIRECTS.explorer(props.owner.address));
		}

		if (props.callback) props.callback();
	}

	function getLabel() {
		if (props.owner) {
			if (props.owner.profile && props.owner.profile.username) return `${props.owner.profile.username}`;
			if (props.owner.address) return `${formatAddress(props.owner.address, false)}`;
		} else return null;
	}

	return props.owner ? (
		<S.Wrapper>
			<Avatar owner={props.owner.profile} dimensions={{ wrapper: 23.5, icon: 15 }} callback={handleViewProfile} />
			<S.Label>
				<Link
					onClick={() => (props.callback ? props.callback() : {})}
					target={'_blank'}
					to={
						props.owner.profile && props.owner.profile.id
							? URLS.profileAssets(props.owner.profile.id)
							: REDIRECTS.explorer(props.owner.address)
					}
				>
					{getLabel()}
				</Link>
			</S.Label>
		</S.Wrapper>
	) : null;
}
