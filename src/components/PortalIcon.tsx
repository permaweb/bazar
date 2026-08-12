import type { SVGProps } from 'react';

export function PortalIcon({ className = '', ...props }: SVGProps<SVGSVGElement>) {
	return (
		<svg
			{...props}
			className={`portal-icon${className ? ` ${className}` : ''}`}
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path className="portal-icon__glow" d="M8 20.5v-10a4 4 0 0 1 8 0v10Z" />
			<path className="portal-icon__arch" d="M4.5 20.5v-10a7.5 7.5 0 0 1 15 0v10" />
			<path className="portal-icon__door" d="M8 20.5v-10a4 4 0 0 1 8 0v10" />
			<path className="portal-icon__threshold" d="M3.5 20.5h17" />
			<path className="portal-icon__twinkle portal-icon__twinkle--red" d="M20 3v3.5M18.25 4.75h3.5" />
			<path className="portal-icon__twinkle portal-icon__twinkle--green" d="M3.5 6.5v2.5M2.25 7.75h2.5" />
			<path className="portal-icon__twinkle portal-icon__twinkle--blue" d="M20.25 13v2.5M19 14.25h2.5" />
		</svg>
	);
}
