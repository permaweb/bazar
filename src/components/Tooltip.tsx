import React from 'react';
import { createPortal } from 'react-dom';

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
	escapeOverflow = false,
	placement = 'bottom',
}: TooltipProps) {
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
		'--ui-tooltip-delay': `${Math.max(0, delayMs)}ms`,
	} as React.CSSProperties;
	const clearHoverTimer = React.useCallback(() => {
		if (hoverTimerRef.current === null) return;
		window.clearTimeout(hoverTimerRef.current);
		hoverTimerRef.current = null;
	}, []);
	const showFloatingTooltip = React.useCallback(
		(immediate = false) => {
			if (!escapeOverflow || disabled) return;
			clearHoverTimer();
			if (immediate || delayMs <= 0) {
				setFloatingVisible(true);
				return;
			}
			hoverTimerRef.current = window.setTimeout(() => setFloatingVisible(true), delayMs);
		},
		[clearHoverTimer, delayMs, disabled, escapeOverflow]
	);
	const hideFloatingTooltip = React.useCallback(() => {
		clearHoverTimer();
		setFloatingVisible(false);
		setFloatingPosition(null);
	}, [clearHoverTimer]);

	useBrowserLayoutEffect(() => {
		if (!escapeOverflow || !floatingVisible) return;
		const updatePosition = () => {
			const anchor = anchorRef.current;
			const surface = surfaceRef.current;
			if (!anchor || !surface) return;
			setFloatingPosition(
				floatingTooltipPosition(anchor.getBoundingClientRect(), surface.getBoundingClientRect(), {
					align,
					placement,
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
	}, [align, escapeOverflow, floatingVisible, placement]);

	React.useEffect(() => clearHoverTimer, [clearHoverTimer]);

	const anchoredSurface = (
		<TooltipSurface className={contentClassName} id={tooltipId}>
			{content}
		</TooltipSurface>
	);
	const floatingSurface =
		escapeOverflow && floatingVisible && typeof document !== 'undefined'
			? createPortal(
					<span
						className={`ui-tooltip ui-tooltip--floating-layer ui-tooltip--${
							floatingPosition?.placement ?? placement
						} ui-tooltip--align-${align}`}
					>
						<TooltipSurface
							className={contentClassName}
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
							{content}
						</TooltipSurface>
					</span>,
					document.body
			  )
			: null;

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
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hideFloatingTooltip();
			}}
			onFocusCapture={() => showFloatingTooltip(true)}
			onMouseEnter={() => showFloatingTooltip()}
			onMouseLeave={hideFloatingTooltip}
			ref={anchorRef}
			style={tooltipStyle}
		>
			{children(tooltipId)}
			{escapeOverflow && floatingVisible ? null : anchoredSurface}
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
