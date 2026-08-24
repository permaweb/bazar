import React from 'react';

import { Button } from './Button';
import { Tooltip } from './Tooltip';

export type AssetDetailTab<Value extends string> = {
	value: Value;
	label: string;
	icon: React.ReactNode;
	panelId: string;
	disabled?: boolean;
	disabledMessage?: string;
};

export function assetDetailTabIndex(key: string, current: number, count: number): number | null {
	if (count < 1) return null;
	if (key === 'Home') return 0;
	if (key === 'End') return count - 1;
	if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count;
	if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count;
	return null;
}

export function enabledAssetDetailTabIndex(key: string, current: number, disabled: boolean[]): number | null {
	const count = disabled.length;
	if (count < 1 || disabled.every(Boolean)) return null;
	if (key === 'Home') return disabled.findIndex((value) => !value);
	if (key === 'End') {
		for (let index = count - 1; index >= 0; index -= 1) if (!disabled[index]) return index;
		return null;
	}
	const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
	if (!step) return null;
	for (let offset = 1; offset <= count; offset += 1) {
		const index = (current + step * offset + count) % count;
		if (!disabled[index]) return index;
	}
	return null;
}

export function AssetDetailTabs<Value extends string>({
	active,
	ariaLabel,
	idPrefix,
	onChange,
	tabs,
}: {
	active: Value;
	ariaLabel: string;
	idPrefix: string;
	onChange(value: Value): void;
	tabs: AssetDetailTab<Value>[];
}) {
	return (
		<div aria-label={ariaLabel} className="home-market-tabs asset-detail-tabs" role="tablist">
			{tabs.map((tab, index) => {
				const selected = active === tab.value;
				const tabId = `${idPrefix}-${tab.value}-tab`;
				const button = (descriptionId?: string) => (
					<Button
						aria-controls={tab.panelId}
						aria-describedby={descriptionId}
						aria-disabled={tab.disabled || undefined}
						aria-selected={selected}
						className="home-market-tab asset-detail-tab"
						id={tabId}
						key={tab.value}
						onClick={() => {
							if (!tab.disabled) onChange(tab.value);
						}}
						onKeyDown={(event) => {
							const nextIndex = enabledAssetDetailTabIndex(
								event.key,
								index,
								tabs.map((candidate) => Boolean(candidate.disabled))
							);
							if (nextIndex === null) return;
							event.preventDefault();
							const nextTab = tabs[nextIndex];
							onChange(nextTab.value);
							window.requestAnimationFrame(() => {
								document.getElementById(`${idPrefix}-${nextTab.value}-tab`)?.focus();
							});
						}}
						role="tab"
						size="small"
						variant="ghost"
						tabIndex={selected ? 0 : -1}
					>
						{tab.icon}
						{tab.label}
					</Button>
				);
				return tab.disabledMessage ? (
					<Tooltip
						align="center"
						className="asset-detail-tab-tooltip"
						content={tab.disabledMessage}
						key={tab.value}
						placement="bottom"
					>
						{button}
					</Tooltip>
				) : (
					button()
				);
			})}
		</div>
	);
}
