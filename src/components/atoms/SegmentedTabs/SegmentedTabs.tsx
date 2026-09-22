import React from 'react';

import { Button } from '../Button';

export type SegmentedTab<Value extends string> = {
	value: Value;
	label: string;
	icon?: React.ReactNode;
	panelId?: string;
};

export default function SegmentedTabs<Value extends string>(props: {
	active: Value;
	ariaLabel: string;
	className?: string;
	idPrefix: string;
	onChange(value: Value): void;
	tabs: SegmentedTab<Value>[];
}) {
	return (
		<div
			aria-label={props.ariaLabel}
			className={['segmented-tabs', props.className].filter(Boolean).join(' ')}
			role="tablist"
		>
			{props.tabs.map((tab, index) => {
				const selected = props.active === tab.value;
				return (
					<Button
						aria-controls={tab.panelId}
						aria-selected={selected}
						className={selected ? 'active' : undefined}
						id={`${props.idPrefix}-${tab.value}-tab`}
						key={tab.value}
						onClick={() => props.onChange(tab.value)}
						onKeyDown={(event) => {
							let nextIndex: number | null = null;
							if (event.key === 'Home') nextIndex = 0;
							if (event.key === 'End') nextIndex = props.tabs.length - 1;
							if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
								nextIndex = (index + 1) % props.tabs.length;
							if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
								nextIndex = (index - 1 + props.tabs.length) % props.tabs.length;
							if (nextIndex === null) return;
							event.preventDefault();
							const nextTab = props.tabs[nextIndex];
							props.onChange(nextTab.value);
							window.requestAnimationFrame(() =>
								document.getElementById(`${props.idPrefix}-${nextTab.value}-tab`)?.focus()
							);
						}}
						role="tab"
						size="custom"
						tabIndex={selected ? 0 : -1}
						type="button"
					>
						{tab.icon}
						{tab.label}
					</Button>
				);
			})}
		</div>
	);
}
