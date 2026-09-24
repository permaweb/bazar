import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CircleX, ShoppingCart, Tag } from 'lucide-react';

import type { AssetSummary, Collection } from 'api/collections';
import type { CollectionActivityEvent } from 'api/discovery';
import type { AssetState } from 'api/marketplace';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Icon } from 'components/atoms/Icon';
import { Tooltip } from 'components/atoms/Tooltip';
import { WalletAddress } from 'components/organisms/WalletAddress';
import { transactionExplorerUrl } from 'helpers/explorer';
import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { useMarketActivityNow } from '../../../hooks/useMarketActivityNow';
import { ACTIVITY_MESSAGES } from '../../../messages';
import { marketActivityRow, shortActivityValue } from '../../../model/market-activity';
import { CompactActivityAmount } from '../../molecules/CompactActivityAmount';

import * as S from './styles';

export default function MarketActivityList(props: {
	ariaLabel: string;
	collectionId?: string;
	compact?: boolean;
	describeEvent?(event: CollectionActivityEvent): string;
	eventAmount?(event: CollectionActivityEvent): string;
	events: CollectionActivityEvent[];
	id?: string;
	loading?: boolean;
	reservationState?: AssetState | null;
	resolveAsset(event: CollectionActivityEvent): AssetSummary | undefined;
	resolveCollection?(event: CollectionActivityEvent): Pick<Collection, 'id' | 'name'> | undefined;
}) {
	const messages = useMessages(ACTIVITY_MESSAGES);
	const now = useMarketActivityNow(props.events);
	return (
		<S.List
			aria-busy={props.loading ?? false}
			aria-label={props.ariaLabel}
			className={`activity-list${props.compact ?? false ? ' compact' : ''}`}
			id={props.id}
		>
			{props.events.map((event) => {
				const asset = props.resolveAsset(event);
				const row = marketActivityRow(event, {
					now,
					messages,
					collection: props.resolveCollection?.(event),
					collectionId: props.collectionId,
					reservationState: props.reservationState,
					describeEvent: props.describeEvent,
					eventAmount: props.eventAmount,
				});
				const headline = row.reservation ? (
					<>
						{formatMessage(messages.activityReservation, {
							deadline: row.reservation.deadline.toLocaleString(),
						})}
						{row.reservation.expired ? (
							<>
								{' '}
								<S.ReservationExpired className="activity-reservation-expired">
									{messages.activityReservationExpired}
								</S.ReservationExpired>
							</>
						) : null}
					</>
				) : (
					row.label
				);
				if (props.compact ?? false) {
					return (
						<S.Row className="activity-row activity-row-compact" key={event.id}>
							<S.ActionIcon aria-hidden="true" className={`activity-icon action-${event.action}`}>
								{marketActivitySymbol(event.action)}
							</S.ActionIcon>
							<S.CompactSummary className="activity-compact-summary">
								<strong>{headline}</strong>
								{row.detail ? (
									<small>
										<ArCurrencyText>{row.detail}</ArCurrencyText>
									</small>
								) : null}
							</S.CompactSummary>
							<CompactActivityAmount amount={row.amount || messages.activityAmountEmpty} />
							<S.CompactActor className="activity-compact-actor">
								{event.actor ? (
									<WalletAddress address={event.actor} label={messages.activityActorAddress} />
								) : (
									<span>{messages.activityActorUnknown}</span>
								)}
							</S.CompactActor>
							<S.CompactTimeWrap
								className="activity-compact-time-wrap"
								content={row.absoluteTimestamp ?? row.timestamp}
							>
								{(tooltipId) => (
									<S.CompactTime
										aria-describedby={tooltipId}
										className="activity-compact-time"
										dateTime={row.timestampDateTime}
									>
										{row.timestamp}
									</S.CompactTime>
								)}
							</S.CompactTimeWrap>
							<S.CompactTransaction
								aria-label={row.transactionLabel}
								className="activity-compact-transaction"
								href={transactionExplorerUrl(row.transactionId)}
								target="_blank"
								rel="noreferrer"
							>
								<Icon icon={ArrowUpRight} size="xs" />
							</S.CompactTransaction>
						</S.Row>
					);
				}
				return (
					<S.Row className="activity-row" key={event.id}>
						<S.ActionIcon aria-hidden="true" className={`activity-icon action-${event.action}`}>
							{marketActivitySymbol(event.action)}
						</S.ActionIcon>
						<S.Main className={`activity-main${row.amount ? ' has-amount' : ''}`}>
							<S.MainCopy className="activity-main-copy">
								<strong>{headline}</strong>
								{asset && row.assetCollectionId ? (
									<Link to={`/asset/${row.assetCollectionId}/${asset.id}`}>{asset.name}</Link>
								) : asset ? (
									<span>{asset.name}</span>
								) : (
									<span>{shortActivityValue(event.processId)}</span>
								)}
								<small className={row.detail ? undefined : 'activity-time-only'}>
									<ArCurrencyText>{row.detail}</ArCurrencyText>
									<Tooltip
										className="activity-mobile-time"
										content={row.absoluteTimestamp ?? row.timestamp}
									>
										{(tooltipId) => (
											<time aria-describedby={tooltipId} dateTime={row.timestampDateTime}>
												{row.detail ? ' · ' : ''}
												{row.timestamp}
											</time>
										)}
									</Tooltip>
								</small>
							</S.MainCopy>
							{row.amount ? (
								<strong className="activity-amount">
									<ArCurrencyText>{row.amount}</ArCurrencyText>
								</strong>
							) : null}
						</S.Main>
						<S.Meta className="activity-meta">
							<S.Actor className="activity-actor">
								<span>{messages.activityActor}</span>
								{event.actor ? (
									<WalletAddress address={event.actor} label={messages.activityActorAddress} />
								) : (
									<strong>{messages.activityActorUnknown}</strong>
								)}
							</S.Actor>
							<S.Block className="activity-block">
								<Tooltip
									className="activity-desktop-time"
									content={row.absoluteTimestamp ?? row.timestamp}
								>
									{(tooltipId) => (
										<time aria-describedby={tooltipId} dateTime={row.timestampDateTime}>
											{row.timestamp}
										</time>
									)}
								</Tooltip>
								<a
									aria-label={row.transactionLabel}
									href={transactionExplorerUrl(row.transactionId)}
									target="_blank"
									rel="noreferrer"
								>
									<span className="activity-transaction-long" aria-hidden="true">
										{row.transactionSummary}
									</span>
									<span className="activity-transaction-short" aria-hidden="true">
										{messages.activityViewTransaction}
									</span>
									<Icon icon={ArrowUpRight} size="xs" />
								</a>
							</S.Block>
						</S.Meta>
					</S.Row>
				);
			})}
		</S.List>
	);
}

function marketActivitySymbol(action: CollectionActivityEvent['action']) {
	const ActivityIcon = {
		'make-offer': Tag,
		'register-interest': ShoppingCart,
		transfer: ArrowRight,
		'cancel-order': CircleX,
	}[action];
	return <ActivityIcon className="ui-icon" aria-hidden="true" />;
}
