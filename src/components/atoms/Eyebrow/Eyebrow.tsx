import React from 'react';

import * as S from './styles';

// Short category label placed above a heading.
export default function Eyebrow(props: { children: React.ReactNode; id?: string; className?: string }) {
	return (
		<S.Kicker className={props.className ? `eyebrow ${props.className}` : 'eyebrow'} id={props.id}>
			{props.children}
		</S.Kicker>
	);
}
