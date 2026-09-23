import React from 'react';
import { Grid2X2, LayoutGrid, List, Search } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { LiveRegion } from 'components/atoms/LiveRegion';
import { Select } from 'components/atoms/Select';
import { TextInput } from 'components/atoms/TextInput';
import { VisuallyHidden } from 'components/atoms/VisuallyHidden';

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
	if (props.compact) {
		return (
			<span className="collection-result-count" id={props.summaryId} ref={props.statusRef} tabIndex={-1}>
				1 token
			</span>
		);
	}
	return (
		<div className="asset-tools collection-market-tools">
			<div className="collection-view-toggle" aria-label="Asset layout">
				<Button
					aria-label="Comfortable grid"
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
					aria-label="Compact grid"
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
					aria-label="List view"
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
				<VisuallyHidden>Search {props.collectionName}</VisuallyHidden>
				<TextInput
					aria-controls={props.gridId}
					aria-describedby={props.summaryId}
					value={props.query}
					onChange={(event) => props.onQueryChange(event.target.value)}
					placeholder="Search items"
				/>
			</label>
			<div className="asset-tools-controls">
				<div className="asset-filters">
					<Select<CollectionSort>
						label="Sort"
						onChange={props.onSortChange}
						options={[
							{ value: 'recent', label: 'Recently active' },
							{ value: 'price-low', label: 'Price: Low to High' },
							{ value: 'price-high', label: 'Price: High to Low' },
							{ value: 'name', label: 'Name: A to Z' },
						]}
						showLabel={false}
						value={props.sort}
					/>
					<Select<'all' | 'listed'>
						label="Show"
						onChange={(nextValue) => props.onListedOnlyChange(nextValue === 'listed')}
						options={[
							{ value: 'all', label: 'All assets' },
							{ value: 'listed', label: 'Listed for sale' },
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
