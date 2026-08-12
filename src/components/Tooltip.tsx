import React from 'react';

export type TooltipPlacement = 'bottom' | 'top';
export type TooltipAlignment = 'center' | 'end' | 'start';

type TooltipProps = {
	align?: TooltipAlignment;
	children: (tooltipId: string) => React.ReactNode;
	className?: string;
	content: React.ReactNode;
	contentClassName?: string;
	delayMs?: number;
	disabled?: boolean;
	placement?: TooltipPlacement;
};

type TooltipSurfaceProps = React.HTMLAttributes<HTMLSpanElement> & {
	visible?: boolean;
};

export const TooltipSurface = React.forwardRef<HTMLSpanElement, TooltipSurfaceProps>(function TooltipSurface(
	{ children, className, visible = false, ...props },
	ref
) {
	return (
		<span
			{...props}
			className={['ui-tooltip__content', visible ? 'ui-tooltip__content--visible' : '', className ?? '']
				.filter(Boolean)
				.join(' ')}
			ref={ref}
			role="tooltip"
		>
			{children}
		</span>
	);
});

export function Tooltip({
	align = 'end',
	children,
	className,
	content,
	contentClassName,
	delayMs = 0,
	disabled = false,
	placement = 'bottom',
}: TooltipProps) {
	const tooltipId = React.useId();
	const tooltipStyle = {
		'--ui-tooltip-delay': `${Math.max(0, delayMs)}ms`,
	} as React.CSSProperties;

	return (
		<span
			className={[
				'ui-tooltip',
				`ui-tooltip--${placement}`,
				`ui-tooltip--align-${align}`,
				disabled ? 'ui-tooltip--disabled' : '',
				className ?? '',
			]
				.filter(Boolean)
				.join(' ')}
			style={tooltipStyle}
		>
			{children(tooltipId)}
			<TooltipSurface className={contentClassName} id={tooltipId}>
				{content}
			</TooltipSurface>
		</span>
	);
}
