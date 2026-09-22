import React from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { formatTokenDescription } from 'helpers/token-display';

export default function CollectionDescription(props: { description: string }) {
	const text = formatTokenDescription(props.description);
	const contentId = React.useId();
	const paragraphRef = React.useRef<HTMLParagraphElement>(null);
	const [expanded, setExpanded] = React.useState(false);
	const [overflowing, setOverflowing] = React.useState(false);

	React.useEffect(() => {
		const paragraph = paragraphRef.current;
		if (!paragraph) return;
		let disposed = false;
		const update = () => {
			if (disposed || !paragraph.classList.contains('is-collapsed')) return;
			const next = paragraph.scrollHeight > paragraph.clientHeight + 1;
			setOverflowing((current) => (current === next ? current : next));
		};
		const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
		observer?.observe(paragraph);
		window.addEventListener('resize', update);
		void document.fonts?.ready.then(update);
		update();
		return () => {
			disposed = true;
			observer?.disconnect();
			window.removeEventListener('resize', update);
		};
	}, [expanded, text]);

	if (!text) return null;
	return (
		<div className="collection-description">
			<p className={expanded ? undefined : 'is-collapsed'} id={contentId} ref={paragraphRef}>
				{text}
			</p>
			{overflowing ? (
				<Button
					aria-controls={contentId}
					aria-expanded={expanded}
					className="collection-description-toggle"
					onClick={() => setExpanded((current) => !current)}
					size="custom"
					variant="ghost"
				>
					Show {expanded ? 'less' : 'more'}
					<ChevronDown aria-hidden="true" />
				</Button>
			) : null}
		</div>
	);
}
