import React from 'react';

// Visually hidden polite live region for announcing asynchronous status changes.
export default function LiveRegion(props: {
	children: React.ReactNode;
	as?: 'span' | 'p' | 'div';
	id?: string;
	atomic?: boolean;
}) {
	const Element = props.as ?? 'span';
	return (
		<Element
			aria-atomic={props.atomic ? 'true' : undefined}
			aria-live="polite"
			className="sr-only"
			id={props.id}
			role="status"
		>
			{props.children}
		</Element>
	);
}
