import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Eyebrow } from '../../atoms/Eyebrow';
import { Icon } from '../../atoms/Icon';

export default function RouteState(props: {
	children: React.ReactNode;
	title: string;
	backTo?: string;
	backLabel: string;
	eyebrow: string;
}) {
	return (
		<section className="route-state-shell">
			<Link className="back" to={props.backTo ?? '/'}>
				<Icon icon={ArrowLeft} size="sm" /> {props.backLabel}
			</Link>
			<Eyebrow>{props.eyebrow}</Eyebrow>
			<h1>{props.title}</h1>
			{props.children}
		</section>
	);
}
