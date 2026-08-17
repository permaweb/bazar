import React from 'react';

export function useProgressiveReveal(enabled: boolean, reveal: () => void, rootMargin = '320px 0px') {
	const revealRef = React.useRef(reveal);
	const [node, setNode] = React.useState<HTMLElement | null>(null);
	revealRef.current = reveal;

	React.useEffect(() => {
		if (!enabled || !node || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) revealRef.current();
			},
			{ rootMargin }
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [enabled, node, rootMargin]);

	return setNode;
}
