import React from 'react';
import { ReactSVG } from 'react-svg';

import { ASSETS } from 'helpers/config';

import * as S from './styles';

interface IProps {
	onClick: (e: React.MouseEvent) => void;
	isPlaying?: boolean;
	size?: 'default' | 'small';
}

export default function PlayButton(props: IProps) {
	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		props.onClick(e);
	};

	return (
		<S.Wrapper onClick={handleClick} data-play-button className={props.size === 'small' ? 'list-view' : ''}>
			<S.PlayIcon>
				<ReactSVG src={props.isPlaying ? ASSETS.pause : ASSETS.play} />
			</S.PlayIcon>
		</S.Wrapper>
	);
}
