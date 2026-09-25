import React from 'react';

export type ActivityAmountTicker = { active: boolean; shift: number; duration: number };

const IDLE_TICKER: ActivityAmountTicker = { active: false, shift: 0, duration: 0 };

// Measures whether a compact amount overflows its cell and, when it does, how far and how long its ticker scrolls.
export function useActivityAmountTicker(amount: string): {
	containerRef: React.RefObject<HTMLSpanElement>;
	textRef: React.RefObject<HTMLSpanElement>;
	ticker: ActivityAmountTicker;
} {
	const containerRef = React.useRef<HTMLSpanElement>(null);
	const textRef = React.useRef<HTMLSpanElement>(null);
	const [ticker, setTicker] = React.useState<ActivityAmountTicker>(IDLE_TICKER);

	React.useEffect(() => {
		const container = containerRef.current;
		const text = textRef.current;
		if (!container || !text) return;
		let disposed = false;
		const update = () => {
			if (disposed) return;
			const active = text.scrollWidth > container.clientWidth + 1;
			const shift = active ? text.scrollWidth + 24 : 0;
			const duration = active ? Math.max(4, shift / 32) : 0;
			setTicker((current) =>
				current.active === active && current.shift === shift && current.duration === duration
					? current
					: { active, shift, duration }
			);
		};
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
		observer?.observe(container);
		window.addEventListener('resize', update);
		void document.fonts?.ready.then(update);
		update();
		return () => {
			disposed = true;
			observer?.disconnect();
			window.removeEventListener('resize', update);
		};
	}, [amount]);

	return { containerRef, textRef, ticker };
}
