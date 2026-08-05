import React from 'react';
import { ArrowRight, ArrowUpRight, CircleX, ShoppingCart, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { CollectionActivityEvent } from 'api/asset-discovery';
import type { AssetSummary } from 'api/collections';
import { transactionExplorerUrl } from 'api/arweave-explorer';
import { WalletAddress } from 'components/WalletAddress';

export function MarketActivityList({
  ariaLabel,
  collectionId,
  describeEvent = marketActivityDetail,
  events,
  id,
  loading = false,
  resolveAsset,
}: {
  ariaLabel: string;
  collectionId: string;
  describeEvent?(event: CollectionActivityEvent): string;
  events: CollectionActivityEvent[];
  id?: string;
  loading?: boolean;
  resolveAsset(event: CollectionActivityEvent): AssetSummary | undefined;
}) {
  return (
    <ul aria-busy={loading} aria-label={ariaLabel} className="activity-list" id={id}>
      {events.map((event) => {
        const asset = resolveAsset(event);
        const detail = describeEvent(event);
        const timestamp = event.timestamp ? formatMarketActivityTimestamp(event.timestamp) : 'Pending confirmation';
        return (
          <li className="activity-row" key={event.id}>
            <span aria-hidden="true" className={`activity-icon action-${event.action}`}>
              {marketActivitySymbol(event.action)}
            </span>
            <div className="activity-main">
              <strong>{marketActivityLabel(event.action)}</strong>
              {asset ? (
                <Link to={`/asset/${collectionId}/${asset.id}`}>{asset.name}</Link>
              ) : (
                <span>{shortActivityValue(event.processId)}</span>
              )}
              <small className={detail ? undefined : 'activity-time-only'}>
                {detail}
                <span className="activity-mobile-time">
                  {detail ? ' · ' : ''}
                  {timestamp}
                </span>
              </small>
            </div>
            <div className="activity-meta">
              <div className="activity-actor">
                <span>Actor</span>
                {event.actor ? <WalletAddress address={event.actor} label="actor" /> : <strong>Unknown</strong>}
              </div>
              <div className="activity-block">
                <span className="activity-desktop-time">{timestamp}</span>
                <a
                  aria-label={
                    event.height > 0
                      ? `View submitted transaction included in block ${event.height.toLocaleString()}`
                      : 'View submitted transaction'
                  }
                  href={transactionExplorerUrl(event.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="activity-transaction-long" aria-hidden="true">
                    {event.height > 0
                      ? `View submitted transaction · included in block ${event.height.toLocaleString()}`
                      : 'View submitted transaction'}
                  </span>
                  <span className="activity-transaction-short" aria-hidden="true">
                    View transaction
                  </span>
                  <ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
                </a>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
export function marketActivityLabel(action: CollectionActivityEvent['action']) {
  return {
    'make-offer': 'Listing submitted',
    'register-interest': 'Purchase submitted',
    transfer: 'Transfer submitted',
    'cancel-order': 'Cancellation submitted',
  }[action];
}

export function marketActivityDetail(event: CollectionActivityEvent) {
  if (event.action === 'make-offer' && event.asking) return `${winstonToAr(event.asking)} AR total`;
  if (event.action === 'transfer' && event.recipient) return `To ${shortActivityValue(event.recipient)}`;
  if (event.action === 'register-interest' && event.orderId) return `Order ${shortActivityValue(event.orderId)}`;
  if (event.action === 'cancel-order' && event.orderId) return `Order ${shortActivityValue(event.orderId)}`;
  return '';
}

export function formatMarketActivityTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000));
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

function shortActivityValue(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-5)}`;
}

function winstonToAr(value: string) {
  return (Number(value) / 1_000_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 12 });
}
