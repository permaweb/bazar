import React from 'react';

export type AssetDetailTab<Value extends string> = {
  value: Value;
  label: string;
  icon: React.ReactNode;
  panelId: string;
};

export function assetDetailTabIndex(key: string, current: number, count: number): number | null {
  if (count < 1) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count;
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
        return (
          <button
            aria-controls={tab.panelId}
            aria-selected={selected}
            className="home-market-tab asset-detail-tab"
            id={tabId}
            key={tab.value}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => {
              const nextIndex = assetDetailTabIndex(event.key, index, tabs.length);
              if (nextIndex === null) return;
              event.preventDefault();
              const nextTab = tabs[nextIndex];
              onChange(nextTab.value);
              window.requestAnimationFrame(() => {
                document.getElementById(`${idPrefix}-${nextTab.value}-tab`)?.focus();
              });
            }}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
