import React from 'react';

import type { AssetState } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { type FungibleHolder, fungibleHoldingPercentage } from '../../../model/fungible-holders';
import { tokenLabel } from '../../../model/fungible-market';
import { FungibleHolderIdentity } from '../../molecules/FungibleHolderIdentity';

import * as S from './styles';

const HOLDER_REVEAL_STEP = 50;

export default function FungibleHolderTable(props: {
	assetName: string;
	holders: FungibleHolder[];
	limit: number;
	state: AssetState;
	onLimitChange(limit: number): void;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const revealStatusRef = React.useRef<HTMLParagraphElement>(null);
	const visibleRows = props.holders.slice(0, props.limit);

	function handleReveal() {
		const next = Math.min(props.holders.length, props.limit + HOLDER_REVEAL_STEP);
		props.onLimitChange(next);
		if (next === props.holders.length) {
			window.requestAnimationFrame(() => revealStatusRef.current?.focus());
		}
	}

	return (
		<>
			<S.HolderTable
				aria-label={formatMessage(messages.holderTableLabel, { name: props.assetName })}
				className="orderbook-table fungible-holder-table"
				role="table"
			>
				<S.Head className="orderbook-head" role="row">
					<span role="columnheader">{messages.holderColumnHolder}</span>
					<span role="columnheader">{messages.holderColumnTotalBalance}</span>
					<span role="columnheader">{messages.holderColumnShare}</span>
					<span role="columnheader">{messages.holderColumnListed}</span>
				</S.Head>
				{visibleRows.map((holder) => (
					<S.Row className="orderbook-row" key={holder.address} role="row">
						<span data-label={messages.holderColumnHolder} role="cell">
							<FungibleHolderIdentity address={holder.address} />
						</span>
						<strong data-label={messages.holderColumnTotalBalance} role="cell">
							{tokenLabel(holder.total, props.state)}
						</strong>
						<S.HolderShare
							className="fungible-holder-share"
							data-label={messages.holderColumnShare}
							role="cell"
						>
							{fungibleHoldingPercentage(holder.total, props.state.totalSupply)}
						</S.HolderShare>
						<span data-label={messages.holderColumnListed} role="cell">
							{BigInt(holder.listed) > 0n
								? tokenLabel(holder.listed, props.state)
								: messages.holderEmptyValue}
						</span>
					</S.Row>
				))}
				{!props.holders.length ? (
					<S.Empty className="orderbook-empty" role="row">
						<S.EmptyCell aria-colspan={4} className="orderbook-empty-cell" role="cell">
							<strong>{messages.holderEmptyTitle}</strong>
							<span>{messages.holderEmptyDetail}</span>
						</S.EmptyCell>
					</S.Empty>
				) : null}
			</S.HolderTable>
			{props.holders.length > HOLDER_REVEAL_STEP ? (
				<S.Reveal className="orderbook-reveal">
					<p aria-atomic="true" aria-live="polite" ref={revealStatusRef} role="status" tabIndex={-1}>
						{formatMessage(messages.holderTableShowing, {
							visible: visibleRows.length.toLocaleString(),
							total: props.holders.length.toLocaleString(),
						})}
					</p>
					{visibleRows.length < props.holders.length ? (
						<Button type="button" size="custom" onClick={handleReveal}>
							{formatMessage(messages.holderTableShowMore, {
								count: Math.min(
									HOLDER_REVEAL_STEP,
									props.holders.length - visibleRows.length
								).toLocaleString(),
							})}
						</Button>
					) : null}
				</S.Reveal>
			) : null}
		</>
	);
}
