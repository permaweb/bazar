import React from 'react';

// Short category label placed above a heading.
export default function Eyebrow(props: { children: React.ReactNode; id?: string; className?: string }) {
	return (
		<p className={props.className ? `eyebrow ${props.className}` : 'eyebrow'} id={props.id}>
			{props.children}
		</p>
	);
}
