import React from 'react';

export type TooltipPlacement = 'bottom' | 'top';

type TooltipProps = {
	children: (tooltipId: string) => React.ReactNode;
	className?: string;
	content: React.ReactNode;
	placement?: TooltipPlacement;
};

export function Tooltip({ children, className, content, placement = 'bottom' }: TooltipProps) {
	const tooltipId = React.useId();

	return (
		<span className={['ui-tooltip', `ui-tooltip--${placement}`, className ?? ''].filter(Boolean).join(' ')}>
			{children(tooltipId)}
			<span className="ui-tooltip__content" id={tooltipId} role="tooltip">
				{content}
			</span>
		</span>
	);
}
