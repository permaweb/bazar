import React from 'react';

import * as S from './styles';

// Explains why a list or panel has nothing to show and, optionally, what to do next.
export default function EmptyState(props: {
	title: React.ReactNode;
	children?: React.ReactNode;
	action?: React.ReactNode;
}) {
	return (
		<S.Panel className="empty-state">
			<h3>{props.title}</h3>
			{props.children ? <p>{props.children}</p> : null}
			{props.action}
		</S.Panel>
	);
}
