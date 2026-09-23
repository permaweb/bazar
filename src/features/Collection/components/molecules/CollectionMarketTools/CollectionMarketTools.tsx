import React from 'react';
import { Grid2X2, LayoutGrid, List, Search } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Select } from 'components/atoms/Select';
import { TextInput } from 'components/atoms/TextInput';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { COLLECTION_MESSAGES } from '../../../messages';
import type { CollectionSort, CollectionViewMode } from '../../../model/collection-market';

// Layout, search, sort, and listing filters above a collection's assets; a single-token collection shows its count.
export default function CollectionMarketTools(props: {
	compact: boolean;
	collectionName: string;
	gridId: string;
	summaryId: string;
	statusRef: React.RefObject<HTMLSpanElement>;
	summary: string;
	announcement: string;
	viewMode: CollectionViewMode;
	onViewModeChange(viewMode: CollectionViewMode): void;
	query: string;
	onQueryChange(query: string): void;
	sort: CollectionSort;
	onSortChange(sort: CollectionSort): void;
	listedOnly: boolean;
	onListedOnlyChange(listedOnly: boolean): void;
}) {
	const language = useMessages(COLLECTION_MESSAGES);
	if (props.compact) {
		return (
			<span className="collection-result-count" id={props.summaryId} ref={props.statusRef} tabIndex={-1}>
				{language.compactTokenCount}
			</span>
		);
	}
	return (
		<div className="asset-tools collection-market-tools">
			<div className="collection-view-toggle" aria-label={language.assetLayoutLabel}>
				<Button
					aria-label={language.viewComfortable}
					aria-pressed={props.viewMode === 'comfortable'}
					className={props.viewMode === 'comfortable' ? 'active' : undefined}
					onClick={() => props.onViewModeChange('comfortable')}
					size="icon"
					type="button"
					variant="ghost"
				>
					<Grid2X2 aria-hidden="true" />
				</Button>
				<Button
					aria-label={language.viewCompact}
					aria-pressed={props.viewMode === 'compact'}
					className={props.viewMode === 'compact' ? 'active' : undefined}
					onClick={() => props.onViewModeChange('compact')}
					size="icon"
					type="button"
					variant="ghost"
				>
					<LayoutGrid aria-hidden="true" />
				</Button>
				<Button
					aria-label={language.viewList}
					aria-pressed={props.viewMode === 'list'}
					className={props.viewMode === 'list' ? 'active' : undefined}
					onClick={() => props.onViewModeChange('list')}
					size="icon"
					type="button"
					variant="ghost"
				>
					<List aria-hidden="true" />
				</Button>
			</div>
			<label className="collection-search">
				<Search aria-hidden="true" />
				<VisuallyHidden>
					{formatMessage(language.searchCollection, { name: props.collectionName })}
				</VisuallyHidden>
				<TextInput
					aria-controls={props.gridId}
					aria-describedby={props.summaryId}
					value={props.query}
					onChange={(event) => props.onQueryChange(event.target.value)}
					placeholder={language.searchPlaceholder}
				/>
			</label>
			<div className="asset-tools-controls">
				<div className="asset-filters">
					<Select<CollectionSort>
						label={language.sortLabel}
						onChange={props.onSortChange}
						options={[
							{ value: 'recent', label: language.sortRecent },
							{ value: 'price-low', label: language.sortPriceLow },
							{ value: 'price-high', label: language.sortPriceHigh },
							{ value: 'name', label: language.sortName },
						]}
						showLabel={false}
						value={props.sort}
					/>
					<Select<'all' | 'listed'>
						label={language.showLabel}
						onChange={(nextValue) => props.onListedOnlyChange(nextValue === 'listed')}
						options={[
							{ value: 'all', label: language.showAllAssets },
							{ value: 'listed', label: language.showListedForSale },
						]}
						showLabel={false}
						value={props.listedOnly ? 'listed' : 'all'}
					/>
				</div>
				<span id={props.summaryId} ref={props.statusRef} tabIndex={-1}>
					{props.summary}
				</span>
			</div>
			<LiveRegion>{props.announcement}</LiveRegion>
		</div>
	);
}
