import React from 'react';
import { createPortal } from 'react-dom';

import { omitProps } from 'helpers/props';

const useBrowserLayoutEffect = typeof document === 'undefined' ? React.useEffect : React.useLayoutEffect;

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
	escapeOverflow?: boolean;
	placement?: TooltipPlacement;
};

type TooltipSurfaceProps = React.HTMLAttributes<HTMLSpanElement> & {
	visible?: boolean;
};

export const TooltipSurface = React.forwardRef<HTMLSpanElement, TooltipSurfaceProps>(function TooltipSurface(
	props,
	ref
) {
	return (
		<span
			{...omitProps(props, ['children', 'className', 'visible'])}
			className={[
				'ui-tooltip__content',
				props.visible ?? false ? 'ui-tooltip__content--visible' : '',
				props.className ?? '',
			]
				.filter(Boolean)
				.join(' ')}
			ref={ref}
			role="tooltip"
		>
			{props.children}
		</span>
	);
});

export default function Tooltip(props: TooltipProps) {
	const tooltipId = React.useId();
	const anchorRef = React.useRef<HTMLSpanElement>(null);
	const surfaceRef = React.useRef<HTMLSpanElement>(null);
	const hoverTimerRef = React.useRef<number | null>(null);
	const [floatingVisible, setFloatingVisible] = React.useState(false);
	const [floatingPosition, setFloatingPosition] = React.useState<{
		arrowLeft: number;
		left: number;
		placement: TooltipPlacement;
		top: number;
	} | null>(null);
	const tooltipStyle = {
		'--ui-tooltip-delay': `${Math.max(0, props.delayMs ?? 0)}ms`,
	} as React.CSSProperties;
	const clearHoverTimer = React.useCallback(() => {
		if (hoverTimerRef.current === null) return;
		window.clearTimeout(hoverTimerRef.current);
		hoverTimerRef.current = null;
	}, []);
	const showFloatingTooltip = React.useCallback(
		(immediate = false) => {
			if (!(props.escapeOverflow ?? false) || (props.disabled ?? false)) return;
			clearHoverTimer();
			if (immediate || (props.delayMs ?? 0) <= 0) {
				setFloatingVisible(true);
				return;
			}
			hoverTimerRef.current = window.setTimeout(() => setFloatingVisible(true), props.delayMs ?? 0);
		},
		[clearHoverTimer, props.delayMs ?? 0, props.disabled ?? false, props.escapeOverflow ?? false]
	);
	const hideFloatingTooltip = React.useCallback(() => {
		clearHoverTimer();
		setFloatingVisible(false);
		setFloatingPosition(null);
	}, [clearHoverTimer]);

	useBrowserLayoutEffect(() => {
		if (!(props.escapeOverflow ?? false) || !floatingVisible) return;
		const updatePosition = () => {
			const anchor = anchorRef.current;
			const surface = surfaceRef.current;
			if (!anchor || !surface) return;
			setFloatingPosition(
				floatingTooltipPosition(anchor.getBoundingClientRect(), surface.getBoundingClientRect(), {
					align: props.align ?? 'end',
					placement: props.placement ?? 'bottom',
					viewportHeight: window.innerHeight,
					viewportWidth: window.innerWidth,
				})
			);
		};
		updatePosition();
		window.addEventListener('resize', updatePosition);
		window.addEventListener('scroll', updatePosition, true);
		return () => {
			window.removeEventListener('resize', updatePosition);
			window.removeEventListener('scroll', updatePosition, true);
		};
	}, [props.align ?? 'end', props.escapeOverflow ?? false, floatingVisible, props.placement ?? 'bottom']);

	React.useEffect(() => clearHoverTimer, [clearHoverTimer]);

	const anchoredSurface = (
		<TooltipSurface className={props.contentClassName} id={tooltipId}>
			{props.content}
		</TooltipSurface>
	);
	const floatingSurface =
		(props.escapeOverflow ?? false) && floatingVisible && typeof document !== 'undefined'
			? createPortal(
					<span
						className={`ui-tooltip ui-tooltip--floating-layer ui-tooltip--${
							floatingPosition?.placement ?? props.placement ?? 'bottom'
						} ui-tooltip--align-${props.align ?? 'end'}`}
					>
						<TooltipSurface
							className={props.contentClassName}
							id={tooltipId}
							ref={surfaceRef}
							style={
								{
									'--ui-tooltip-arrow-left': `${floatingPosition?.arrowLeft ?? 18}px`,
									left: floatingPosition?.left ?? -9999,
									top: floatingPosition?.top ?? -9999,
								} as React.CSSProperties
							}
							visible={floatingPosition !== null}
						>
							{props.content}
						</TooltipSurface>
					</span>,
					document.body
			  )
			: null;

	return (
		<span
			className={[
				'ui-tooltip',
				`ui-tooltip--${props.placement ?? 'bottom'}`,
				`ui-tooltip--align-${props.align ?? 'end'}`,
				props.disabled ?? false ? 'ui-tooltip--disabled' : '',
				props.className ?? '',
			]
				.filter(Boolean)
				.join(' ')}
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hideFloatingTooltip();
			}}
			onFocusCapture={() => showFloatingTooltip(true)}
			onMouseEnter={() => showFloatingTooltip()}
			onMouseLeave={hideFloatingTooltip}
			ref={anchorRef}
			style={tooltipStyle}
		>
			{props.children(tooltipId)}
			{(props.escapeOverflow ?? false) && floatingVisible ? null : anchoredSurface}
			{floatingSurface}
		</span>
	);
}

export function floatingTooltipPosition(
	anchor: Pick<DOMRect, 'bottom' | 'height' | 'left' | 'right' | 'top' | 'width'>,
	surface: Pick<DOMRect, 'height' | 'width'>,
	options: {
		align: TooltipAlignment;
		placement: TooltipPlacement;
		viewportHeight: number;
		viewportWidth: number;
	}
) {
	const margin = 8;
	const gap = 9;
	const idealLeft =
		options.align === 'start'
			? anchor.left
			: options.align === 'center'
			? anchor.left + (anchor.width - surface.width) / 2
			: anchor.right - surface.width;
	const left = Math.min(
		Math.max(margin, idealLeft),
		Math.max(margin, options.viewportWidth - surface.width - margin)
	);
	const anchorCenter = anchor.left + anchor.width / 2;
	const arrowLeft = Math.min(Math.max(14, anchorCenter - left), Math.max(14, surface.width - 14));
	const topPosition = anchor.top - surface.height - gap;
	const bottomPosition = anchor.bottom + gap;
	let resolvedPlacement = options.placement;
	if (
		options.placement === 'top' &&
		topPosition < margin &&
		bottomPosition + surface.height <= options.viewportHeight
	) {
		resolvedPlacement = 'bottom';
	} else if (
		options.placement === 'bottom' &&
		bottomPosition + surface.height > options.viewportHeight - margin &&
		topPosition >= margin
	) {
		resolvedPlacement = 'top';
	}
	const idealTop = resolvedPlacement === 'top' ? topPosition : bottomPosition;
	const top = Math.min(
		Math.max(margin, idealTop),
		Math.max(margin, options.viewportHeight - surface.height - margin)
	);
	return { arrowLeft, left, placement: resolvedPlacement, top };
}
