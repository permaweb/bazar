import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { optionalMotionBehavior } from 'helpers/motion';

import { alphabetBrowseIndex, alphabetFilterIndex, COLLECTION_ALPHABET } from '../../../model/collection-market';

// A roving-tabindex letter filter that scrolls horizontally, with edge controls that page by several letters.
export default function CollectionAlphabetFilter(props: {
	initial: string;
	focus: string;
	onFocusChange(letter: string): void;
	onSelect(letter: string): void;
}) {
	const letterRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
	const scrollerRef = React.useRef<HTMLElement>(null);
	const [edges, setEdges] = React.useState({ start: true, end: false });

	React.useEffect(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const update = () => {
			const next = {
				start: scroller.scrollLeft <= 2,
				end: scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 2,
			};
			setEdges((current) => (current.start === next.start && current.end === next.end ? current : next));
		};
		update();
		scroller.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
		observer?.observe(scroller);
		return () => {
			scroller.removeEventListener('scroll', update);
			window.removeEventListener('resize', update);
			observer?.disconnect();
		};
	}, []);

	React.useEffect(() => {
		const target = letterRefs.current[COLLECTION_ALPHABET.indexOf(props.focus)];
		const scroller = scrollerRef.current;
		if (target && scroller) {
			scroller.scrollTo({
				behavior: optionalMotionBehavior(),
				left: target.offsetLeft - (scroller.clientWidth - target.offsetWidth) / 2,
			});
		}
	}, [props.focus]);

	function handleBrowse(direction: 'previous' | 'next') {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const scrollerRect = scroller.getBoundingClientRect();
		const leftEdge = scrollerRect.left + (edges.start ? 0 : 52);
		const rightEdge = scrollerRect.right - (edges.end ? 0 : 52);
		const visible = letterRefs.current.flatMap((button, index) => {
			if (!button) return [];
			const bounds = button.getBoundingClientRect();
			return bounds.left >= leftEdge - 1 && bounds.right <= rightEdge + 1 ? [index] : [];
		});
		const targetIndex = alphabetBrowseIndex(direction, visible, letterRefs.current.length);
		const target = letterRefs.current[targetIndex];
		if (!target) return;
		props.onFocusChange(COLLECTION_ALPHABET[targetIndex]);
		target.focus({ preventScroll: true });
	}

	return (
		<div className={`alphabet-filter-shell${edges.start ? ' at-start' : ''}${edges.end ? ' at-end' : ''}`}>
			<nav
				className="alphabet-filter"
				aria-label="Filter names by first letter"
				id="name-initial-filter"
				ref={scrollerRef}
			>
				{COLLECTION_ALPHABET.map((letter, index, options) => (
					<Button
						aria-label={letter === 'all' ? 'All names' : `Names beginning with ${letter}`}
						aria-pressed={props.initial === letter}
						className={props.initial === letter ? 'active' : undefined}
						key={letter}
						size="custom"
						type="button"
						variant="ghost"
						onClick={() => {
							props.onFocusChange(letter);
							props.onSelect(letter);
						}}
						onKeyDown={(event) => {
							const nextIndex = alphabetFilterIndex(event.key, index, options.length);
							if (nextIndex === null) return;
							event.preventDefault();
							props.onFocusChange(options[nextIndex]);
							letterRefs.current[nextIndex]?.focus();
						}}
						ref={(element) => {
							letterRefs.current[index] = element;
						}}
						tabIndex={props.focus === letter ? 0 : -1}
					>
						{letter === 'all' ? 'All' : letter}
					</Button>
				))}
			</nav>
			{!edges.start ? (
				<Button
					aria-controls="name-initial-filter"
					aria-label="Browse earlier letters"
					className="alphabet-scroll alphabet-scroll-previous"
					size="icon"
					onClick={() => handleBrowse('previous')}
					type="button"
				>
					<ArrowLeft aria-hidden="true" />
				</Button>
			) : null}
			{!edges.end ? (
				<Button
					aria-controls="name-initial-filter"
					aria-label="Browse later letters"
					className="alphabet-scroll alphabet-scroll-next"
					size="icon"
					onClick={() => handleBrowse('next')}
					type="button"
				>
					<ArrowRight aria-hidden="true" />
				</Button>
			) : null}
		</div>
	);
}
