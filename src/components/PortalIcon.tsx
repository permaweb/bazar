import type { SVGProps } from 'react';

export function PortalIcon({ className = '', ...props }: SVGProps<SVGSVGElement>) {
	return (
		<svg
			{...props}
			className={`portal-icon${className ? ` ${className}` : ''}`}
			viewBox="0 0 20 20"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				className="portal-icon__ring"
				d="M8.1 2.9C5.9 4 4.5 6.7 4.5 10c0 4.1 2.2 7.4 5.5 7.4s5.5-3.3 5.5-7.4c0-3.3-1.4-6-3.6-7.1"
			/>
			<ellipse className="portal-icon__core" cx="10" cy="10" rx="2.7" ry="5" />
			<path className="portal-icon__twinkle portal-icon__twinkle--near" d="M15.9 2.1v3.4M14.2 3.8h3.4" />
			<path className="portal-icon__twinkle portal-icon__twinkle--far" d="M3.4 13.7v2.4M2.2 14.9h2.4" />
		</svg>
	);
}
