import React from 'react';

// Content available to assistive technology but not rendered visually.
export default function VisuallyHidden(props: {
	children: React.ReactNode;
	as?: 'span' | 'p' | 'h1' | 'h2' | 'div';
	id?: string;
}) {
	const Element = props.as ?? 'span';
	return (
		<Element className="sr-only" id={props.id}>
			{props.children}
		</Element>
	);
}
