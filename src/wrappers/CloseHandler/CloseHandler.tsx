import React from 'react';

import { RefType } from 'helpers/types';

import * as S from './styles';
import { IProps } from './types';

function useCloseHandler(ref: RefType, callback: () => void) {
	React.useEffect(() => {
		function handleAction(event: React.MouseEvent<HTMLInputElement>, callback: () => void) {
			if ((ref as RefType).current && !(ref as RefType).current.contains(event.target as any)) {
				callback();
			}
		}
		document.addEventListener('mousedown', (e) => handleAction(e as any, callback));
		return () => {
			document.removeEventListener('mousedown', (e) => handleAction(e as any, callback));
		};
	}, [ref, callback]);
}

export default function CloseHandler(props: IProps) {
	const wrapperRef = React.useRef<any>(null);
	useCloseHandler(wrapperRef, props.callback);

	const [active, setActive] = React.useState<boolean>(false);

	React.useEffect(() => {
		setActive(props.active && !props.disabled);
	}, [props.active, props.disabled]);

	if (active) {
		return <S.Wrapper ref={wrapperRef}>{props.children}</S.Wrapper>;
	} else {
		return <S.Wrapper>{props.children}</S.Wrapper>;
	}
}
