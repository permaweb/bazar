import React from 'react';

import { Button } from './Button';

export type SegmentedTab<Value extends string> = {
	value: Value;
	label: string;
	icon?: React.ReactNode;
	panelId?: string;
};

export function SegmentedTabs<Value extends string>({ active, ariaLabel, className, idPrefix, onChange, tabs }: {
	active: Value;
	ariaLabel: string;
	className?: string;
	idPrefix: string;
	onChange(value: Value): void;
	tabs: SegmentedTab<Value>[];
}) {
	return (
		<div aria-label={ariaLabel} className={['segmented-tabs', className].filter(Boolean).join(' ')} role="tablist">
			{tabs.map((tab, index) => {
				const selected = active === tab.value;
				return (
					<Button
						aria-controls={tab.panelId}
						aria-selected={selected}
						className={selected ? 'active' : undefined}
						id={`${idPrefix}-${tab.value}-tab`}
						key={tab.value}
						onClick={() => onChange(tab.value)}
						onKeyDown={(event) => {
							let nextIndex: number | null = null;
							if (event.key === 'Home') nextIndex = 0;
							if (event.key === 'End') nextIndex = tabs.length - 1;
							if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
							if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
							if (nextIndex === null) return;
							event.preventDefault();
							const nextTab = tabs[nextIndex];
							onChange(nextTab.value);
							window.requestAnimationFrame(() => document.getElementById(`${idPrefix}-${nextTab.value}-tab`)?.focus());
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
