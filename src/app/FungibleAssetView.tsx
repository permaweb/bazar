import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  CircleX,
  FileText,
  Grid2X2,
  Layers3,
  RefreshCw,
  Send,
  ShoppingCart,
  Tag,
  X,
} from 'lucide-react';
import {
  SwapPurchase,
  type Consensus,
  type ObserverView,
  type PreparedTransaction,
  type PurchaseSnapshot,
  type PurchaseState,
} from 'weave-wrangler';

import type { CollectionActivityEvent } from 'api/asset-discovery';
import type { AssetSummary, Collection } from 'api/collections';
import {
  bestAskOfAsset,
  compareOrderUnitPrice,
  licenseProperties,
  listedBalanceOf,
  liquidBalanceOf,
  liveOrdersOfAsset,
  openOrdersOfAsset,
  readAssetState,
  type AssetState,
  type SwapOrder,
} from 'api/asset-marketplace';
import { transactionExplorerUrl } from 'api/arweave-explorer';
import {
  filledOrder,
  formatTokenAmount,
  matchOrderFills,
  parseTokenAmount,
  type OrderFill,
} from 'api/order-matching';
import { ArweaveObserverNetwork } from 'api/arweave-observers';
import { assetObserverNetworkOptions } from 'api/asset-observers';
import {
  AssetTransactionClient,
  DEFAULT_REGISTRATION_FEE,
  dispatchAndConfirm,
  type PreparedPurchase,
} from 'api/asset-transactions';
import { ArweaveTransactionSync, type ArweaveSyncStep } from 'components/ArweaveTransactionSync';
import { ArtworkImage } from 'components/ArtworkImage';
import { ConnectWalletButton } from 'components/ConnectWalletButton';
import { OperationOutcome, OperationOutcomeAnnouncement } from 'components/OperationOutcomeAnnouncement';
import { StateVerification } from 'components/StateVerification';
import { TokenArtwork } from 'components/TokenArtwork';
import {
  UnavailableOperationRecoveryNotice,
  type UnavailableOperationRecovery,
} from 'components/UnavailableOperationRecovery';
import { WalletAddress } from 'components/WalletAddress';
import { optionalMotionBehavior } from 'helpers/motion';
import { useWallet } from 'providers/WalletProvider';
import { useDialogFocus } from './useDialogFocus';
import {
  marketplaceCodedError,
  marketplaceErrorMessage as errorMessage,
  marketplaceOperationFailure,
  type MarketplaceOperationFailure,
} from './marketplace-error';
import {
  acquireWalletOperationClaim,
  clearStaleWalletOperationClaim,
  discardNewlyPreparedTransactionIfAborted,
  loadWalletRecord,
  hasRecoverablePurchase,
  operationForSigner,
  operationClaimStorageKey,
  operationStorageKey,
  promoteWalletOperationClaim,
  purchaseRecoveryApprovalCount,
  repairRejectedPurchase,
  removeWalletRecoveryAndSignatures,
  removeWalletRecordIf,
  releaseWalletOperationClaim,
  shouldAutomaticallyResumePurchase,
  storeWalletRecordOrThrow,
  walletOperationStorageChange,
  type OperationSession,
  type WalletOperationClaim,
} from './operation-session';

type Props = {
  asset: AssetSummary;
  collection: Collection;
  collectionIndexNotice?: React.ReactNode;
  state: AssetState;
  activity: CollectionActivityEvent[];
  activityLoading: boolean;
  activityError: string | null;
  onActivityRetry(): void;
  loading: boolean;
  error: string | null;
  provider: string;
  verifiedAt: number | null;
  onRefresh(): Promise<void>;
};

type BatchEntry = {
  order: SwapOrder;
  fillQuantity: string;
  snapshot: PurchaseSnapshot;
  paymentCost: string;
};

type BatchResume = {
  version: 3;
  buyer: string;
  startingBalance: string;
  entries: BatchEntry[];
  attemptId?: string;
};

type FungibleOperation =
  | { kind: 'sell'; quantity?: string; unitPrice?: string; resumeId?: string }
  | {
      kind: 'transfer';
      quantity?: string;
      recipient?: string;
      startingSlot?: number;
      resumeId?: string;
    }
  | { kind: 'cancel'; order: SwapOrder; startingSlot?: number; resumeId?: string }
  | {
      kind: 'buy';
      availableOrders: SwapOrder[];
      startingBalance: string;
      selectedOrders?: SwapOrder[];
      resume?: BatchResume;
    };

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;
const SETTLEMENT_PANEL_ID = 'fungible-settlement-panel';
const SETTLEMENT_ERROR_PANEL_ID = 'fungible-settlement-error-panel';

export function FungibleAssetView({
  asset,
  collection,
  collectionIndexNotice,
  state,
  activity,
  activityLoading,
  activityError,
  onActivityRetry,
  loading,
  error,
  provider,
  verifiedAt,
  onRefresh,
}: Props) {
  const wallet = useWallet();
  const [operationSession, setOperationSession] = React.useState<OperationSession<FungibleOperation> | null>(null);
  const operation = operationForSigner(operationSession, wallet.address);
  const openOperation = React.useCallback(
    (next: FungibleOperation) => {
      if (wallet.address) setOperationSession({ signer: wallet.address, operation: next });
    },
    [wallet.address],
  );
  const [recoverySuppressed, setRecoverySuppressed] = React.useState(false);
  const [recoveryNotice, setRecoveryNotice] = React.useState('');
  const [unavailableRecovery, setUnavailableRecovery] = React.useState<UnavailableOperationRecovery | null>(null);
  const resumeButtonRef = React.useRef<HTMLButtonElement>(null);
  const operationFocusFallbackRef = React.useRef<HTMLHeadingElement>(null);
  const operationFocusFallback = React.useCallback(
    () => resumeButtonRef.current ?? operationFocusFallbackRef.current,
    [],
  );
  const [activeSection, setActiveSection] = React.useState<'about' | 'orders' | 'activity' | null>('orders');
  const [orderReveal, setOrderReveal] = React.useState({ assetId: asset.id, limit: 50 });
  const orderRevealStatusRef = React.useRef<HTMLParagraphElement>(null);
  const [storageVersion, setStorageVersion] = React.useState(0);
  const orders = liveOrdersOfAsset(state);
  const orderLimit = orderReveal.assetId === asset.id ? orderReveal.limit : 50;
  const visibleOrderRows = visibleOrderbookRows(orders, orderLimit);
  const openOrders = openOrdersOfAsset(state);
  const purchasableOrders = openOrders.filter(
    (order) => order.creator !== wallet.address && order.recipient !== wallet.address,
  );
  const liquid = wallet.address ? liquidBalanceOf(state, wallet.address) : '0';
  const listed = wallet.address ? listedBalanceOf(state, wallet.address) : '0';
  const ticker = state.ticker || 'TOKEN';
  const best = bestAskOfAsset(state);
  const forSale = openOrders.reduce((total, order) => total + BigInt(order.quantity), 0n).toString();
  const sellerCount = new Set(openOrders.map((order) => order.creator)).size;
  const holderAddresses = new Set(
    Object.entries(state.balances)
      .filter(([, balance]) => BigInt(balance) > 0n)
      .map(([address]) => address),
  );
  for (const order of orders) holderAddresses.add(order.creator);
  const holders = holderAddresses.size;
  const license = licenseProperties(state);
  const description = assetDescription(state, collection.description);
  const purchaseKey = wallet.address ? batchStorageKey(asset.id, wallet.address) : '';

  React.useEffect(() => {
    if (!wallet.address) return;
    const walletAddress = wallet.address;
    const claimKey = operationClaimStorageKey(asset.id, walletAddress);
    const recoveryKeys = [operationStorageKey(asset.id, walletAddress), batchStorageKey(asset.id, walletAddress)];
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== localStorage) return;
      const change = walletOperationStorageChange(event.key, event.newValue, claimKey, recoveryKeys);
      if (change === 'ignore') return;
      setRecoverySuppressed(false);
      if (change === 'claim-acquired' || change === 'claim-released') {
        if (change === 'claim-acquired') {
          setOperationSession((current) => {
            if (!current || current.signer !== walletAddress) return current;
            const active = current.operation;
            const recovering = active.kind === 'buy' ? Boolean(active.resume) : Boolean(active.resumeId);
            return recovering ? current : null;
          });
        }
        setStorageVersion((version) => version + 1);
        return;
      }
      if (change === 'recovery-updated') {
        setOperationSession((current) => {
          if (!current || current.signer !== walletAddress) return current;
          const active = current.operation;
          const recovering = active.kind === 'buy' ? Boolean(active.resume) : Boolean(active.resumeId);
          return recovering ? current : null;
        });
      } else {
        setOperationSession(null);
        void onRefresh();
      }
      setStorageVersion((version) => version + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [asset.id, onRefresh, wallet.address]);

  React.useEffect(() => {
    setRecoverySuppressed(false);
    setRecoveryNotice('');
    setUnavailableRecovery(null);
    setOperationSession(null);
  }, [asset.id, wallet.address]);
  React.useLayoutEffect(() => {
    if (recoverySuppressed) resumeButtonRef.current?.focus();
  }, [recoverySuppressed]);
  React.useEffect(() => {
    if (!wallet.address || operation || recoverySuppressed) return;
    const activeClaimKey = operationClaimStorageKey(asset.id, wallet.address);
    if (localStorage.getItem(activeClaimKey)) {
      const controller = new AbortController();
      void clearStaleWalletOperationClaim(localStorage, activeClaimKey, { signal: controller.signal })
        .then((cleared) => {
          if (!controller.signal.aborted && cleared) setStorageVersion((version) => version + 1);
        })
        .catch(() => undefined);
      return () => controller.abort();
    }
    let savedBatch: any = null;
    try {
      savedBatch = JSON.parse(localStorage.getItem(batchStorageKey(asset.id, wallet.address)) ?? 'null');
    } catch {
      localStorage.removeItem(purchaseKey);
    }
    if (isRecoverableBatch(savedBatch, wallet.address)) {
      const resume = savedBatch as BatchResume;
      const recoveryStatus = fungibleBatchRecoveryStatus(resume, state, wallet.address);
      if (recoveryStatus === 'resumable') {
        openOperation({
          kind: 'buy',
          availableOrders: resume.entries.map((entry) => entry.order),
          selectedOrders: resume.entries.map((entry) => entry.order),
          startingBalance: resume.startingBalance,
          resume,
        });
        return;
      } else {
        setRecoveryNotice(
          'A previous token purchase is paused because one or more orders are no longer available to this wallet. Its exact signed transactions remain stored, and no replacement seller payment will be created.',
        );
      }
    } else if (savedBatch !== null) {
      removeWalletRecordIf<any>(
        localStorage,
        batchStorageKey(asset.id, wallet.address),
        (current) => !isRecoverableBatch(current, wallet.address!),
      );
    }
    try {
      const pendingOperationKey = operationStorageKey(asset.id, wallet.address);
      const saved = loadWalletRecord<any>(
        localStorage,
        pendingOperationKey,
        `bazar-operation:${asset.id}`,
        (record) =>
          record?.signer === wallet.address &&
          ADDRESS.test(record?.txId ?? '') &&
          ['sell', 'cancel', 'transfer'].includes(record?.kind),
      );
      if (!saved) {
        setUnavailableRecovery((current) => (current?.key === pendingOperationKey ? null : current));
        return;
      }
      if (saved.signer !== wallet.address || !ADDRESS.test(saved.txId)) return;
      try {
        new AssetTransactionClient().restore(saved.txId, wallet.address);
      } catch {
        let canStillApply = false;
        if (saved.kind === 'cancel') {
          const order = state.orders[saved.order?.orderId];
          canStillApply = Boolean(order?.status === 'open' && order.creator === wallet.address);
        } else if (!state.orders[saved.txId]) {
          try {
            const quantity = parseTokenAmount(saved.quantity ?? '', state.denomination);
            canStillApply = BigInt(quantity) <= BigInt(liquidBalanceOf(state, wallet.address));
          } catch {
            canStillApply = false;
          }
        }
        const matches = (record: any) =>
          record?.assetId === asset.id && record?.signer === wallet.address && record?.txId === saved.txId;
        if (!canStillApply) {
          if (
            removeWalletRecoveryAndSignatures(localStorage, pendingOperationKey, matches, [saved.txId], wallet.address)
          ) {
            setUnavailableRecovery(null);
            setRecoveryNotice(
              'A stale local action was removed after current live state proved that it can no longer apply. No replacement transaction was created.',
            );
          }
        } else {
          setUnavailableRecovery({
            key: pendingOperationKey,
            kind: saved.kind,
            signer: wallet.address,
            txId: saved.txId,
          });
        }
        return;
      }
      setUnavailableRecovery(null);
      if (saved.kind === 'cancel' && saved.order) {
        openOperation({
          kind: 'cancel',
          order: saved.order,
          startingSlot: saved.startingSlot,
          resumeId: saved.txId,
        });
      } else if (saved.kind === 'sell') {
        openOperation({
          kind: 'sell',
          quantity: saved.quantity,
          unitPrice: saved.unitPrice,
          resumeId: saved.txId,
        });
      } else if (saved.kind === 'transfer') {
        openOperation({
          kind: 'transfer',
          quantity: saved.quantity,
          recipient: saved.recipient,
          startingSlot: saved.startingSlot,
          resumeId: saved.txId,
        });
      }
    } catch {
      if (wallet.address) localStorage.removeItem(operationStorageKey(asset.id, wallet.address));
    }
  }, [asset.id, openOperation, operation, purchaseKey, recoverySuppressed, state, storageVersion, wallet.address]);

  const showAssetSection = (section: 'about' | 'orders' | 'activity') => {
    setActiveSection(section);
    const target = document.getElementById(`asset-${section}`);
    if (target instanceof HTMLDetailsElement) target.open = true;
    window.requestAnimationFrame(() => target?.scrollIntoView({ behavior: optionalMotionBehavior(), block: 'start' }));
  };
  const syncActiveSection = (section: 'about' | 'orders' | 'activity', open: boolean) => {
    setActiveSection((current) => (open ? section : current === section ? null : current));
  };
  const recoveryBlocksActions = recoverySuppressed || Boolean(unavailableRecovery);

  return (
    <section className="asset-page asset-detail-page fungible-asset-page">
      {recoverySuppressed ? (
        <div className="pending-operation-notice">
          <span role="status">
            Local tracking is paused. Resume here to continue observing signed work or review any wallet approvals still
            required.
          </span>
          <button
            ref={resumeButtonRef}
            className="with-icon"
            type="button"
            onClick={() => setRecoverySuppressed(false)}
          >
            <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Resume pending action
          </button>
        </div>
      ) : null}
      {recoveryNotice ? (
        <div className="pending-operation-notice">
          <span role="status">{recoveryNotice}</span>
          <button type="button" onClick={() => setRecoveryNotice('')}>
            Dismiss
          </button>
        </div>
      ) : null}
      {unavailableRecovery ? (
        <UnavailableOperationRecoveryNotice
          recovery={unavailableRecovery}
          stateNoun="balances and orders above"
          onRefresh={() => void onRefresh()}
          onDiscard={() => {
            const removed = removeWalletRecoveryAndSignatures<any>(
              localStorage,
              unavailableRecovery.key,
              (record) => record?.signer === unavailableRecovery.signer && record?.txId === unavailableRecovery.txId,
              [unavailableRecovery.txId],
              unavailableRecovery.signer,
            );
            if (removed) {
              setUnavailableRecovery(null);
              setRecoveryNotice(
                'Local tracking was discarded. Current balances and orders above remain the live source of truth.',
              );
            }
          }}
        />
      ) : null}
      <div className="asset-detail-layout">
        <div className="asset-commerce-column asset-commerce-primary">
          <div className="asset-details asset-identity">
            <div className="asset-kicker">
              <Link className="asset-collection-link" to={`/collection/${collection.id}`}>
                {collection.name}
              </Link>
            </div>
            <h1 ref={operationFocusFallbackRef} tabIndex={-1}>
              {asset.name}
            </h1>
            <div className="asset-owner-line">
              <span>
                {loading || error
                  ? wallet.address
                    ? 'Last verified balance'
                    : 'Last verified supply'
                  : wallet.address
                    ? 'Your liquid balance'
                    : 'Circulating supply'}
              </span>
              <strong>{tokenLabel(wallet.address ? liquid : state.totalSupply, state)}</strong>
            </div>
            <div className="asset-token-tags" aria-label="Token protocol details">
              <span>{state.device}</span>
              <span>{ticker}</span>
              <span>{state.denomination} decimals</span>
            </div>
            <StateVerification
              provider={provider}
              verifiedAt={verifiedAt}
              refreshing={loading}
              failed={Boolean(error)}
            />
            {loading ? <Loading label="Computing current state…" /> : null}
            {error ? <ErrorPanel message={error} /> : null}
            <section className="asset-commerce-card">
              <div className="asset-market-stats">
                <div>
                  <span>Verified unit price</span>
                  <strong>{best ? orderPriceLabel(best, state) : 'Not listed'}</strong>
                </div>
                <div>
                  <span>For sale</span>
                  <strong>{tokenLabel(forSale, state)}</strong>
                </div>
                <div>
                  <span>Your listed</span>
                  <strong>{wallet.address ? tokenLabel(listed, state) : '—'}</strong>
                </div>
                <div>
                  <span>Holders</span>
                  <strong>{holders.toLocaleString()}</strong>
                </div>
              </div>
              <div className="asset-buy-summary">
                <span>Open listings</span>
                <strong>
                  {openOrders.length
                    ? `${openOrders.length} from ${sellerCount} ${sellerCount === 1 ? 'seller' : 'sellers'}`
                    : 'None yet'}
                </strong>
              </div>
              <div className="asset-commerce-actions">
                {!wallet.address ? <ConnectWalletButton /> : null}
                {wallet.address && purchasableOrders.length ? (
                  <button
                    className="primary with-icon"
                    disabled={recoveryBlocksActions || loading || Boolean(error)}
                    onClick={() =>
                      openOperation({ kind: 'buy', availableOrders: purchasableOrders, startingBalance: liquid })
                    }
                  >
                    <ShoppingCart className="ui-icon ui-icon--sm" aria-hidden="true" /> Buy from order book
                  </button>
                ) : null}
                {wallet.address && BigInt(liquid) > 0n ? (
                  <button
                    className={`${purchasableOrders.length ? '' : 'primary '}with-icon`}
                    disabled={recoveryBlocksActions || loading || Boolean(error)}
                    onClick={() => openOperation({ kind: 'sell' })}
                  >
                    <Tag className="ui-icon ui-icon--sm" aria-hidden="true" /> List tokens
                  </button>
                ) : null}
                {wallet.address && BigInt(liquid) > 0n ? (
                  <button
                    className="with-icon"
                    disabled={recoveryBlocksActions || loading || Boolean(error)}
                    onClick={() => openOperation({ kind: 'transfer' })}
                  >
                    <Send className="ui-icon ui-icon--sm" aria-hidden="true" /> Transfer
                  </button>
                ) : null}
                <button
                  aria-disabled={loading}
                  className="with-icon"
                  onClick={() => {
                    if (!loading) void onRefresh();
                  }}
                >
                  <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </section>
          </div>
        </div>
        <div className="asset-visual-column">
          <div className={`asset-hero-media${asset.image ? '' : ' token-hero'}`}>
            {asset.image ? (
              <ArtworkImage src={asset.image} alt={asset.name} loading="eager" />
            ) : (
              <TokenArtwork ticker={ticker} />
            )}
            {asset.image ? (
              <div className="asset-media-label">
                <span>Permanent asset</span>
                <strong>{asset.contentType ?? 'image'}</strong>
              </div>
            ) : null}
          </div>
        </div>
        <div className="asset-commerce-column asset-commerce-secondary">
          {collectionIndexNotice}
          <nav className="asset-section-tabs" aria-label="Token detail sections">
            {(['about', 'orders', 'activity'] as const).map((section) => (
              <button
                aria-controls={`asset-${section}`}
                aria-current={activeSection === section ? 'true' : undefined}
                className={activeSection === section ? 'active' : undefined}
                key={section}
                onClick={() => showAssetSection(section)}
                type="button"
              >
                {section === 'about' ? 'Details' : section[0].toUpperCase() + section.slice(1)}
              </button>
            ))}
          </nav>
          <div className="asset-accordion-list">
            <details
              id="asset-orders"
              open
              onToggle={(event) => {
                syncActiveSection('orders', event.currentTarget.open);
              }}
            >
              <summary>
                <span className="asset-accordion-icon">
                  <Layers3 className="ui-icon" aria-hidden="true" />
                </span>
                <strong>Order book</strong>
                <span className="asset-accordion-count">{orders.length} live</span>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                <div
                  aria-label={`${asset.name} order book`}
                  className="orderbook-table fungible-orderbook"
                  role="table"
                >
                  <div className="orderbook-head" role="row">
                    <span role="columnheader">Unit price</span>
                    <span role="columnheader">Quantity</span>
                    <span role="columnheader">Total</span>
                    <span role="columnheader">Seller</span>
                    <span role="columnheader">Status</span>
                    <span aria-label="Actions" role="columnheader" />
                  </div>
                  {visibleOrderRows.map((order) => {
                    const own = order.creator === wallet.address;
                    return (
                      <div className="orderbook-row" key={order.orderId} role="row">
                        <strong data-label="Unit price" role="cell">
                          {orderPriceLabel(order, state)}
                        </strong>
                        <span data-label="Quantity" role="cell">
                          {tokenLabel(order.quantity, state)}
                        </span>
                        <span data-label="Total" role="cell">
                          {winstonToAr(order.asking)} AR
                        </span>
                        <span data-label="Seller" role="cell">
                          <WalletAddress address={order.creator} label="seller" />
                        </span>
                        <span className={`order-status ${order.status}`} data-label="Status" role="cell">
                          {order.status}
                        </span>
                        <span className="orderbook-action-cell" role="cell">
                          {own && order.status === 'open' ? (
                            <button
                              aria-label={fungibleOrderActionLabel('cancel', order, state)}
                              className="order-action"
                              disabled={recoveryBlocksActions || loading || Boolean(error)}
                              onClick={() => openOperation({ kind: 'cancel', order })}
                            >
                              Cancel
                            </button>
                          ) : wallet.address && !own && order.status === 'open' ? (
                            <button
                              aria-label={fungibleOrderActionLabel('buy', order, state)}
                              className="order-action"
                              disabled={recoveryBlocksActions || loading || Boolean(error)}
                              onClick={() =>
                                openOperation({
                                  kind: 'buy',
                                  availableOrders: [order],
                                  selectedOrders: [order],
                                  startingBalance: liquid,
                                })
                              }
                            >
                              Buy
                            </button>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                  {!orders.length ? (
                    <div className="orderbook-empty" role="row">
                      <div aria-colspan={6} className="orderbook-empty-cell" role="cell">
                        <strong>No open asks</strong>
                        <span>Token holders can list any whole lot directly from their wallet.</span>
                      </div>
                    </div>
                  ) : null}
                </div>
                {orders.length > 50 ? (
                  <div className="orderbook-reveal">
                    <p aria-atomic="true" aria-live="polite" ref={orderRevealStatusRef} role="status" tabIndex={-1}>
                      Showing {visibleOrderRows.length.toLocaleString()} of {orders.length.toLocaleString()} live
                      orders.
                    </p>
                    {visibleOrderRows.length < orders.length ? (
                      <button
                        type="button"
                        onClick={() => {
                          const next = Math.min(orders.length, orderLimit + 50);
                          setOrderReveal({ assetId: asset.id, limit: next });
                          if (next === orders.length) {
                            window.requestAnimationFrame(() => orderRevealStatusRef.current?.focus());
                          }
                        }}
                      >
                        Show {Math.min(50, orders.length - visibleOrderRows.length).toLocaleString()} more orders
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <p className="market-note">
                          Every row is live escrowed liquidity from the last verified process state. Buy any amount from one
                          order or let Bazar route across the best prices automatically.
                </p>
              </div>
            </details>
            <details
              id="asset-about"
              onToggle={(event) => {
                syncActiveSection('about', event.currentTarget.open);
              }}
            >
              <summary>
                <span className="asset-accordion-icon">
                  <Grid2X2 className="ui-icon" aria-hidden="true" />
                </span>
                <strong>Token details</strong>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                <p className="asset-description">{description}</p>
                <div className="asset-detail-facts">
                  <div>
                    <span>Ticker</span>
                    <strong>{ticker}</strong>
                  </div>
                  <div>
                    <span>Total supply</span>
                    <strong>{tokenLabel(state.totalSupply, state)}</strong>
                  </div>
                  <div>
                    <span>Atomic precision</span>
                    <strong>{state.denomination} decimals</strong>
                  </div>
                  <div>
                    <span>Settlement</span>
                    <strong>Native AR</strong>
                  </div>
                </div>
              </div>
            </details>
            <details
              id="asset-activity"
              onToggle={(event) => {
                syncActiveSection('activity', event.currentTarget.open);
              }}
            >
              <summary>
                <span className="asset-accordion-icon">
                  <BarChart3 className="ui-icon" aria-hidden="true" />
                </span>
                <strong>Market activity</strong>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                {activityLoading ? (
                  <Loading label={activity.length ? 'Refreshing market history…' : 'Reading indexed market history…'} />
                ) : null}
                <div className="asset-history-actions">
                  <button
                    aria-disabled={activityLoading}
                    className="with-icon"
                    type="button"
                    onClick={() => {
                      if (!activityLoading) onActivityRetry();
                    }}
                  >
                    <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
                    {activityLoading
                      ? activity.length
                        ? 'Refreshing history…'
                        : 'Loading history…'
                      : activityError
                        ? 'Retry history'
                        : 'Refresh history'}
                  </button>
                </div>
                {activityError ? (
                  <div className="inline-error" role={activity.length ? 'status' : 'alert'}>
                    <span>
                      Market history could not be read.{' '}
                      {activity.length ? `Previously loaded events remain visible. ${activityError}` : activityError}
                    </span>
                  </div>
                ) : null}
                {activity.length ? (
                  <div className="asset-history-list">
                    {activity.map((event) => (
                      <a key={event.id} href={transactionExplorerUrl(event.id)} target="_blank" rel="noreferrer">
                        <span>
                          {activityLabel(event.action)}
                          {activityDetail(event, state) ? ` · ${activityDetail(event, state)}` : ''}
                        </span>
                        <time>{event.timestamp ? formatTimestamp(event.timestamp) : 'Pending timestamp'}</time>
                        <ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {!activityLoading && !activityError && !activity.length ? (
                  <p className="asset-empty-copy">No indexed market events found.</p>
                ) : null}
                <p className="market-note">
                  Up to 24 recent signed process submissions indexed from Arweave. Live balances and orders above remain
                  authoritative.
                </p>
              </div>
            </details>
            <details>
              <summary>
                <span className="asset-accordion-icon">
                  <FileText className="ui-icon" aria-hidden="true" />
                </span>
                <strong>Usage rights</strong>
                <span className="asset-accordion-count">{license.length || '—'}</span>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                {license.length ? (
                  <dl className="license-properties">
                    {license.map((property) => (
                      <div key={property.key}>
                        <dt>{property.label}</dt>
                        <dd>{property.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="asset-empty-copy">No UDL terms declared.</p>
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
      {operation && operationSession ? (
        <FungibleOperationDialog
          asset={asset}
          state={state}
          owner={operationSession.signer}
          operation={operation}
          restoreFallback={operationFocusFallback}
          onClose={(resumeLater, refresh = true) => {
            setRecoverySuppressed(Boolean(resumeLater));
            setOperationSession(null);
            if (refresh) void onRefresh();
          }}
        />
      ) : null}
    </section>
  );
}

function FungibleOperationDialog({
  asset,
  state,
  owner,
  operation,
  restoreFallback,
  onClose,
}: {
  asset: AssetSummary;
  state: AssetState;
  owner: string;
  operation: FungibleOperation;
  restoreFallback(): HTMLElement | null;
  onClose(resumeLater?: boolean, refresh?: boolean): void;
}) {
  const recoveryApprovalCount =
    operation.kind === 'buy' && operation.resume ? batchPurchaseRecoveryApprovalCount(operation.resume.entries) : 0;
  const eligible = React.useMemo(
    () => (operation.kind === 'buy' ? operation.availableOrders.filter((order) => order.status === 'open') : []),
    [operation.kind, operation.kind === 'buy' ? operation.availableOrders : undefined],
  );
  const initialSelected = React.useMemo(
    () =>
      operation.kind === 'buy'
        ? (operation.selectedOrders ?? operation.resume?.entries.map((entry) => entry.order) ?? [])
        : [],
    [
      operation.kind,
      operation.kind === 'buy' ? operation.selectedOrders : undefined,
      operation.kind === 'buy' ? operation.resume : undefined,
    ],
  );
  const initialQuantity = operation.kind === 'buy' && operation.resume
    ? formatTokenAmount(
        operation.resume.entries.reduce((total, entry) => total + BigInt(entry.fillQuantity), 0n).toString(),
        state.denomination,
      )
    : initialSelected.length
      ? formatTokenAmount(
          initialSelected.reduce((total, order) => total + BigInt(order.quantity), 0n).toString(),
          state.denomination,
        )
      : '';
  const [quantity, setQuantity] = React.useState(
    operation.kind === 'sell' || operation.kind === 'transfer' ? (operation.quantity ?? '') : initialQuantity,
  );
  const [unitPrice, setUnitPrice] = React.useState(operation.kind === 'sell' ? (operation.unitPrice ?? '') : '');
  const [recipient, setRecipient] = React.useState(operation.kind === 'transfer' ? (operation.recipient ?? '') : '');
  const [phase, setPhase] = React.useState<'form' | 'approval' | 'working' | 'done' | 'error'>(
    operation.kind === 'buy' && operation.resume
      ? recoveryApprovalCount
        ? 'approval'
        : 'working'
      : operation.kind !== 'buy' && operation.resumeId
        ? 'working'
        : 'form',
  );
  const [message, setMessage] = React.useState('');
  const [failureKind, setFailureKind] = React.useState<MarketplaceOperationFailure | null>(null);
  const [views, setViews] = React.useState<ObserverView[]>([]);
  const [confirmations, setConfirmations] = React.useState(0);
  const [consensus, setConsensus] = React.useState<Consensus | null>(null);
  const [transaction, setTransaction] = React.useState<PreparedTransaction | null>(null);
  const [purchaseStates, setPurchaseStates] = React.useState<Record<string, PurchaseState>>({});
  const purchaseStateBufferRef = React.useRef<ReturnType<typeof purchaseStateFrameBuffer> | null>(null);
  if (!purchaseStateBufferRef.current) {
    purchaseStateBufferRef.current = purchaseStateFrameBuffer((updates) => {
      setPurchaseStates((current) => ({ ...current, ...updates }));
    });
  }
  const batchRecoveryBufferRef = React.useRef<ReturnType<typeof batchRecoveryFrameBuffer> | null>(null);
  const [activeOrderId, setActiveOrderId] = React.useState(initialSelected[0]?.orderId ?? '');
  const [estimatedCost, setEstimatedCost] = React.useState<string | null>(null);
  const [estimatedWalletBalance, setEstimatedWalletBalance] = React.useState<string | null>(null);
  const [canAfford, setCanAfford] = React.useState<boolean | null>(null);
  const [quoteState, setQuoteState] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [quoteRetry, setQuoteRetry] = React.useState(0);
  const [settlementAnnouncement, setSettlementAnnouncement] = React.useState('');
  const settlementAnnouncementKeyRef = React.useRef('');
  const purchasesRef = React.useRef<Map<string, SwapPurchase>>(new Map());
  const networkRef = React.useRef<ArweaveObserverNetwork | null>(null);
  const claimRef = React.useRef<WalletOperationClaim | null>(null);
  const exactActionBaselineRef = React.useRef<{ startingSlot: number } | null>(
    (operation.kind === 'cancel' || operation.kind === 'transfer') && Number.isSafeInteger(operation.startingSlot)
      ? { startingSlot: operation.startingSlot! }
      : (operation.kind === 'cancel' || operation.kind === 'transfer') && operation.resumeId
        ? { startingSlot: 0 }
        : null,
  );
  const attemptRef = React.useRef(new AbortController());
  const cleanupTimerRef = React.useRef<number | undefined>();
  const resumed = React.useRef(false);
  const ticker = state.ticker || 'TOKEN';
  const automaticMatchResult = React.useMemo(() => {
    if (operation.kind !== 'buy') return { match: null, error: '' };
    try {
      const atomic = parseTokenAmount(quantity, state.denomination);
      const match = matchOrderFills(eligible, atomic);
      return {
        match,
        error: match
          ? ''
          : `Only ${tokenLabel(
              eligible.reduce((total, order) => total + BigInt(order.quantity), 0n).toString(),
              state,
            )} is currently available.`,
      };
    } catch (cause) {
      return {
        match: null,
        error:
          cause instanceof RangeError
            ? 'This order book is too large to quote safely. Refresh and try again.'
            : quantity
              ? `Enter a valid ${ticker} amount using no more than ${state.denomination} decimal places.`
              : '',
      };
    }
  }, [eligible, operation.kind, quantity, state, state.denomination, ticker]);
  const automaticMatch = automaticMatchResult.match;
  const matchedFills = automaticMatch?.fills ?? [];
  const matchedOrders = matchedFills.map((fill) => fill.order);
  const matchedQuantity = matchedOrders.reduce((total, order) => total + BigInt(order.quantity), 0n);
  const matchedAsking = matchedOrders.reduce((total, order) => total + BigInt(order.asking), 0n);
  const matchedSellers = new Set(matchedOrders.map((order) => order.creator)).size;
  const marketAvailable = eligible.reduce((total, order) => total + BigInt(order.quantity), 0n);
  const bestEligible = React.useMemo(
    () => [...eligible].sort(compareOrderUnitPrice)[0],
    [eligible],
  );
  const enteredQuantity = safeTokenAmount(quantity, state.denomination);
  const currentLiquid = BigInt(liquidBalanceOf(state, owner));
  const currentListed = BigInt(listedBalanceOf(state, owner));
  const listingQuote = operation.kind === 'sell' ? safeLotQuote(quantity, unitPrice, state) : null;
  const unitPriceValid = safeArPrice(unitPrice);
  const transferRecipient =
    operation.kind === 'transfer' ? (operation.recipient ?? recipient).trim() : recipient.trim();
  const recipientError = operation.kind === 'transfer' ? fungibleTransferRecipientError(transferRecipient, owner) : '';
  const sellValid =
    operation.kind === 'sell' &&
    enteredQuantity !== null &&
    enteredQuantity <= currentLiquid &&
    unitPriceValid &&
    listingQuote !== null;
  const transferValid =
    operation.kind === 'transfer' && !recipientError && enteredQuantity !== null && enteredQuantity <= currentLiquid;
  const quantityGuidanceId = React.useId();
  const priceGuidanceId = React.useId();
  const recipientGuidanceId = React.useId();
  const amountGuidanceId = React.useId();
  const quoteStatusId = React.useId();
  const dialogTitleId = React.useId();
  const operationLabelId = React.useId();

  React.useEffect(() => {
    if (cleanupTimerRef.current !== undefined) window.clearTimeout(cleanupTimerRef.current);
    return () => {
      cleanupTimerRef.current = window.setTimeout(() => {
        batchRecoveryBufferRef.current?.flush();
        batchRecoveryBufferRef.current = null;
        purchaseStateBufferRef.current?.clear();
        attemptRef.current.abort();
        for (const purchase of purchasesRef.current.values()) purchase.abandon();
        networkRef.current?.stop();
        if (claimRef.current) {
          releaseWalletOperationClaim(localStorage, claimRef.current);
          claimRef.current = null;
        }
      }, 0);
    };
  }, []);

  React.useEffect(() => {
    if (operation.kind !== 'buy' || !matchedOrders.length || operation.resume) {
      setEstimatedCost(null);
      setEstimatedWalletBalance(null);
      setCanAfford(null);
      setQuoteState('idle');
      return;
    }
    const controller = new AbortController();
    const client = new AssetTransactionClient();
    setEstimatedCost(null);
    setEstimatedWalletBalance(null);
    setCanAfford(null);
    setQuoteState('loading');
    const quoteTimer = window.setTimeout(() => {
      void Promise.all([
        client.estimatePurchaseBatchCosts(matchedOrders, asset.id, controller.signal),
        client.walletBalance(owner, controller.signal),
      ])
        .then(([costs, walletBalance]) => {
          if (!controller.signal.aborted) {
            const total = costs.reduce((sum, item) => sum + BigInt(item.total), 0n);
            setEstimatedCost(total.toString());
            setEstimatedWalletBalance(walletBalance.toString());
            setCanAfford(walletBalance >= total);
            setQuoteState('ready');
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setEstimatedCost(null);
            setEstimatedWalletBalance(null);
            setCanAfford(null);
            setQuoteState('error');
          }
        });
    }, 250);
    return () => {
      window.clearTimeout(quoteTimer);
      controller.abort();
    };
  }, [
    asset.id,
    purchaseQuoteIdentity(matchedOrders),
    operation.kind,
    operation.kind === 'buy' ? operation.resume : undefined,
    owner,
    quoteRetry,
  ]);

  React.useEffect(() => {
    const shouldResume =
      (operation.kind === 'buy' &&
        operation.resume?.entries.every((entry) => shouldAutomaticallyResumePurchase(entry.snapshot))) ||
      (operation.kind !== 'buy' && operation.resumeId);
    if (!shouldResume || resumed.current) return;
    resumed.current = true;
    void submit();
  }, []);

  async function submit() {
    setMessage('');
    setFailureKind(null);
    setPhase('working');
    let attemptedTransactionId = operation.kind === 'buy' ? undefined : (operation.resumeId ?? transaction?.id);
    try {
      const freshOperation = operation.kind === 'buy' ? !operation.resume : !operation.resumeId && !transaction;
      const signal = attemptRef.current.signal;
      const operationKey = operationStorageKey(asset.id, owner);
      const purchaseKey = batchStorageKey(asset.id, owner);
      const resumeTransactionId = operation.kind === 'buy' ? undefined : (operation.resumeId ?? transaction?.id);
      let exactActionBaseline = exactActionBaselineRef.current;
      let freshState: AssetState | undefined;
      claimRef.current = await acquireWalletOperationClaim(
        localStorage,
        operationClaimStorageKey(asset.id, owner),
        [operationKey, purchaseKey],
        {
          ...(freshOperation
            ? {}
            : operation.kind === 'buy' && operation.resume
              ? {
                  recovery: {
                    key: purchaseKey,
                    matches: (record: any) =>
                      record?.buyer === owner &&
                      (record?.attemptId ?? batchRecoveryIdentity(record?.entries ?? [])) ===
                        (operation.resume?.attemptId ?? batchRecoveryIdentity(operation.resume?.entries ?? [])),
                  },
                }
              : {
                  recovery: {
                    key: operationKey,
                    matches: (record: any) => record?.txId === resumeTransactionId,
                  },
                }),
        },
      );
      if (freshOperation) {
        ({ state: freshState } = await readAssetState(asset.id, { signal, maxAge: 0 }));
        const expectedOrders =
          operation.kind === 'buy'
            ? matchedFills.map((fill) => fill.sourceOrder)
            : operation.kind === 'cancel'
              ? [operation.order]
              : [];
        const rawQuantity =
          operation.kind === 'sell' || operation.kind === 'transfer'
            ? parseTokenAmount(quantity, state.denomination)
            : '0';
        if (
          fungibleOperationStateError(
            operation.kind,
            freshState,
            owner,
            expectedOrders,
            rawQuantity,
            state.denomination,
          )
        ) {
          throw new Error('market-state-changed');
        }
        if (operation.kind === 'cancel' || operation.kind === 'transfer') {
          const startingSlot = Number(freshState.raw['at-slot']);
          if (!Number.isSafeInteger(startingSlot) || startingSlot < 0) {
            throw new Error('asset-action-starting-slot-unavailable');
          }
          exactActionBaseline = { startingSlot };
          exactActionBaselineRef.current = exactActionBaseline;
        }
      }
      const client = new AssetTransactionClient();
      if (operation.kind === 'buy') {
        if (!operation.resume && !matchedFills.length) throw new Error('Enter an amount available from the order book.');
        await runPurchaseBatch(
          client,
          operation.resume?.entries ??
            matchedFills.map((fill) => ({
              order: fill.sourceOrder,
              fillQuantity: fill.order.quantity,
              snapshot: {},
            })),
          operation.resume,
          batchPurchaseStartingBalance(operation.resume, freshState, owner, operation.startingBalance),
        );
        return;
      }

      let prepared: PreparedTransaction;
      let newlyPrepared = false;
      let rawQuantity = '';
      let asking = '';
      if (operation.kind === 'transfer') {
        const transferError = fungibleTransferRecipientError(transferRecipient, owner);
        if (transferError) throw new Error(transferError);
      }
      if (transaction) prepared = transaction;
      else if (operation.resumeId) prepared = client.restore(operation.resumeId, owner);
      else if (operation.kind === 'sell') {
        rawQuantity = parseTokenAmount(quantity, state.denomination);
        if (BigInt(rawQuantity) < 1n || BigInt(rawQuantity) > BigInt(liquidBalanceOf(state, owner))) {
          throw new Error('Enter a quantity within your liquid balance.');
        }
        asking = lotAsking(rawQuantity, unitPrice, state.denomination);
        prepared = await client.makeOffer(
          { processId: asset.id, quantity: rawQuantity, asking, seller: owner },
          signal,
        );
        newlyPrepared = true;
      } else if (operation.kind === 'cancel') {
        prepared = await client.cancelOrder(asset.id, operation.order.orderId, owner, signal);
        newlyPrepared = true;
      } else {
        rawQuantity = parseTokenAmount(quantity, state.denomination);
        if (BigInt(rawQuantity) < 1n || BigInt(rawQuantity) > BigInt(liquidBalanceOf(state, owner))) {
          throw new Error('Enter a quantity within your liquid balance.');
        }
        prepared = await client.transfer(asset.id, transferRecipient, rawQuantity, owner, signal);
        newlyPrepared = true;
      }
      if (discardNewlyPreparedTransactionIfAborted(localStorage, prepared.id, newlyPrepared, signal)) {
        throw signal.reason;
      }
      attemptedTransactionId = prepared.id;
      setTransaction(prepared);
      if ((operation.kind === 'cancel' || operation.kind === 'transfer') && !exactActionBaseline) {
        throw new Error('asset-action-recovery-baseline-missing');
      }
      const operationRecord = {
        txId: prepared.id,
        kind: operation.kind,
        assetId: asset.id,
        signer: owner,
        ...(operation.kind === 'cancel'
          ? { order: operation.order, startingSlot: exactActionBaseline!.startingSlot }
          : operation.kind === 'sell'
            ? { quantity, unitPrice }
            : {
                quantity,
                recipient: transferRecipient,
                startingSlot: exactActionBaseline!.startingSlot,
              }),
        createdAt: Date.now(),
      };
      try {
        const matches = (current: any) => current?.txId === prepared.id;
        if (claimRef.current) {
          promoteWalletOperationClaim(
            localStorage,
            claimRef.current,
            operationStorageKey(asset.id, owner),
            operationRecord,
            matches,
          );
        } else {
          storeWalletRecordOrThrow<any>(
            localStorage,
            operationStorageKey(asset.id, owner),
            operationRecord,
            matches,
            true,
          );
        }
      } catch (cause) {
        localStorage.removeItem(`bazar-signed-transaction:${prepared.id}`);
        setTransaction(null);
        throw cause;
      }
      setViews([]);
      setConfirmations(0);
      setConsensus(null);
      await dispatchAndConfirm(prepared, {
        signal,
        target: 5,
        onViews: setViews,
        onConsensus: setConsensus,
        onProgress: (progress) => setConfirmations(progress.confirmations),
      });
      setConfirmations(5);
      setMessage('Five confirmations reached. Waiting for live token state…');
      if (operation.kind === 'sell') {
        const expectedQuantity = rawQuantity || parseTokenAmount(operation.quantity ?? quantity, state.denomination);
        const expectedAsking =
          asking || lotAsking(expectedQuantity, operation.unitPrice ?? unitPrice, state.denomination);
        await client.waitForOfferAcceptance(
          asset.id,
          {
            orderId: prepared.id,
            seller: owner,
            quantity: expectedQuantity,
            asking: expectedAsking,
            minimumFee: DEFAULT_REGISTRATION_FEE.toString(),
          },
          signal,
        );
      } else if (operation.kind === 'cancel') {
        await client.waitForExactCancellation(
          asset.id,
          prepared.id,
          owner,
          operation.order,
          exactActionBaseline!,
          signal,
        );
      } else {
        const expectedQuantity = rawQuantity || parseTokenAmount(operation.quantity ?? quantity, state.denomination);
        if (!exactActionBaseline) throw new Error('asset-action-recovery-baseline-missing');
        await client.waitForFungibleTransfer(
          asset.id,
          prepared.id,
          owner,
          transferRecipient,
          expectedQuantity,
          exactActionBaseline,
          signal,
        );
      }
      removeWalletRecoveryAndSignatures<any>(
        localStorage,
        operationStorageKey(asset.id, owner),
        (record) => record?.txId === prepared.id,
        [prepared.id],
        owner,
      );
      if (claimRef.current) {
        releaseWalletOperationClaim(localStorage, claimRef.current);
        claimRef.current = null;
      }
      setPhase('done');
    } catch (cause) {
      if (claimRef.current) {
        releaseWalletOperationClaim(localStorage, claimRef.current);
        claimRef.current = null;
      }
      networkRef.current?.stop();
      networkRef.current = null;
      if (attemptRef.current.signal.aborted) return;
      if (
        cause instanceof Error &&
        ['asset-cancel-rejected', 'fungible-transfer-rejected'].includes(cause.message) &&
        attemptedTransactionId
      ) {
        removeWalletRecordIf<any>(
          localStorage,
          operationStorageKey(asset.id, owner),
          (record) => record?.txId === attemptedTransactionId,
        );
        localStorage.removeItem(`bazar-signed-transaction:${attemptedTransactionId}`);
        setTransaction(null);
      }
      setFailureKind(marketplaceOperationFailure(cause));
      setMessage(errorMessage(cause));
      setPhase('error');
    }
  }

  async function runPurchaseBatch(
    client: AssetTransactionClient,
    requested: Array<Pick<BatchEntry, 'order' | 'fillQuantity' | 'snapshot'>>,
    resume?: BatchResume,
    startingBalance = operation.kind === 'buy' ? operation.startingBalance : '0',
  ) {
    const network = new ArweaveObserverNetwork(assetObserverNetworkOptions());
    networkRef.current = network;
    await network.ready();
    const signal = attemptRef.current.signal;
    if (signal.aborted) throw signal.reason;
    let entries: BatchEntry[];
    const preparedByOrder = new Map<string, PreparedPurchase>();
    if (resume) entries = resume.entries;
    else {
      const prepared = await client.preparePurchaseBatch(
        requested.map(({ order, fillQuantity }) => ({
          processId: asset.id,
          order,
          fillQuantity,
          buyer: owner,
          startingBalance,
          network,
        })),
        signal,
      );
      entries = prepared.map((item) => {
        preparedByOrder.set(item.order.orderId, item);
        return preparedEntry(item);
      });
      if (signal.aborted) {
        for (const item of prepared) {
          localStorage.removeItem(`bazar-signed-transaction:${item.registration.id}`);
          localStorage.removeItem(`bazar-signed-transaction:${item.payment.id}`);
        }
        throw signal.reason;
      }
    }
    const saved: BatchResume = {
      version: 3,
      buyer: owner,
      startingBalance,
      entries,
    };
    const attemptId = batchRecoveryIdentity(entries);
    saved.attemptId = attemptId;
    try {
      if (claimRef.current) {
        promoteWalletOperationClaim(
          localStorage,
          claimRef.current,
          batchStorageKey(asset.id, owner),
          saved,
          (current) =>
            current.buyer === owner && (current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId,
        );
        if (signal.aborted) throw signal.reason;
      } else {
        storeBatchRecoveryBeforeDispatch(localStorage, batchStorageKey(asset.id, owner), saved, signal);
      }
    } catch (cause) {
      if (!signal.aborted) {
        for (const item of preparedByOrder.values()) {
          localStorage.removeItem(`bazar-signed-transaction:${item.registration.id}`);
          localStorage.removeItem(`bazar-signed-transaction:${item.payment.id}`);
        }
      }
      throw cause;
    }
    if (!activeOrderId) setActiveOrderId(entries[0].order.orderId);

    const barrierState = batchPaymentBarrierState(entries);
    let registrationsReady = barrierState.registrationsReady;
    let releasePayments!: () => void;
    let rejectPayments!: (cause: unknown) => void;
    const paymentGate = new Promise<void>((resolve, reject) => {
      releasePayments = resolve;
      rejectPayments = reject;
    });
    void paymentGate.catch(() => undefined);
    const totalPaymentCost = barrierState.pendingPaymentCost;
    let recoveryConflict: Error | null = null;
    const failRecovery = (cause: unknown) => {
      if (recoveryConflict) return;
      recoveryConflict = cause instanceof Error ? cause : new Error(String(cause));
      rejectPayments(recoveryConflict);
      for (const purchase of purchasesRef.current.values()) purchase.abandon();
    };
    const recoveryBuffer = batchRecoveryFrameBuffer(() => {
      try {
        storeWalletRecordOrThrow<BatchResume>(
          localStorage,
          batchStorageKey(asset.id, owner),
          saved,
          (current) => (current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId,
          true,
        );
      } catch (cause) {
        failRecovery(cause);
      }
    });
    batchRecoveryBufferRef.current = recoveryBuffer;

    const running = entries.map((entry) => {
      if (recoveryConflict) throw recoveryConflict;
      const adapter = client.purchaseAdapter({
        processId: asset.id,
        order: entry.order,
        fillQuantity: entry.fillQuantity,
        buyer: owner,
        startingBalance: saved.startingBalance,
        network,
      });
      const prepared = preparedByOrder.get(entry.order.orderId);
      const waitForRegistrationAcceptance = adapter.waitForRegistrationAcceptance;
      const coordinatedAdapter = {
        ...adapter,
        ...(prepared
          ? {
              prepareBoth: async () => ({
                registration: prepared.registration,
                payment: prepared.payment,
              }),
            }
          : {}),
        waitForRegistrationAcceptance: async (
          context: Parameters<NonNullable<typeof waitForRegistrationAcceptance>>[0],
        ) => {
          try {
            await waitForRegistrationAcceptance?.(context);
            registrationsReady += 1;
            if (registrationsReady === entries.length) {
              recoveryBuffer.flush();
              if (recoveryConflict) throw recoveryConflict;
              if ((await client.walletBalance(owner, signal)) < totalPaymentCost) {
                throw new Error(
                  'The wallet no longer has enough AR to pay every reserved listing. No seller payment was sent.',
                );
              }
              recoveryBuffer.flush(true);
              if (recoveryConflict) throw recoveryConflict;
              releasePayments();
            }
            await paymentGate;
          } catch (cause) {
            rejectPayments(cause);
            throw cause;
          }
        },
      };
      const purchase = new SwapPurchase(network, coordinatedAdapter, {
        registrationTarget: 5,
        paymentTarget: 5,
        paymentSuccessDepth: 1,
        skipFrom: 2,
        propagation: 'all',
        minObservers: 2,
        ...(resume ? { resume: entry.snapshot } : {}),
      });
      purchasesRef.current.set(entry.order.orderId, purchase);
      const update = (purchaseState: PurchaseState) => {
        if (attemptRef.current.signal.aborted || recoveryConflict) return;
        purchaseStateBufferRef.current!.push(entry.order.orderId, purchaseState);
        const previousSnapshot = entry.snapshot;
        entry.snapshot = latestRecoverableSnapshot(previousSnapshot, purchase.snapshot());
        if (entry.snapshot === previousSnapshot) return;
        recoveryBuffer.schedule();
      };
      purchase.on('state', update);
      purchase.on('failed', (purchaseState) => {
        rejectPayments(
          new Error(
            purchaseState.error?.message ?? 'A reservation could not complete. No remaining seller payment was sent.',
          ),
        );
        update(purchaseState);
        const repaired = repairRejectedPurchase(entry.snapshot, purchaseState.error?.code);
        for (const id of repaired.discardIds) {
          localStorage.removeItem(`bazar-signed-transaction:${id}`);
        }
        if (repaired.snapshot !== entry.snapshot) {
          entry.snapshot = repaired.snapshot ?? {};
          recoveryBuffer.schedule();
          recoveryBuffer.flush();
        }
      });
      purchase.on('complete', update);
      update(purchase.state());
      return purchase.run();
    });

    try {
      await waitForSettlementBatch(running);
    } catch (cause) {
      recoveryBuffer.flush();
      if (signal.aborted) purchaseStateBufferRef.current!.clear();
      else purchaseStateBufferRef.current!.flush();
      if (recoveryConflict) throw recoveryConflict;
      throw cause;
    }
    recoveryBuffer.clear();
    if (batchRecoveryBufferRef.current === recoveryBuffer) batchRecoveryBufferRef.current = null;
    purchaseStateBufferRef.current!.flush();
    setMessage('Every lot is proven in its exact scheduled payment slot.');
    removeWalletRecoveryAndSignatures<BatchResume>(
      localStorage,
      batchStorageKey(asset.id, owner),
      (current) => (current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId,
      entries.flatMap((entry) => [entry.snapshot.registration?.id, entry.snapshot.payment?.id]),
      owner,
    );
    if (claimRef.current) {
      releaseWalletOperationClaim(localStorage, claimRef.current);
      claimRef.current = null;
    }
    network.stop();
    networkRef.current = null;
    setPhase('done');
  }

  const visibleFills: OrderFill[] =
    operation.kind === 'buy'
      ? operation.resume?.entries.map((entry) => ({
          sourceOrder: entry.order,
          order: filledOrder(entry.order, entry.fillQuantity),
          partial: entry.fillQuantity !== entry.order.quantity,
        })) ?? matchedFills
      : [];
  const visibleOrders = visibleFills.map((fill) => fill.order);
  const activeOrder = visibleOrders.find((order) => order.orderId === activeOrderId) ?? visibleOrders[0];
  const activeOrderIndex = activeOrder ? visibleOrders.findIndex((order) => order.orderId === activeOrder.orderId) : -1;
  const activePurchase = activeOrder ? purchaseStates[activeOrder.orderId] : undefined;
  const recoverableBatch =
    operation.kind === 'buy' &&
    (operation.resume?.entries.some((entry) => hasRecoverablePurchase(entry.snapshot)) ||
      Object.values(purchaseStates).some((purchase) => hasRecoverablePurchase(purchase)));
  const completedPurchaseQuantity = visibleOrders.reduce((total, order) => total + BigInt(order.quantity), 0n);
  const outcomeTitle =
    operation.kind === 'buy'
      ? 'Purchase complete'
      : operation.kind === 'sell'
        ? 'Tokens listed'
        : operation.kind === 'cancel'
          ? 'Listing cancelled'
          : 'Transfer complete';
  const outcomeDetail =
    operation.kind === 'buy'
      ? `${tokenLabel(completedPurchaseQuantity.toString(), state)} received from ${visibleOrders.length} ${visibleOrders.length === 1 ? 'listing' : 'listings'} · ${winstonToAr(visibleOrders.reduce((total, order) => total + BigInt(order.asking), 0n).toString())} AR paid to sellers.`
      : operation.kind === 'sell' && enteredQuantity && listingQuote
        ? `${tokenLabel(enteredQuantity.toString(), state)} listed for ${listingQuote} AR.`
        : operation.kind === 'cancel'
          ? `${tokenLabel(operation.order.quantity, state)} returned to your liquid balance.`
          : enteredQuantity
            ? `${tokenLabel(enteredQuantity.toString(), state)} sent to ${transferRecipient}.`
            : 'The live token state now reflects this action.';
  const settlementSummary = batchSettlementSummary(visibleOrders.map((order) => purchaseStates[order.orderId]));
  const incompletePurchases = visibleOrders.length - settlementSummary.settled;
  const signedWork = Boolean(transaction || recoverableBatch);
  React.useEffect(() => {
    if (operation.kind !== 'buy' || phase !== 'working') return;
    const next = nextSettlementAnnouncement(
      settlementAnnouncementKeyRef.current,
      signedWork,
      visibleOrders.length,
      settlementSummary,
    );
    if (!next) return;
    settlementAnnouncementKeyRef.current = next.key;
    setSettlementAnnouncement(next.message);
  }, [operation.kind, phase, settlementSummary.failed, settlementSummary.settled, signedWork, visibleOrders.length]);
  const purchaseSteps: ArweaveSyncStep[] = activePurchase
    ? [
        { key: 'register', label: 'Reserve listing', target: 5, transaction: activePurchase.registration },
        { key: 'pay', label: 'Pay seller', target: 5, transaction: activePurchase.payment },
      ]
    : [];
  const activeStep =
    activePurchase?.stage.includes('payment') || activePurchase?.stage === 'ownership-verifying' ? 'pay' : 'register';
  const singleSteps: ArweaveSyncStep[] = transaction
    ? [
        {
          key: operation.kind,
          label: operationLabel(operation.kind),
          target: 5,
          confirmations,
          transaction: { id: transaction.id, views, ...(consensus ? { consensus } : {}) },
        },
      ]
    : [];
  const formError =
    operation.kind === 'buy' && !matchedOrders.length
      ? quantity
        ? automaticMatchResult.error || 'That amount cannot be quoted.'
        : ''
      : '';
  const dialogRef = useDialogFocus<HTMLDivElement>(
    true,
    phase !== 'working' || transaction || recoverableBatch
      ? () =>
          onClose(
            phase === 'approval' ||
              phase === 'working' ||
              (phase === 'error' && Boolean(transaction || recoverableBatch)),
            phase !== 'form',
          )
      : undefined,
    undefined,
    phase,
    restoreFallback,
  );
  const restartPurchase = () => {
    if (!recoverableBatch) {
      setMessage('');
      setFailureKind(null);
      setPhase('form');
      return;
    }
    batchRecoveryBufferRef.current?.flush();
    attemptRef.current.abort();
    for (const purchase of purchasesRef.current.values()) purchase.abandon();
    networkRef.current?.stop();
    networkRef.current = null;
    onClose(false);
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        className={`dialog fungible-dialog${phase === 'form' ? ' dialog-form-phase' : ''}`}
        ref={dialogRef}
        role="dialog"
        aria-labelledby={`${operationLabelId} ${dialogTitleId}`}
        aria-modal="true"
        tabIndex={-1}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow" id={operationLabelId}>
              {operationLabel(operation.kind)}
            </p>
            <h2 id={dialogTitleId}>{asset.name}</h2>
          </div>
          {phase !== 'working' ? (
            <button
              className="close"
              onClick={() =>
                onClose(
                  phase === 'approval' || (phase === 'error' && Boolean(transaction || recoverableBatch)),
                  phase !== 'form',
                )
              }
              aria-label="Close dialog"
            >
              <X />
            </button>
          ) : transaction || recoverableBatch ? (
            <button className="sync-close" onClick={() => onClose(true)} type="button">
              Close and resume later
            </button>
          ) : null}
        </div>
        <OperationOutcomeAnnouncement active={phase === 'done'} title={outcomeTitle} detail={outcomeDetail} />
        {phase === 'approval' && operation.kind === 'buy' && operation.resume ? (
          <div className="recovery-approval">
            <div>
              <h3>
                {recoveryApprovalCount} new wallet {recoveryApprovalCount === 1 ? 'approval is' : 'approvals are'} still
                required
              </h3>
              <p>
                This saved batch does not contain every signed reservation and seller payment. Bazar will not ask your
                wallet to sign or submit anything else until you choose Continue.
              </p>
            </div>
            <div className="batch-quote">
              <div>
                <span>Listings</span>
                <strong>{visibleOrders.length}</strong>
              </div>
              <div>
                <span>Sellers</span>
                <strong>{new Set(visibleOrders.map((order) => order.creator)).size}</strong>
              </div>
              <div>
                <span>Seller subtotal</span>
                <strong>
                  {winstonToAr(visibleOrders.reduce((total, order) => total + BigInt(order.asking), 0n).toString())} AR
                </strong>
              </div>
              <div>
                <span>New approvals</span>
                <strong>{recoveryApprovalCount}</strong>
              </div>
            </div>
            <PurchaseRoute fills={visibleFills} state={state} />
            <button className="primary wide" data-dialog-initial onClick={() => void submit()} type="button">
              Continue with {recoveryApprovalCount} new {recoveryApprovalCount === 1 ? 'approval' : 'approvals'}
            </button>
          </div>
        ) : null}
        {phase === 'form' ? (
          <form
            className="trade-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="dialog-form-scroll">
              {operation.kind === 'sell' ? (
                <>
                  <div className="trade-balance">
                    <span>Available to list</span>
                    <strong>{tokenLabel(liquidBalanceOf(state, owner), state)}</strong>
                  </div>
                  <div className="trade-fields">
                    <label>
                      Token quantity
                      <input
                        aria-describedby={
                          quantity && (enteredQuantity === null || enteredQuantity > currentLiquid)
                            ? quantityGuidanceId
                            : undefined
                        }
                        aria-invalid={
                          Boolean(quantity) && (enteredQuantity === null || enteredQuantity > currentLiquid)
                        }
                        autoFocus
                        data-dialog-initial
                        inputMode="decimal"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        placeholder="100"
                      />
                    </label>
                    <label>
                      Price per {ticker} in AR
                      <input
                        aria-describedby={unitPrice && !unitPriceValid ? priceGuidanceId : undefined}
                        aria-invalid={Boolean(unitPrice) && !unitPriceValid}
                        inputMode="decimal"
                        value={unitPrice}
                        onChange={(event) => setUnitPrice(event.target.value)}
                        placeholder="0.01"
                      />
                    </label>
                  </div>
                  {listingQuote ? (
                    <div className="trade-quote">
                      <span>Listing total</span>
                      <strong>{listingQuote} AR</strong>
                    </div>
                  ) : null}
                  {enteredQuantity && enteredQuantity <= currentLiquid ? (
                    <div className="trade-quote">
                      <span>After network confirmation</span>
                      <strong>
                        {tokenLabel((currentLiquid - enteredQuantity).toString(), state)} liquid ·{' '}
                        {tokenLabel((currentListed + enteredQuantity).toString(), state)} listed
                      </strong>
                    </div>
                  ) : null}
                  {quantity && (enteredQuantity === null || enteredQuantity > currentLiquid) ? (
                    <p id={quantityGuidanceId} className="trade-guidance" role="alert">
                      Enter a quantity up to {tokenLabel(currentLiquid.toString(), state)}.
                    </p>
                  ) : null}
                  {unitPrice && !unitPriceValid ? (
                    <p id={priceGuidanceId} className="trade-guidance" role="alert">
                      Enter a positive AR price with no more than 12 decimal places.
                    </p>
                  ) : null}
                  <p className="settlement-disclosure">
                    Listed tokens move into order escrow after network confirmation. Network fees are shown by your
                    wallet before signing.
                  </p>
                </>
              ) : null}
              {operation.kind === 'transfer' ? (
                <>
                  <div className="trade-balance">
                    <span>Available to send</span>
                    <strong>{tokenLabel(liquidBalanceOf(state, owner), state)}</strong>
                  </div>
                  <label>
                    Recipient wallet address
                    <input
                      aria-describedby={recipient && recipientError ? recipientGuidanceId : undefined}
                      aria-invalid={Boolean(recipient) && Boolean(recipientError)}
                      autoCapitalize="none"
                      autoComplete="off"
                      autoCorrect="off"
                      autoFocus
                      data-dialog-initial
                      spellCheck={false}
                      value={recipient}
                      onChange={(event) => setRecipient(event.target.value)}
                      placeholder="43-character Arweave address"
                    />
                  </label>
                  {recipient && recipientError ? (
                    <p id={recipientGuidanceId} className="trade-guidance" role="alert">
                      {recipientError}
                    </p>
                  ) : null}
                  {recipient && !recipientError ? (
                    <div className="trade-quote">
                      <span>Recipient</span>
                      <strong>{transferRecipient}</strong>
                    </div>
                  ) : null}
                  {recipient && !recipientError ? (
                    <p className="settlement-disclosure">
                      Review the complete destination before asking your wallet to approve this irreversible transfer.
                    </p>
                  ) : null}
                  <label>
                    Token quantity
                    <input
                      aria-describedby={
                        quantity && (enteredQuantity === null || enteredQuantity > currentLiquid)
                          ? quantityGuidanceId
                          : undefined
                      }
                      aria-invalid={Boolean(quantity) && (enteredQuantity === null || enteredQuantity > currentLiquid)}
                      inputMode="decimal"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      placeholder="100"
                    />
                  </label>
                  {quantity && (enteredQuantity === null || enteredQuantity > currentLiquid) ? (
                    <p id={quantityGuidanceId} className="trade-guidance" role="alert">
                      Enter a quantity up to {tokenLabel(currentLiquid.toString(), state)}.
                    </p>
                  ) : null}
                </>
              ) : null}
              {operation.kind === 'cancel' ? (
                <div className="cancel-summary">
                  <CircleX aria-hidden="true" />
                  <div>
                    <strong>Return this listing to your balance?</strong>
                    <span>
                      {tokenLabel(operation.order.quantity, state)} · {winstonToAr(operation.order.asking)} AR total
                    </span>
                    <span>
                      After network confirmation:{' '}
                      {tokenLabel((currentLiquid + BigInt(operation.order.quantity)).toString(), state)} liquid ·{' '}
                      {tokenLabel((currentListed - BigInt(operation.order.quantity)).toString(), state)} listed
                    </span>
                    <span>A reserved listing cannot be cancelled. This listing is currently open.</span>
                  </div>
                </div>
              ) : null}
              {operation.kind === 'buy' ? (
                <>
                  <div className="purchase-market-snapshot" aria-label="Available market liquidity">
                    <div>
                      <span>Available now</span>
                      <strong>{tokenLabel(marketAvailable.toString(), state)}</strong>
                    </div>
                    <div>
                      <span>Best price</span>
                      <strong>{bestEligible ? orderPriceLabel(bestEligible, state) : '—'}</strong>
                    </div>
                    <div>
                      <span>Live sellers</span>
                      <strong>{new Set(eligible.map((order) => order.creator)).size.toLocaleString()}</strong>
                    </div>
                  </div>
                  <label className="purchase-amount-field">
                    <span>How many {ticker} do you want?</span>
                    <div>
                      <input
                        aria-describedby={`${amountGuidanceId}${formError ? ` ${amountGuidanceId}-error` : ''}${matchedOrders.length ? ` ${quoteStatusId}` : ''}`}
                        aria-invalid={Boolean(quantity && formError)}
                        autoFocus
                        data-dialog-initial
                        inputMode="decimal"
                        placeholder="0"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                      />
                      <strong>{ticker}</strong>
                      <button
                        onClick={() => setQuantity(formatTokenAmount(marketAvailable.toString(), state.denomination))}
                        type="button"
                      >
                        Max
                      </button>
                    </div>
                  </label>
                  <p id={amountGuidanceId} className="purchase-guidance">
                    Best execution is automatic. Cheaper orders fill first; only the final order is split when needed.
                  </p>
                  {formError ? (
                    <p
                      id={`${amountGuidanceId}-error`}
                      className="purchase-form-error"
                      role={quantity ? 'alert' : undefined}
                    >
                      {formError}
                    </p>
                  ) : null}
                  {matchedOrders.length ? (
                    <section aria-busy={quoteState === 'loading'} className="purchase-quote-card">
                      <div className="purchase-quote-total">
                        <span>Maximum total</span>
                        <strong>
                          {quoteState === 'error'
                            ? 'Quote unavailable'
                            : estimatedCost
                              ? `${winstonToAr(estimatedCost)} AR`
                              : 'Checking…'}
                        </strong>
                        <small>
                          {winstonToAr(matchedAsking.toString())} AR to sellers
                          {estimatedCost ? ` · ${winstonToAr((BigInt(estimatedCost) - matchedAsking).toString())} AR network fees` : ''}
                        </small>
                      </div>
                      <div className="purchase-quote-facts">
                        <div>
                          <span>You receive</span>
                          <strong>{tokenLabel(matchedQuantity.toString(), state)}</strong>
                        </div>
                        <div>
                          <span>Average price</span>
                          <strong>{averageOrderPriceLabel(matchedOrders, state)}</strong>
                        </div>
                        <div>
                          <span>Execution</span>
                          <strong>
                            {matchedOrders.length} {matchedOrders.length === 1 ? 'order' : 'orders'} · {matchedSellers}{' '}
                            {matchedSellers === 1 ? 'seller' : 'sellers'}
                          </strong>
                        </div>
                        <div>
                          <span>Wallet after</span>
                          <strong>
                            {quoteState === 'error'
                              ? '—'
                              : canAfford === false
                                ? 'Insufficient AR'
                                : estimatedCost && estimatedWalletBalance
                                  ? `${winstonToAr((BigInt(estimatedWalletBalance) - BigInt(estimatedCost)).toString())} AR`
                                  : 'Checking…'}
                          </strong>
                        </div>
                      </div>
                    </section>
                  ) : null}
                  {matchedFills.length ? <PurchaseRoute fills={matchedFills} state={state} /> : null}
                  {matchedOrders.length ? (
                    <p id={quoteStatusId} className="sr-only" aria-live="polite" role="status">
                      {quoteState === 'ready' && estimatedCost
                        ? `Purchase quote ready. Maximum total ${winstonToAr(estimatedCost)} AR.${canAfford ? '' : ' This wallet has insufficient AR.'}`
                        : quoteState === 'error'
                          ? 'Purchase quote unavailable. Retry the cost check before buying.'
                          : 'Checking the wallet balance and network fees.'}
                    </p>
                  ) : null}
                  {matchedOrders.length ? (
                    <div className={quoteState === 'error' ? 'inline-error' : 'purchase-quote-status'} role={quoteState === 'error' ? 'alert' : undefined}>
                      <span>
                        {quoteState === 'error'
                          ? 'Live fees and wallet balance could not be verified.'
                          : quoteState === 'ready'
                            ? 'Live fees and wallet balance checked.'
                            : 'Checking live fees and wallet balance…'}
                      </span>
                      <button
                        aria-describedby={quoteStatusId}
                        aria-disabled={quoteState !== 'ready' && quoteState !== 'error'}
                        className="with-icon"
                        onClick={() => {
                          if (quoteState === 'ready' || quoteState === 'error') setQuoteRetry((value) => value + 1);
                        }}
                        type="button"
                      >
                        <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" />{' '}
                        {quoteState === 'error' ? 'Retry' : quoteState === 'ready' ? 'Recheck' : 'Checking…'}
                      </button>
                    </div>
                  ) : null}
                  {canAfford === false ? (
                    <p className="purchase-form-error" role="alert">
                      This wallet does not have enough AR for the purchase and network fees.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="trade-form-footer">
              {operation.kind === 'buy' && matchedOrders.length ? (
                <div className="purchase-settlement-note">
                  <strong>{matchedOrders.length * 2} wallet approvals</strong>
                  <span>
                    One reservation and one payment per order. Reservations happen first; seller payments then run in
                    parallel. Progress is safe to close and resume.
                  </span>
                </div>
              ) : null}
              <button
                className="primary wide"
                data-dialog-initial
                aria-label={
                  operation.kind === 'transfer' && enteredQuantity && transferValid
                    ? fungibleTransferSubmitLabel(enteredQuantity.toString(), state, transferRecipient, true)
                    : undefined
                }
                aria-describedby={operation.kind === 'buy' && matchedOrders.length ? quoteStatusId : undefined}
                disabled={
                  (operation.kind === 'buy' && (!matchedOrders.length || !estimatedCost || canAfford !== true)) ||
                  (operation.kind === 'sell' && !sellValid) ||
                  (operation.kind === 'transfer' && !transferValid)
                }
                type="submit"
              >
                {operation.kind === 'buy' && matchedOrders.length
                  ? `Buy ${formatGroupedTokenAmount(matchedQuantity.toString(), state.denomination)} ${ticker} · ${estimatedCost ? `${winstonToAr(estimatedCost)} AR max` : 'checking total…'}`
                  : operation.kind === 'sell' && listingQuote && enteredQuantity
                    ? `List ${tokenLabel(enteredQuantity.toString(), state)} for ${listingQuote} AR`
                    : operation.kind === 'cancel'
                      ? `Cancel listing and return ${tokenLabel(operation.order.quantity, state)}`
                      : operation.kind === 'transfer' && enteredQuantity
                        ? fungibleTransferSubmitLabel(enteredQuantity.toString(), state, transferRecipient)
                        : operationLabel(operation.kind)}
              </button>
            </div>
          </form>
        ) : null}
        {phase === 'working' ? (
          <div>
            {operation.kind === 'buy' ? (
              <p className="sr-only" aria-live="polite" role="status">
                {settlementAnnouncement}
              </p>
            ) : (
              <p className="sr-only" aria-live="polite" role="status">
                {message ||
                  (signedWork ? 'Watching this transaction.' : 'Preparing the transaction for wallet approval.')}
              </p>
            )}
            <p className="sync-intro">{fungibleWorkingIntro(operation.kind, visibleOrders.length, signedWork)}</p>
            {signedWork ? (
              <p className="sync-resume-note">This action will resume automatically when you return.</p>
            ) : null}
            {message ? <p className="scheduler-wait">{message}</p> : null}
            {operation.kind === 'buy' && visibleOrders.length ? (
              <>
                <p className="parallel-summary">
                  {signedWork
                    ? settlementSummary.label
                    : `${visibleOrders.length} listings · preparing wallet approvals`}
                </p>
                <div className="settlement-tabs" role="tablist" aria-label="Parallel settlements">
                  {visibleOrders.map((order, index) => {
                    const purchase = purchaseStates[order.orderId];
                    const active = order.orderId === (activeOrder?.orderId ?? visibleOrders[0].orderId);
                    return (
                      <button
                        aria-controls={SETTLEMENT_PANEL_ID}
                        aria-selected={active}
                        className={active ? 'active' : undefined}
                        id={`settlement-tab-${order.orderId}`}
                        key={order.orderId}
                        onClick={() => setActiveOrderId(order.orderId)}
                        onKeyDown={(event) => {
                          const nextIndex = settlementTabIndex(event.key, index, visibleOrders.length);
                          if (nextIndex === null) return;
                          event.preventDefault();
                          const nextOrder = visibleOrders[nextIndex];
                          setActiveOrderId(nextOrder.orderId);
                          window.requestAnimationFrame(() => {
                            document.getElementById(`settlement-tab-${nextOrder.orderId}`)?.focus();
                          });
                        }}
                        role="tab"
                        tabIndex={active ? 0 : -1}
                        type="button"
                      >
                        <span>Listing {index + 1}</span>
                        <strong>{tokenLabel(order.quantity, state)}</strong>
                        <small>{batchStageLabel(purchase)}</small>
                      </button>
                    );
                  })}
                </div>
                {activeOrder ? (
                  <div
                    aria-labelledby={`settlement-tab-${activeOrder.orderId}`}
                    id={SETTLEMENT_PANEL_ID}
                    role="tabpanel"
                    tabIndex={0}
                  >
                    <div className="settlement-panel-summary">
                      <span>
                        Listing {activeOrderIndex + 1} of {visibleOrders.length}
                      </span>
                      <WalletAddress address={activeOrder.creator} full label="seller" />
                    </div>
                    {activePurchase ? (
                      <ArweaveTransactionSync
                        subject={`${asset.name} · ${tokenLabel(activeOrder.quantity, state)}`}
                        steps={purchaseSteps}
                        activeStep={activeStep}
                      />
                    ) : (
                      <div className="loading">
                        <span aria-hidden="true" />
                        Preparing this reservation and payment for your approval…
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            ) : singleSteps.length ? (
              <ArweaveTransactionSync subject={asset.name} steps={singleSteps} activeStep={operation.kind} />
            ) : (
              <Loading label="Preparing the exact signed transaction…" />
            )}
          </div>
        ) : null}
        {phase === 'done' ? (
          <div className="result success">
            <OperationOutcome title={outcomeTitle} detail={outcomeDetail} />
            {transaction && operation.kind !== 'transfer' ? (
              <a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
                View transaction {short(transaction.id)} ↗
              </a>
            ) : null}
            {operation.kind === 'buy' ? (
              <FungiblePurchaseReceiptNavigator
                activeOrderId={activeOrder?.orderId}
                onSelect={setActiveOrderId}
                orders={visibleOrders}
                purchaseStates={purchaseStates}
                state={state}
              />
            ) : operation.kind === 'transfer' && transaction && enteredQuantity ? (
              <div className="settlement-receipt">
                <div>
                  <span>Quantity</span>
                  <strong>{tokenLabel(enteredQuantity.toString(), state)}</strong>
                </div>
                <div>
                  <span>Recipient</span>
                  <WalletAddress address={transferRecipient} full label="recipient" />
                </div>
                <div className="settlement-receipt-links">
                  <a href={transactionExplorerUrl(transaction.id)} rel="noreferrer" target="_blank">
                    Transaction {short(transaction.id)} ↗
                  </a>
                </div>
              </div>
            ) : null}
            <button className="primary with-icon" data-dialog-initial onClick={() => onClose(false)}>
              <ArrowLeft className="ui-icon ui-icon--sm" /> View updated token
            </button>
          </div>
        ) : null}
        {phase === 'error' ? (
          <div className="result error">
            <FungibleOperationErrorAlert message={message} />
            {operation.kind === 'buy' && visibleOrders.length ? (
              <>
                <div className="settlement-tabs" aria-label="Settlement recovery status" role="tablist">
                  {visibleOrders.map((order, index) => {
                    const active = order.orderId === activeOrder?.orderId;
                    return (
                      <button
                        aria-controls={SETTLEMENT_ERROR_PANEL_ID}
                        aria-selected={active}
                        className={active ? 'active' : undefined}
                        id={`settlement-error-tab-${order.orderId}`}
                        key={order.orderId}
                        onClick={() => setActiveOrderId(order.orderId)}
                        onKeyDown={(event) => {
                          const nextIndex = settlementTabIndex(event.key, index, visibleOrders.length);
                          if (nextIndex === null) return;
                          event.preventDefault();
                          const nextOrder = visibleOrders[nextIndex];
                          setActiveOrderId(nextOrder.orderId);
                          window.requestAnimationFrame(() => {
                            document.getElementById(`settlement-error-tab-${nextOrder.orderId}`)?.focus();
                          });
                        }}
                        role="tab"
                        tabIndex={active ? 0 : -1}
                        type="button"
                      >
                        <span>Listing {index + 1}</span>
                        <strong>{tokenLabel(order.quantity, state)}</strong>
                        <small>{batchStageLabel(purchaseStates[order.orderId])}</small>
                      </button>
                    );
                  })}
                </div>
                {activeOrder ? (
                  <FungibleSettlementRecoveryPanel orderId={activeOrder.orderId}>
                    <div>
                      <span>Stage</span>
                      <strong>{batchStageLabel(activePurchase)}</strong>
                    </div>
                    <div>
                      <span>Seller</span>
                      <WalletAddress address={activeOrder.creator} full label="seller" />
                    </div>
                    <div>
                      <span>Order</span>
                      <strong title={activeOrder.orderId}>{short(activeOrder.orderId)}</strong>
                    </div>
                    <p>
                      {activePurchase?.error
                        ? errorMessage(
                            marketplaceCodedError(
                              activePurchase.error.code,
                              activePurchase.error.message || activePurchase.error.code,
                            ),
                          )
                        : activePurchase?.stage === 'complete'
                          ? 'This listing settled successfully.'
                          : 'This incomplete listing can be resumed safely.'}
                    </p>
                    <div className="settlement-receipt-links">
                      {activePurchase?.registration?.id ? (
                        <a
                          href={transactionExplorerUrl(activePurchase.registration.id)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Reservation {short(activePurchase.registration.id)} ↗
                        </a>
                      ) : null}
                      {activePurchase?.payment?.id ? (
                        <a href={transactionExplorerUrl(activePurchase.payment.id)} rel="noreferrer" target="_blank">
                          Payment {short(activePurchase.payment.id)} ↗
                        </a>
                      ) : null}
                    </div>
                  </FungibleSettlementRecoveryPanel>
                ) : null}
              </>
            ) : null}
            {failureKind === 'market-state-changed' ? (
              <button data-dialog-initial onClick={() => onClose(false)}>
                Review updated token
              </button>
            ) : failureKind === 'transaction-rejected' && transaction ? (
              <button
                data-dialog-initial
                onClick={() => {
                  removeWalletRecordIf<any>(
                    localStorage,
                    operationStorageKey(asset.id, owner),
                    (record) => record?.txId === transaction.id,
                  );
                  localStorage.removeItem(`bazar-signed-transaction:${transaction.id}`);
                  onClose(false);
                }}
              >
                Discard rejected signature and sign again
              </button>
            ) : operation.kind === 'buy' ? (
              <>
                {recoverableBatch ? (
                  <p>Completed purchases are final; only incomplete settlements will resume.</p>
                ) : (
                  <p>No transaction was submitted. Any earlier approvals from this attempt were discarded.</p>
                )}
                <button data-dialog-initial onClick={restartPurchase}>
                  {recoverableBatch
                    ? `Resume ${incompletePurchases} incomplete ${incompletePurchases === 1 ? 'settlement' : 'settlements'}`
                    : 'Review and try again'}
                </button>
              </>
            ) : transaction ? (
              <button data-dialog-initial onClick={() => void submit()}>
                Resume the signed transaction
              </button>
            ) : (
              <button
                data-dialog-initial
                onClick={() => {
                  setFailureKind(null);
                  setMessage('');
                  setPhase('form');
                }}
              >
                Review and try again
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FungibleOperationErrorAlert({ message }: { message: string }) {
  return (
    <div className="result-alert" role="alert">
      <h3>Could not complete this action</h3>
      <p>{message}</p>
    </div>
  );
}

export function PurchaseRoute({
  fills,
  state,
}: {
  fills: OrderFill[];
  state: AssetState;
}) {
  return (
    <details className="purchase-route" open={fills.length === 1}>
      <summary>
        <span>Purchase route</span>
        <strong>
          {fills.length === 1 ? '1 order' : `View ${fills.length} orders`}
        </strong>
      </summary>
      <ul aria-label="Purchase execution route" tabIndex={0}>
        {fills.map(({ order, sourceOrder, partial }, index) => (
          <li key={order.orderId}>
            <span className="purchase-route-index">{index + 1}</span>
            <span className="purchase-route-fill">
              <strong>{tokenLabel(order.quantity, state)}</strong>
              <small>
                {orderPriceLabel(order, state)}
                {partial
                  ? ` · ${tokenLabel(order.quantity, state)} of ${tokenLabel(sourceOrder.quantity, state)} from this listing`
                  : ' · full order'}
              </small>
            </span>
            <span className="purchase-route-total">{winstonToAr(order.asking)} AR</span>
            <WalletAddress address={order.creator} label="seller" />
          </li>
        ))}
      </ul>
    </details>
  );
}

export function FungiblePurchaseReceiptNavigator({
  activeOrderId,
  onSelect,
  orders,
  purchaseStates,
  state,
}: {
  activeOrderId?: string;
  onSelect(orderId: string): void;
  orders: SwapOrder[];
  purchaseStates: Record<string, PurchaseState>;
  state: AssetState;
}) {
  if (!orders.length) return null;
  const activeIndex = Math.max(
    0,
    orders.findIndex((order) => order.orderId === activeOrderId),
  );
  const order = orders[activeIndex];
  const settled = purchaseStates[order.orderId];
  return (
    <div className="settlement-receipts">
      <div className="settlement-receipt-navigation">
        <label>
          <span>Settlement receipt</span>
          <select
            aria-label={`Choose a settlement receipt; current seller ${order.creator}`}
            onChange={(event) => onSelect(event.target.value)}
            value={order.orderId}
          >
            {orders.map((candidate, index) => (
              <option key={candidate.orderId} value={candidate.orderId}>
                Listing {index + 1} · {tokenLabel(candidate.quantity, state)} · {short(candidate.creator)}
              </option>
            ))}
          </select>
        </label>
        <span aria-live="polite">
          {activeIndex + 1} of {orders.length}
        </span>
      </div>
      <section aria-label={`Settlement receipt ${activeIndex + 1} of ${orders.length}`} className="settlement-receipt">
        <div>
          <span>Listing {activeIndex + 1}</span>
          <strong>{tokenLabel(order.quantity, state)}</strong>
        </div>
        <div>
          <span>Seller</span>
          <WalletAddress address={order.creator} full label="seller" />
        </div>
        <div>
          <span>Order</span>
          <strong title={order.orderId}>{short(order.orderId)}</strong>
        </div>
        <div>
          <span>Seller payment</span>
          <strong>{winstonToAr(order.asking)} AR</strong>
        </div>
        <div className="settlement-receipt-links">
          {settled?.registration?.id ? (
            <a href={transactionExplorerUrl(settled.registration.id)} rel="noreferrer" target="_blank">
              Reservation {short(settled.registration.id)} ↗
            </a>
          ) : null}
          {settled?.payment?.id ? (
            <a href={transactionExplorerUrl(settled.payment.id)} rel="noreferrer" target="_blank">
              Payment {short(settled.payment.id)} ↗
            </a>
          ) : null}
        </div>
      </section>
      {orders.length > 1 ? (
        <div className="settlement-receipt-paging">
          <button
            aria-disabled={activeIndex === 0}
            onClick={() => {
              if (activeIndex > 0) onSelect(orders[activeIndex - 1].orderId);
            }}
            type="button"
          >
            Previous receipt
          </button>
          <button
            aria-disabled={activeIndex === orders.length - 1}
            onClick={() => {
              if (activeIndex < orders.length - 1) onSelect(orders[activeIndex + 1].orderId);
            }}
            type="button"
          >
            Next receipt
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function FungibleSettlementRecoveryPanel({
  children,
  orderId,
}: {
  children?: React.ReactNode;
  orderId: string;
}) {
  return (
    <section
      aria-labelledby={`settlement-error-tab-${orderId}`}
      className="settlement-error-detail"
      id={SETTLEMENT_ERROR_PANEL_ID}
      role="tabpanel"
      tabIndex={0}
    >
      {children}
    </section>
  );
}

function preparedEntry(prepared: PreparedPurchase): BatchEntry {
  return {
    order: prepared.order,
    fillQuantity: prepared.fillQuantity,
    snapshot: prepared.snapshot,
    paymentCost: prepared.paymentCost,
  };
}

export function batchPaymentBarrierState(entries: Array<Pick<BatchEntry, 'snapshot' | 'paymentCost'>>) {
  return entries.reduce(
    (state, entry) =>
      entry.snapshot.payment?.dispatched
        ? { ...state, registrationsReady: state.registrationsReady + 1 }
        : { ...state, pendingPaymentCost: state.pendingPaymentCost + BigInt(entry.paymentCost) },
    { registrationsReady: 0, pendingPaymentCost: 0n },
  );
}

export function batchRecoveryIdentity(entries: Array<Pick<BatchEntry, 'order' | 'fillQuantity' | 'snapshot'>>) {
  return entries
    .map(
      ({ order, fillQuantity, snapshot }) =>
        `${order.orderId}:${fillQuantity}:${snapshot.registration?.id ?? ''}:${snapshot.payment?.id ?? ''}`,
    )
    .join('|');
}

export function purchaseQuoteIdentity(orders: SwapOrder[]) {
  return orders
    .map((order) => `${order.orderId}:${order.quantity}:${order.asking}:${order.minimumFee}:${order.recipient}`)
    .join('|');
}

export function batchPurchaseStartingBalance(
  resume: Pick<BatchResume, 'startingBalance'> | undefined,
  freshState: AssetState | undefined,
  buyer: string,
  renderedBalance: string,
) {
  if (resume) return resume.startingBalance;
  return freshState ? liquidBalanceOf(freshState, buyer) : renderedBalance;
}

export function fungibleBatchRecoveryStatus(
  resume: Pick<BatchResume, 'entries'>,
  state: AssetState,
  buyer: string,
): 'resumable' | 'blocked' {
  return resume.entries.every((entry) => {
    // A payment leg must resume its exact historical proof even if the buyer
    // later transfers the purchased units and current balance returns to zero.
    if (entry.snapshot.payment?.id) return true;
    const order = state.orders[entry.order.orderId];
    const fill = filledOrder(entry.order, entry.fillQuantity);
    const expected = order?.status === 'reserved' ? fill : entry.order;
    return Boolean(
      order &&
      order.creator === expected.creator &&
      order.recipient === expected.recipient &&
      order.asking === expected.asking &&
      order.deposit === expected.deposit &&
      order.minimumFee === expected.minimumFee &&
      order.deadline === expected.deadline &&
      order.createdAt === expected.createdAt &&
      order.quantity === expected.quantity &&
      (order.status === 'open' || (order.status === 'reserved' && order.buyer === buyer)),
    );
  })
    ? 'resumable'
    : 'blocked';
}

export function isRecoverableBatch(record: unknown, buyer: string): record is BatchResume {
  if (!record || typeof record !== 'object') return false;
  const candidate = record as Partial<BatchResume>;
  if (
    candidate.version !== 3 ||
    candidate.buyer !== buyer ||
    !/^\d+$/.test(candidate.startingBalance ?? '') ||
    !Array.isArray(candidate.entries) ||
    candidate.entries.length === 0
  ) {
    return false;
  }
  return candidate.entries.every((entry) =>
    Boolean(
      entry &&
      ADDRESS.test(entry.order?.orderId ?? '') &&
      /^\d+$/.test(entry.order?.quantity ?? '') &&
      /^\d+$/.test(entry.order?.asking ?? '') &&
      /^[1-9]\d*$/.test(entry.fillQuantity ?? '') &&
      BigInt(entry.fillQuantity) <= BigInt(entry.order.quantity) &&
      /^\d+$/.test(entry.paymentCost ?? '') &&
      (hasRecoverablePurchase(entry.snapshot) || (!entry.snapshot.registration && !entry.snapshot.payment)),
    ),
  );
}

export function batchPurchaseRecoveryApprovalCount(entries: Array<Pick<BatchEntry, 'snapshot'>>) {
  return entries.reduce((total, entry) => total + purchaseRecoveryApprovalCount(entry.snapshot), 0);
}

export function latestRecoverableSnapshot(current: PurchaseSnapshot, next: PurchaseSnapshot) {
  if (!hasRecoverablePurchase(next)) return current;
  const candidate =
    current.registration?.id === next.registration?.id
      ? {
          registration: {
            id: next.registration!.id,
            dispatched: Boolean(current.registration?.dispatched || next.registration?.dispatched),
          },
          ...(next.payment
            ? {
                payment:
                  next.payment.id === current.payment?.id
                    ? {
                        id: next.payment.id,
                        dispatched: Boolean(current.payment.dispatched || next.payment.dispatched),
                      }
                    : next.payment,
              }
            : current.payment
              ? { payment: current.payment }
              : {}),
          ...(current.dismissed || next.dismissed ? { dismissed: true } : {}),
        }
      : next;
  return equalPurchaseSnapshots(current, candidate) ? current : candidate;
}

export function purchaseStateFrameBuffer(
  commit: (updates: Record<string, PurchaseState>) => void,
  schedule: (callback: () => void) => number = (callback) => window.requestAnimationFrame(callback),
  cancel: (handle: number) => void = (handle) => window.cancelAnimationFrame(handle),
) {
  let scheduled: number | null = null;
  let pending: Record<string, PurchaseState> = {};
  const flush = () => {
    if (scheduled !== null) cancel(scheduled);
    scheduled = null;
    if (!Object.keys(pending).length) return;
    const updates = pending;
    pending = {};
    commit(updates);
  };
  return {
    push(orderId: string, state: PurchaseState) {
      pending[orderId] = state;
      if (scheduled !== null) return;
      scheduled = schedule(() => {
        scheduled = null;
        flush();
      });
    },
    flush,
    clear() {
      if (scheduled !== null) cancel(scheduled);
      scheduled = null;
      pending = {};
    },
  };
}

export function batchRecoveryFrameBuffer(
  persist: () => void,
  scheduleFrame: (callback: () => void) => number = (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (handle: number) => void = (handle) => window.cancelAnimationFrame(handle),
) {
  let scheduled: number | null = null;
  let dirty = false;
  const persistDirty = () => {
    if (!dirty) return;
    dirty = false;
    persist();
  };
  return {
    schedule() {
      dirty = true;
      if (scheduled !== null) return;
      scheduled = scheduleFrame(() => {
        scheduled = null;
        persistDirty();
      });
    },
    flush(force = false) {
      if (scheduled !== null) cancelFrame(scheduled);
      scheduled = null;
      if (force && !dirty) persist();
      else persistDirty();
    },
    clear() {
      if (scheduled !== null) cancelFrame(scheduled);
      scheduled = null;
      dirty = false;
    },
  };
}

export function visibleOrderbookRows<T>(orders: T[], limit: number) {
  return orders.slice(0, Math.max(0, limit));
}

function equalPurchaseSnapshots(left: PurchaseSnapshot, right: PurchaseSnapshot) {
  return (
    left.registration?.id === right.registration?.id &&
    left.registration?.dispatched === right.registration?.dispatched &&
    left.payment?.id === right.payment?.id &&
    left.payment?.dispatched === right.payment?.dispatched &&
    left.dismissed === right.dismissed
  );
}

export function storeBatchRecoveryBeforeDispatch(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  key: string,
  record: BatchResume,
  signal: AbortSignal,
) {
  const attemptId = record.attemptId ?? batchRecoveryIdentity(record.entries);
  record.attemptId = attemptId;
  storeWalletRecordOrThrow(
    storage,
    key,
    record,
    (current: BatchResume) => (current.attemptId ?? batchRecoveryIdentity(current.entries)) === attemptId,
    true,
  );
  if (signal.aborted) throw signal.reason;
}

export async function waitForSettlementBatch(running: Promise<PurchaseState>[]): Promise<PurchaseState[]> {
  const settled = await Promise.allSettled(running);
  const failed = settled.filter(
    (result) => result.status === 'rejected' || result.value.stage !== 'complete' || !result.value.success,
  );
  if (failed.length) {
    const reasons = [
      ...new Set(
        failed.flatMap((result) => {
          if (result.status === 'rejected') {
            return [result.reason instanceof Error ? result.reason.message : String(result.reason)];
          }
          return result.value.error?.message ? [result.value.error.message] : [];
        }),
      ),
    ];
    throw new Error(
      `${failed.length} of ${settled.length} settlements need attention.${reasons.length ? ` ${reasons.join(' ')}` : ''}`,
    );
  }
  return settled.map((result) => (result as PromiseFulfilledResult<PurchaseState>).value);
}

export function settlementTabIndex(key: string, current: number, count: number): number | null {
  if (count < 1) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count;
  return null;
}

export function batchSettlementSummary(states: Array<PurchaseState | undefined>) {
  const settled = states.filter((state) => state?.stage === 'complete').length;
  const failed = states.filter((state) => state?.stage === 'failed').length;
  const paying = states.filter((state) => {
    const stage = state?.stage ?? '';
    return stage.includes('payment') || stage === 'ownership-verifying';
  }).length;
  const reserving = states.length - settled - failed - paying;
  return {
    settled,
    failed,
    paying,
    reserving,
    label: `${states.length} listings · ${settled} settled${failed ? ` · ${failed} needs attention` : ''} · ${paying} paying · ${reserving} reserving`,
  };
}

export function nextSettlementAnnouncement(
  previousKey: string,
  signedWork: boolean,
  total: number,
  summary: Pick<ReturnType<typeof batchSettlementSummary>, 'failed' | 'settled'>,
): { key: string; message: string } | null {
  if (total < 1) return null;
  let next: { key: string; message: string };
  if (!signedWork) {
    next = {
      key: `preparing:${total}`,
      message: `Preparing wallet approvals for ${total} ${total === 1 ? 'listing' : 'listings'}.`,
    };
  } else if (summary.failed) {
    if (previousKey.startsWith('attention:')) return null;
    next = {
      key: `attention:${total}`,
      message: `A settlement needs attention. ${summary.settled} of ${total} settled; the others continue independently.`,
    };
  } else if (summary.settled >= total) {
    next = {
      key: `complete:${total}`,
      message: total === 1 ? 'The settlement is complete.' : `All ${total} settlements are complete.`,
    };
  } else {
    const quarter = Math.floor((summary.settled * 4) / total);
    if (quarter > 0) {
      const threshold = Math.ceil((total * Math.min(quarter, 3)) / 4);
      next = {
        key: `progress:${Math.min(quarter, 3)}:${total}`,
        message: `${threshold} of ${total} settlements complete.`,
      };
    } else {
      next = {
        key: `watching:${total}`,
        message: `Watching ${total} parallel ${total === 1 ? 'settlement' : 'settlements'}.`,
      };
    }
  }
  return next.key === previousKey ? null : next;
}

function batchStorageKey(assetId: string, buyer: string) {
  return `bazar-purchase-batch:${assetId}:${buyer}`;
}

function lotAsking(rawQuantity: string, unitPrice: string, denomination: number): string {
  const price = BigInt(arToWinston(unitPrice));
  const quantity = BigInt(rawQuantity);
  const scale = 10n ** BigInt(denomination);
  return ((price * quantity + scale - 1n) / scale).toString();
}

function safeLotQuote(quantity: string, price: string, state: AssetState): string | null {
  try {
    return winstonToAr(lotAsking(parseTokenAmount(quantity, state.denomination), price, state.denomination));
  } catch {
    return null;
  }
}

function safeArPrice(value: string): boolean {
  try {
    return BigInt(arToWinston(value)) > 0n;
  } catch {
    return false;
  }
}

function safeTokenAmount(value: string, denomination: number): bigint | null {
  try {
    const amount = BigInt(parseTokenAmount(value, denomination));
    return amount > 0n ? amount : null;
  } catch {
    return null;
  }
}

function unitPriceWinston(order: SwapOrder, denomination: number): bigint {
  const scale = 10n ** BigInt(denomination);
  return (BigInt(order.asking) * scale + BigInt(order.quantity) - 1n) / BigInt(order.quantity);
}

function orderPriceLabel(order: SwapOrder, state: AssetState) {
  return `${winstonToAr(unitPriceWinston(order, state.denomination).toString())} AR / ${state.ticker || 'token'}`;
}

function averageOrderPriceLabel(orders: SwapOrder[], state: AssetState) {
  const quantity = orders.reduce((total, order) => total + BigInt(order.quantity), 0n);
  const asking = orders.reduce((total, order) => total + BigInt(order.asking), 0n);
  return orderPriceLabel({ quantity: quantity.toString(), asking: asking.toString() } as SwapOrder, state);
}

function tokenLabel(raw: string, state: AssetState) {
  return `${formatGroupedTokenAmount(raw, state.denomination)} ${state.ticker || 'tokens'}`;
}

export function fungibleOrderActionLabel(action: 'buy' | 'cancel', order: SwapOrder, state: AssetState) {
  const lot = `${tokenLabel(order.quantity, state)} for ${winstonToAr(order.asking)} AR`;
  return action === 'buy' ? `Buy ${lot} from ${order.creator}` : `Cancel listing of ${lot}`;
}

export function fungibleListingAccessibleLabel(order: SwapOrder, state: AssetState) {
  return `${tokenLabel(order.quantity, state)}, ${orderPriceLabel(order, state)}, ${winstonToAr(order.asking)} AR total, seller ${order.creator}`;
}

export function fungibleOperationStateError(
  kind: FungibleOperation['kind'],
  state: AssetState,
  owner: string,
  expectedOrders: SwapOrder[],
  rawQuantity = '0',
  expectedDenomination = state.denomination,
) {
  if (state.denomination !== expectedDenomination) return 'market-state-changed';
  if (kind === 'buy' || kind === 'cancel') {
    if (!expectedOrders.length) return 'market-state-changed';
    const unchanged = expectedOrders.every((expected) => {
      const current = state.orders[expected.orderId];
      return Boolean(
        current &&
        current.status === 'open' &&
        current.creator === expected.creator &&
        current.asking === expected.asking &&
        current.quantity === expected.quantity &&
        (kind === 'buy' ? current.creator !== owner : current.creator === owner),
      );
    });
    return unchanged ? '' : 'market-state-changed';
  }
  try {
    const quantity = BigInt(rawQuantity);
    return quantity > 0n && quantity <= BigInt(liquidBalanceOf(state, owner)) ? '' : 'market-state-changed';
  } catch {
    return 'market-state-changed';
  }
}

export function fungibleTransferRecipientError(recipient: string, owner: string) {
  const normalized = recipient.trim();
  if (!ADDRESS.test(normalized)) return 'Enter a 43-character Arweave wallet address.';
  if (normalized === owner)
    return 'Choose a different wallet. Sending tokens to this wallet would not change its balance.';
  return '';
}

export function fungibleTransferSubmitLabel(
  quantity: string,
  state: AssetState,
  recipient: string,
  fullRecipient = false,
) {
  return `Send ${tokenLabel(quantity, state)} to ${fullRecipient ? recipient : short(recipient)}`;
}

function formatGroupedTokenAmount(raw: string, denomination: number) {
  const [whole, fraction] = formatTokenAmount(raw, denomination).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

function winstonToAr(value: string) {
  const raw = BigInt(value);
  const whole = raw / 1_000_000_000_000n;
  const fraction = (raw % 1_000_000_000_000n).toString().padStart(12, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function arToWinston(value: string) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value) || value === '0') throw new Error('Enter a positive AR amount.');
  const [whole, decimals = ''] = value.split('.');
  return (BigInt(whole) * 1_000_000_000_000n + BigInt(decimals.padEnd(12, '0'))).toString();
}

function assetDescription(state: AssetState, fallback: string) {
  if (typeof state.raw.description === 'string' && state.raw.description.trim()) return state.raw.description.trim();
  return fallback;
}

function operationLabel(kind: FungibleOperation['kind']) {
  return { sell: 'List tokens', buy: 'Buy tokens', cancel: 'Cancel listing', transfer: 'Transfer tokens' }[kind];
}

export function fungibleWorkingIntro(kind: FungibleOperation['kind'], listings: number, signed: boolean) {
  if (!signed) {
    if (kind === 'buy') {
      const transactions =
        listings === 1 ? 'the reservation and seller payment' : `${listings} reservations and seller payments`;
      return `Preparing ${transactions} for wallet approval. Nothing has been submitted yet.`;
    }
    return `Preparing the ${operationLabel(kind).toLowerCase()} transaction for wallet approval. Nothing has been submitted yet.`;
  }
  if (kind === 'buy' && listings > 1) {
    return `${listings} listings are settling independently. Switch between them below while every transaction continues in parallel.`;
  }
  return 'Signed. Now watching independent Arweave nodes agree on the transaction.';
}

function batchStageLabel(state?: PurchaseState) {
  if (!state) return 'Preparing';
  if (state.stage === 'complete') return 'Settled ✓';
  if (state.stage === 'failed') return 'Needs attention';
  if (state.stage.includes('payment') || state.stage === 'ownership-verifying') {
    return `Pay ${state.payment?.consensus.confirmations ?? 0}/5`;
  }
  if (state.stage === 'signing' || state.stage === 'idle') return 'Preparing';
  return `Reserve ${state.registration?.consensus.confirmations ?? 0}/5`;
}

function activityLabel(action: CollectionActivityEvent['action']) {
  return {
    'make-offer': 'Token listing submitted',
    'register-interest': 'Reservation submitted',
    transfer: 'Token transfer submitted',
    'cancel-order': 'Cancellation submitted',
  }[action];
}

function activityDetail(event: CollectionActivityEvent, state: AssetState) {
  if (event.action === 'make-offer') {
    const quantity = event.quantity ? tokenLabel(event.quantity, state) : '';
    const asking = event.asking ? `${winstonToAr(event.asking)} AR total` : '';
    return [quantity, asking].filter(Boolean).join(' for ');
  }
  if (event.action === 'transfer') {
    const quantity = event.quantity ? tokenLabel(event.quantity, state) : '';
    const recipient = event.recipient ? `to ${short(event.recipient)}` : '';
    return [quantity, recipient].filter(Boolean).join(' ');
  }
  if (event.action === 'register-interest' && event.orderId) return `Order ${short(event.orderId)}`;
  if (event.action === 'cancel-order' && event.orderId) return `Order ${short(event.orderId)}`;
  return '';
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000));
}

function short(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-5)}`;
}

function Loading({ label }: { label: string }) {
  return (
    <div aria-live="polite" className="loading" role="status">
      <span aria-hidden="true" />
      {label}
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="error-panel">
      <strong>Unable to load</strong>
      <span aria-label={`Unable to load. ${message}`} role="alert">
        {message}
      </span>
    </div>
  );
}
