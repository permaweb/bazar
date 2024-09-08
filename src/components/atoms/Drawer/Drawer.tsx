import React from 'react';
import { ReactSVG } from 'react-svg';

import { ASSETS } from 'helpers/config';

import * as S from './styles';
import { IProps } from './types';

export default function Drawer(props: IProps) {
	const [open, setOpen] = React.useState<boolean>(true);

	return (
		<S.Wrapper className={'border-wrapper-alt2'}>
			<S.Action onClick={() => setOpen(!open)}>
				<S.Label>
					<S.Title>
						{props.icon && <ReactSVG src={props.icon} />}
						<span>{props.title}</span>
					</S.Title>
					<S.Arrow>
						<ReactSVG src={ASSETS.arrow} />
					</S.Arrow>
				</S.Label>
			</S.Action>
			{open && <S.Content>{props.content}</S.Content>}
		</S.Wrapper>
	);
}
