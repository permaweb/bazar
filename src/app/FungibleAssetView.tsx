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
  Wallet,
  X,
} from 'lucide-react';
import {
  SwapPurchase,
  type ObserverView,
  type PreparedTransaction,
  type PurchaseSnapshot,
  type PurchaseState,
} from 'weave-wrangler';

import type { CollectionActivityEvent } from 'api/asset-discovery';
import type { AssetSummary, Collection } from 'api/collections';
import {
  bestAskOfAsset,
  licenseProperties,
  listedBalanceOf,
  liquidBalanceOf,
  liveOrdersOfAsset,
  openOrdersOfAsset,
  type AssetState,
  type SwapOrder,
} from 'api/asset-marketplace';
import { matchWholeOrders, formatTokenAmount, parseTokenAmount } from 'api/order-matching';
import { ArweaveObserverNetwork } from 'api/arweave-observers';
import { assetObserverNetworkOptions } from 'api/asset-observers';
import {
  AssetTransactionClient,
  DEFAULT_REGISTRATION_FEE,
  dispatchAndConfirm,
  type PreparedPurchase,
} from 'api/asset-transactions';
import { ArweaveTransactionSync, type ArweaveSyncStep } from 'components/ArweaveTransactionSync';
import { useWallet } from 'providers/WalletProvider';

type Props = {
  asset: AssetSummary;
  collection: Collection;
  state: AssetState;
  activity: CollectionActivityEvent[];
  activityLoading: boolean;
  loading: boolean;
  error: string | null;
  onRefresh(): Promise<void>;
};

type BatchEntry = {
  order: SwapOrder;
  snapshot: PurchaseSnapshot;
  paymentCost: string;
};

type BatchResume = {
  version: 2;
  buyer: string;
  startingBalance: string;
  entries: BatchEntry[];
};

type FungibleOperation =
  | { kind: 'sell'; quantity?: string; unitPrice?: string; resumeId?: string }
  | {
      kind: 'transfer';
      quantity?: string;
      recipient?: string;
      recipientStartingBalance?: string;
      resumeId?: string;
    }
  | { kind: 'cancel'; order: SwapOrder; resumeId?: string }
  | {
      kind: 'buy';
      availableOrders: SwapOrder[];
      startingBalance: string;
      selectedOrders?: SwapOrder[];
      resume?: BatchResume;
    };

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;

export function FungibleAssetView({
  asset,
  collection,
  state,
  activity,
  activityLoading,
  loading,
  error,
  onRefresh,
}: Props) {
  const wallet = useWallet();
  const [operation, setOperation] = React.useState<FungibleOperation | null>(null);
  const [activeSection, setActiveSection] = React.useState<'about' | 'orders' | 'activity'>('orders');
  const orders = liveOrdersOfAsset(state);
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
    if (!wallet.address || operation) return;
    try {
      const savedBatch = JSON.parse(localStorage.getItem(batchStorageKey(asset.id, wallet.address)) ?? 'null');
	      if (savedBatch?.version === 2 && savedBatch.buyer === wallet.address && Array.isArray(savedBatch.entries)) {
        const resume = savedBatch as BatchResume;
        const expected = resume.entries.reduce(
          (total, entry) => total + BigInt(entry.order.quantity),
          BigInt(resume.startingBalance),
        );
        const allGone = resume.entries.every((entry) => !state.orders[entry.order.orderId]);
        if (allGone && BigInt(liquidBalanceOf(state, wallet.address)) >= expected) {
          localStorage.removeItem(batchStorageKey(asset.id, wallet.address));
        } else {
          setOperation({
            kind: 'buy',
            availableOrders: resume.entries.map((entry) => entry.order),
            selectedOrders: resume.entries.map((entry) => entry.order),
            startingBalance: resume.startingBalance,
            resume,
          });
          return;
        }
      }

      const saved = JSON.parse(localStorage.getItem(`bazar-operation:${asset.id}`) ?? 'null');
      if (saved?.signer !== wallet.address || !ADDRESS.test(saved?.txId)) return;
      if (saved.kind === 'cancel' && saved.order) {
        setOperation({ kind: 'cancel', order: saved.order, resumeId: saved.txId });
      } else if (saved.kind === 'sell') {
        setOperation({
          kind: 'sell',
          quantity: saved.quantity,
          unitPrice: saved.unitPrice,
          resumeId: saved.txId,
        });
      } else if (saved.kind === 'transfer') {
        setOperation({
          kind: 'transfer',
          quantity: saved.quantity,
          recipient: saved.recipient,
          recipientStartingBalance: saved.recipientStartingBalance,
          resumeId: saved.txId,
        });
      }
    } catch {
      if (purchaseKey) localStorage.removeItem(purchaseKey);
      localStorage.removeItem(`bazar-operation:${asset.id}`);
    }
  }, [asset.id, operation, purchaseKey, state, wallet.address]);

  const showAssetSection = (section: 'about' | 'orders' | 'activity') => {
    setActiveSection(section);
    const target = document.getElementById(`asset-${section}`);
    if (target instanceof HTMLDetailsElement) target.open = true;
    window.requestAnimationFrame(() => target?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <section className="asset-page asset-detail-page fungible-asset-page">
      <div className="asset-detail-layout">
        <div className="asset-visual-column">
          <div className={`asset-hero-media${asset.image ? '' : ' token-hero'}`}>
            {asset.image ? <img src={asset.image} alt={asset.name} /> : <span>{ticker.slice(0, 6)}</span>}
            <div className="asset-media-label">
              <span>Arweave-native token</span>
              <strong>{ticker}</strong>
            </div>
          </div>
        </div>
        <div className="asset-commerce-column">
          <div className="asset-details asset-identity">
            <div className="asset-kicker">
              <Link className="asset-collection-link" to={`/collection/${collection.id}`}>
                {collection.name}
              </Link>
              <span className={openOrders.length ? 'status-dot listed' : 'status-dot'}>
                {openOrders.length ? `${openOrders.length} open ${openOrders.length === 1 ? 'ask' : 'asks'}` : 'Arweave live'}
              </span>
            </div>
            <h1>{asset.name}</h1>
            <div className="asset-owner-line">
              <span>{wallet.address ? 'Your liquid balance' : 'Circulating supply'}</span>
              <strong>{tokenLabel(wallet.address ? liquid : state.totalSupply, state)}</strong>
            </div>
            <div className="asset-token-tags" aria-label="Token protocol details">
              <span>{state.device}</span>
              <span>{ticker}</span>
              <span>{state.denomination} decimals</span>
            </div>
            {loading ? <Loading label="Computing current state…" /> : null}
            {error ? <ErrorPanel message={error} /> : null}
            <section className="asset-commerce-card">
              <div className="asset-market-stats">
                <div>
                  <span>Best unit price</span>
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
	                <strong>{openOrders.length ? `${openOrders.length} from ${sellerCount} ${sellerCount === 1 ? 'seller' : 'sellers'}` : 'None yet'}</strong>
              </div>
              <div className="asset-commerce-actions">
                {!wallet.address ? (
                  <button className="primary with-icon" onClick={() => void wallet.connect()}>
                    <Wallet className="ui-icon ui-icon--sm" aria-hidden="true" /> Connect wallet
                  </button>
                ) : null}
                {wallet.address && purchasableOrders.length ? (
	                  <button
                    className="primary with-icon"
                    onClick={() =>
                      setOperation({ kind: 'buy', availableOrders: purchasableOrders, startingBalance: liquid })
                    }
                  >
                    <ShoppingCart className="ui-icon ui-icon--sm" aria-hidden="true" /> Buy from order book
                  </button>
                ) : null}
                {wallet.address && BigInt(liquid) > 0n ? (
	                  <button className={`${purchasableOrders.length ? '' : 'primary '}with-icon`} onClick={() => setOperation({ kind: 'sell' })}>
                    <Tag className="ui-icon ui-icon--sm" aria-hidden="true" /> List tokens
                  </button>
                ) : null}
                {wallet.address && BigInt(liquid) > 0n ? (
                  <button className="with-icon" onClick={() => setOperation({ kind: 'transfer' })}>
                    <Send className="ui-icon ui-icon--sm" aria-hidden="true" /> Transfer
                  </button>
                ) : null}
                <button className="with-icon" onClick={() => void onRefresh()}>
                  <RefreshCw className="ui-icon ui-icon--sm" aria-hidden="true" /> Refresh
                </button>
              </div>
            </section>
          </div>
          <nav className="asset-section-tabs" aria-label="Token detail sections">
            {(['about', 'orders', 'activity'] as const).map((section) => (
              <button
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
            <details id="asset-orders" open>
              <summary>
                <span className="asset-accordion-icon"><Layers3 className="ui-icon" aria-hidden="true" /></span>
                <strong>Order book</strong>
                <span className="asset-accordion-count">{orders.length} live</span>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                <div className="orderbook-table fungible-orderbook">
                  <div className="orderbook-head">
                    <span>Unit price</span><span>Quantity</span><span>Total</span><span>Seller</span><span>Status</span><span />
                  </div>
                  {orders.map((order) => {
                    const own = order.creator === wallet.address;
                    return (
                      <div className="orderbook-row" key={order.orderId}>
                        <strong>{orderPriceLabel(order, state)}</strong>
                        <span>{tokenLabel(order.quantity, state)}</span>
                        <span>{winstonToAr(order.asking)} AR</span>
                        <a href={`https://arweave.net/${order.creator}`} target="_blank" rel="noreferrer">
                          {short(order.creator)}
                        </a>
                        <span className={`order-status ${order.status}`}>{order.status}</span>
                        {own && order.status === 'open' ? (
                          <button className="order-action" onClick={() => setOperation({ kind: 'cancel', order })}>
                            Cancel
                          </button>
                        ) : !own && order.status === 'open' ? (
                          <button
                            className="order-action"
                            onClick={() =>
                              setOperation({
                                kind: 'buy',
                                availableOrders: purchasableOrders,
                                selectedOrders: [order],
                                startingBalance: liquid,
                              })
                            }
                          >
                            Buy lot
                          </button>
                        ) : <span />}
                      </div>
                    );
                  })}
                  {!orders.length ? (
                    <div className="orderbook-empty">
                      <strong>No open asks</strong>
                      <span>Token holders can list any whole lot directly from their wallet.</span>
                    </div>
                  ) : null}
                </div>
                <p className="market-note">
                  Every row is an escrowed whole lot computed from live process state. Multi-order purchases settle
                  each selected lot independently and in parallel.
                </p>
              </div>
            </details>
            <details id="asset-about">
              <summary>
                <span className="asset-accordion-icon"><Grid2X2 className="ui-icon" aria-hidden="true" /></span>
                <strong>Token details</strong>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                <p className="asset-description">{description}</p>
                <div className="asset-detail-facts">
                  <div><span>Ticker</span><strong>{ticker}</strong></div>
                  <div><span>Total supply</span><strong>{tokenLabel(state.totalSupply, state)}</strong></div>
                  <div><span>Atomic precision</span><strong>{state.denomination} decimals</strong></div>
                  <div><span>Settlement</span><strong>Native AR</strong></div>
                </div>
              </div>
            </details>
            <details id="asset-activity">
              <summary>
                <span className="asset-accordion-icon"><BarChart3 className="ui-icon" aria-hidden="true" /></span>
                <strong>Market activity</strong>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                {activityLoading ? <Loading label="Reading permanent market history…" /> : null}
                {!activityLoading && activity.length ? (
                  <div className="asset-history-list">
                    {activity.map((event) => (
                      <a key={event.id} href={`https://arweave.net/${event.id}`} target="_blank" rel="noreferrer">
                        <span>{activityLabel(event.action)}</span>
                        <time>{event.timestamp ? formatTimestamp(event.timestamp) : 'Pending timestamp'}</time>
                        <ArrowUpRight className="ui-icon ui-icon--xs" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {!activityLoading && !activity.length ? <p className="asset-empty-copy">No permanent market events found.</p> : null}
              </div>
            </details>
            <details>
              <summary>
                <span className="asset-accordion-icon"><FileText className="ui-icon" aria-hidden="true" /></span>
                <strong>Usage rights</strong>
                <span className="asset-accordion-count">{license.length || '—'}</span>
                <ChevronDown className="ui-icon ui-icon--sm" aria-hidden="true" />
              </summary>
              <div className="asset-accordion-content">
                {license.length ? (
                  <dl className="license-properties">
                    {license.map((property) => <div key={property.key}><dt>{property.label}</dt><dd>{property.value}</dd></div>)}
                  </dl>
                ) : <p className="asset-empty-copy">No UDL terms declared.</p>}
              </div>
            </details>
          </div>
        </div>
      </div>
      {operation && wallet.address ? (
        <FungibleOperationDialog
          asset={asset}
          state={state}
          owner={wallet.address}
          operation={operation}
          onClose={() => {
            setOperation(null);
            void onRefresh();
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
  onClose,
}: {
  asset: AssetSummary;
  state: AssetState;
  owner: string;
  operation: FungibleOperation;
  onClose(): void;
}) {
  const eligible = operation.kind === 'buy' ? operation.availableOrders.filter((order) => order.status === 'open') : [];
  const initialSelected = operation.kind === 'buy' ? (operation.selectedOrders ?? operation.resume?.entries.map((entry) => entry.order) ?? []) : [];
  const initialQuantity = initialSelected.length
    ? formatTokenAmount(initialSelected.reduce((total, order) => total + BigInt(order.quantity), 0n).toString(), state.denomination)
    : eligible[0]
      ? formatTokenAmount(eligible[0].quantity, state.denomination)
      : '';
  const [quantity, setQuantity] = React.useState(
    operation.kind === 'sell' || operation.kind === 'transfer' ? (operation.quantity ?? '') : initialQuantity,
  );
  const [unitPrice, setUnitPrice] = React.useState(operation.kind === 'sell' ? (operation.unitPrice ?? '') : '');
  const [recipient, setRecipient] = React.useState(operation.kind === 'transfer' ? (operation.recipient ?? '') : '');
  const [manualOrderIds, setManualOrderIds] = React.useState<string[]>(initialSelected.map((order) => order.orderId));
  const [matchMode, setMatchMode] = React.useState<'amount' | 'lots'>(initialSelected.length ? 'lots' : 'amount');
  const [phase, setPhase] = React.useState<'form' | 'working' | 'done' | 'error'>(
    (operation.kind === 'buy' && operation.resume) || (operation.kind !== 'buy' && operation.resumeId) ? 'working' : 'form',
  );
  const [message, setMessage] = React.useState('');
  const [views, setViews] = React.useState<ObserverView[]>([]);
  const [transaction, setTransaction] = React.useState<PreparedTransaction | null>(null);
  const [purchaseStates, setPurchaseStates] = React.useState<Record<string, PurchaseState>>({});
  const [activeOrderId, setActiveOrderId] = React.useState(initialSelected[0]?.orderId ?? '');
  const [estimatedCost, setEstimatedCost] = React.useState<string | null>(null);
  const [estimatedWalletBalance, setEstimatedWalletBalance] = React.useState<string | null>(null);
  const [canAfford, setCanAfford] = React.useState<boolean | null>(null);
  const purchasesRef = React.useRef<Map<string, SwapPurchase>>(new Map());
  const networkRef = React.useRef<ArweaveObserverNetwork | null>(null);
	const cleanupTimerRef = React.useRef<number | undefined>();
  const resumed = React.useRef(false);
  const ticker = state.ticker || 'TOKEN';
  const manualOrders = eligible.filter((order) => manualOrderIds.includes(order.orderId));
  const automaticMatchResult = React.useMemo(() => {
    if (operation.kind !== 'buy' || matchMode !== 'amount') return { match: null, error: '' };
	    try {
	      const atomic = parseTokenAmount(quantity, state.denomination);
	      return { match: matchWholeOrders(eligible, atomic), error: '' };
	    } catch (cause) {
	      return {
	        match: null,
	        error: cause instanceof RangeError
	          ? 'This order book is too large for automatic matching. Choose listings directly instead.'
	          : '',
	      };
	    }
  }, [eligible, matchMode, operation.kind, quantity, state.denomination]);
  const automaticMatch = automaticMatchResult.match;
  const matchedOrders = matchMode === 'lots' ? manualOrders : (automaticMatch?.orders ?? []);
  const matchedQuantity = matchedOrders.reduce((total, order) => total + BigInt(order.quantity), 0n);
  const matchedAsking = matchedOrders.reduce((total, order) => total + BigInt(order.asking), 0n);
  const enteredQuantity = safeTokenAmount(quantity, state.denomination);
  const currentLiquid = BigInt(liquidBalanceOf(state, owner));
  const currentListed = BigInt(listedBalanceOf(state, owner));
  const listingQuote = operation.kind === 'sell' ? safeLotQuote(quantity, unitPrice, state) : null;
  const sellValid = operation.kind === 'sell' && enteredQuantity !== null && enteredQuantity <= currentLiquid && listingQuote !== null;
  const transferValid = operation.kind === 'transfer' && ADDRESS.test(recipient) && enteredQuantity !== null && enteredQuantity <= currentLiquid;

	React.useEffect(() => {
		if (cleanupTimerRef.current !== undefined) window.clearTimeout(cleanupTimerRef.current);
		return () => {
			cleanupTimerRef.current = window.setTimeout(() => {
				for (const purchase of purchasesRef.current.values()) purchase.abandon();
				networkRef.current?.stop();
			}, 0);
		};
	}, []);

  React.useEffect(() => {
    if (operation.kind !== 'buy' || !matchedOrders.length || operation.resume) {
      setEstimatedCost(null);
      setEstimatedWalletBalance(null);
      setCanAfford(null);
      return;
    }
    const controller = new AbortController();
    const client = new AssetTransactionClient();
    void Promise.all([
      Promise.all(matchedOrders.map((order) => client.estimatePurchaseCosts(order, asset.id))),
      client.walletBalance(owner),
    ])
      .then(([costs, walletBalance]) => {
        if (!controller.signal.aborted) {
          const total = costs.reduce((sum, item) => sum + BigInt(item.total), 0n);
          setEstimatedCost(total.toString());
          setEstimatedWalletBalance(walletBalance.toString());
          setCanAfford(walletBalance >= total);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setEstimatedCost(null);
          setEstimatedWalletBalance(null);
          setCanAfford(null);
        }
      });
    return () => controller.abort();
  }, [asset.id, matchedOrders.map((order) => order.orderId).join(','), operation.kind, operation.kind === 'buy' ? operation.resume : undefined, owner]);

  React.useEffect(() => {
    const shouldResume = (operation.kind === 'buy' && operation.resume) || (operation.kind !== 'buy' && operation.resumeId);
    if (!shouldResume || resumed.current) return;
    resumed.current = true;
    void submit();
  }, []);

  function chooseLot(order: SwapOrder) {
    setManualOrderIds((current) => {
      const next = current.includes(order.orderId)
        ? current.filter((id) => id !== order.orderId)
        : [...current, order.orderId];
      const total = eligible
        .filter((candidate) => next.includes(candidate.orderId))
        .reduce((sum, candidate) => sum + BigInt(candidate.quantity), 0n);
      setQuantity(formatTokenAmount(total.toString(), state.denomination));
      return next;
    });
  }

  async function submit() {
    setMessage('');
    setPhase('working');
    try {
      const client = new AssetTransactionClient();
      if (operation.kind === 'buy') {
        if (!operation.resume && !matchedOrders.length) throw new Error('Select one or more complete lots.');
        await runPurchaseBatch(client, operation.resume?.entries ?? matchedOrders.map((order) => ({ order, snapshot: {} })), operation.resume);
        return;
      }

      let prepared: PreparedTransaction;
      let rawQuantity = '';
      let asking = '';
      if (transaction) prepared = transaction;
      else if (operation.resumeId) prepared = client.restore(operation.resumeId, owner);
      else if (operation.kind === 'sell') {
        rawQuantity = parseTokenAmount(quantity, state.denomination);
        if (BigInt(rawQuantity) < 1n || BigInt(rawQuantity) > BigInt(liquidBalanceOf(state, owner))) {
          throw new Error('Enter a quantity within your liquid balance.');
        }
        asking = lotAsking(rawQuantity, unitPrice, state.denomination);
        prepared = await client.makeOffer({ processId: asset.id, quantity: rawQuantity, asking, seller: owner });
      } else if (operation.kind === 'cancel') {
        prepared = await client.cancelOrder(asset.id, operation.order.orderId, owner);
      } else {
        rawQuantity = parseTokenAmount(quantity, state.denomination);
        if (!ADDRESS.test(recipient) || BigInt(rawQuantity) < 1n || BigInt(rawQuantity) > BigInt(liquidBalanceOf(state, owner))) {
          throw new Error('Enter a valid recipient and quantity within your liquid balance.');
        }
        prepared = await client.transfer(asset.id, recipient, rawQuantity, owner);
      }
      setTransaction(prepared);
      const recipientStartingBalance = operation.kind === 'transfer'
        ? (operation.recipientStartingBalance ?? state.balances[recipient] ?? '0')
        : undefined;
      localStorage.setItem(`bazar-operation:${asset.id}`, JSON.stringify({
        txId: prepared.id,
        kind: operation.kind,
        assetId: asset.id,
        signer: owner,
        ...(operation.kind === 'cancel'
          ? { order: operation.order }
          : operation.kind === 'sell'
            ? { quantity, unitPrice }
            : { quantity, recipient, recipientStartingBalance }),
        createdAt: Date.now(),
      }));
      await dispatchAndConfirm(prepared, { target: 5, onViews: setViews });
      setMessage('Five confirmations reached. Waiting for live token state…');
      if (operation.kind === 'sell') {
        const expectedQuantity = rawQuantity || parseTokenAmount(operation.quantity ?? quantity, state.denomination);
        const expectedAsking = asking || lotAsking(expectedQuantity, operation.unitPrice ?? unitPrice, state.denomination);
        await client.waitForOfferAcceptance(asset.id, {
          orderId: prepared.id,
          seller: owner,
          quantity: expectedQuantity,
          asking: expectedAsking,
          minimumFee: DEFAULT_REGISTRATION_FEE.toString(),
        });
      } else if (operation.kind === 'cancel') {
        await client.waitForOrderCancelled(asset.id, operation.order.orderId);
      } else {
        const expectedQuantity = rawQuantity || parseTokenAmount(operation.quantity ?? quantity, state.denomination);
        const receiverStart = BigInt(operation.recipientStartingBalance ?? recipientStartingBalance ?? '0');
        await client.waitForAssetBalance(
          asset.id,
          operation.recipient ?? recipient,
          (receiverStart + BigInt(expectedQuantity)).toString(),
        );
      }
      localStorage.removeItem(`bazar-operation:${asset.id}`);
      setPhase('done');
    } catch (cause) {
      setMessage(errorMessage(cause));
      setPhase('error');
    }
  }

  async function runPurchaseBatch(
    client: AssetTransactionClient,
    requested: Array<Pick<BatchEntry, 'order' | 'snapshot'>>,
    resume?: BatchResume,
  ) {
    const network = new ArweaveObserverNetwork(assetObserverNetworkOptions());
    networkRef.current = network;
    await network.ready();
	    let entries: BatchEntry[];
	    const preparedByOrder = new Map<string, PreparedPurchase>();
	    if (resume) entries = resume.entries;
	    else {
      const prepared = await client.preparePurchaseBatch(
        requested.map(({ order }) => ({
          processId: asset.id,
          order,
          buyer: owner,
          startingBalance: operation.kind === 'buy' ? operation.startingBalance : '0',
          network,
        })),
      );
	      entries = prepared.map((item) => {
	        preparedByOrder.set(item.order.orderId, item);
	        return preparedEntry(item);
	      });
    }
	    const saved: BatchResume = {
	      version: 2,
      buyer: owner,
      startingBalance: operation.kind === 'buy' ? operation.startingBalance : '0',
      entries,
    };
    localStorage.setItem(batchStorageKey(asset.id, owner), JSON.stringify(saved));
    if (!activeOrderId) setActiveOrderId(entries[0].order.orderId);

	    let registrationsReady = 0;
	    let releasePayments!: () => void;
	    let rejectPayments!: (cause: unknown) => void;
	    const paymentGate = new Promise<void>((resolve, reject) => {
	      releasePayments = resolve;
	      rejectPayments = reject;
	    });
	    void paymentGate.catch(() => undefined);
	    const totalPaymentCost = entries.reduce((total, entry) => total + BigInt(entry.paymentCost), 0n);

	    const running = entries.map((entry) => {
	      const adapter = client.purchaseAdapter({
	        processId: asset.id,
	        order: entry.order,
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
	        waitForRegistrationAcceptance: async (context: Parameters<NonNullable<typeof waitForRegistrationAcceptance>>[0]) => {
	          try {
	            await waitForRegistrationAcceptance?.(context);
	            registrationsReady += 1;
	            if (registrationsReady === entries.length) {
	              if (await client.walletBalance(owner) < totalPaymentCost) {
	                throw new Error('The wallet no longer has enough AR to pay every reserved listing. No seller payment was sent.');
	              }
	              releasePayments();
	            }
	            await paymentGate;
	          } catch (cause) {
	            rejectPayments(cause);
	            throw cause;
	          }
	        },
	      };
	      const purchase = new SwapPurchase(
	        network,
	        coordinatedAdapter,
	        {
          registrationTarget: 5,
          paymentTarget: 5,
          paymentSuccessDepth: 1,
          skipFrom: 2,
          propagation: 'all',
          minObservers: 2,
	          ...(resume ? { resume: entry.snapshot } : {}),
        },
      );
      purchasesRef.current.set(entry.order.orderId, purchase);
      const update = (purchaseState: PurchaseState) => {
        setPurchaseStates((current) => ({ ...current, [entry.order.orderId]: purchaseState }));
        entry.snapshot = purchase.snapshot();
        localStorage.setItem(batchStorageKey(asset.id, owner), JSON.stringify(saved));
      };
      purchase.on('state', update);
	      purchase.on('failed', (purchaseState) => {
	        rejectPayments(new Error(purchaseState.error?.message ?? 'A reservation could not complete. No remaining seller payment was sent.'));
	        update(purchaseState);
	      });
      purchase.on('complete', update);
      update(purchase.state());
      return purchase.run();
    });

    const results = await Promise.all(running);
    if (results.some((result) => result.stage !== 'complete' || !result.success)) {
			const failed = results.filter((result) => result.stage !== 'complete' || !result.success);
			const reasons = [...new Set(failed.flatMap((result) => result.error?.message ? [result.error.message] : []))];
			throw new Error(`${failed.length} of ${results.length} settlements need attention.${reasons.length ? ` ${reasons.join(' ')}` : ''}`);
    }
    setMessage('Every lot reported success. Verifying the aggregate token balance…');
    await client.waitForPurchaseBatch(asset.id, owner, saved.startingBalance, entries.map((entry) => entry.order));
    localStorage.removeItem(batchStorageKey(asset.id, owner));
    setPhase('done');
  }

  const visibleOrders = operation.kind === 'buy'
    ? (operation.resume?.entries.map((entry) => entry.order) ?? matchedOrders)
    : [];
  const activeOrder = visibleOrders.find((order) => order.orderId === activeOrderId) ?? visibleOrders[0];
	  const activePurchase = activeOrder ? purchaseStates[activeOrder.orderId] : undefined;
	  const incompletePurchases = visibleOrders.filter((order) => purchaseStates[order.orderId]?.stage !== 'complete').length;
	  const completedPurchaseQuantity = visibleOrders.reduce((total, order) => total + BigInt(order.quantity), 0n);
	  const settledPurchases = visibleOrders.length - incompletePurchases;
	  const payingPurchases = visibleOrders.filter((order) => {
	    const stage = purchaseStates[order.orderId]?.stage ?? '';
	    return stage.includes('payment') || stage === 'ownership-verifying';
	  }).length;
  const purchaseSteps: ArweaveSyncStep[] = activePurchase ? [
	    { key: 'register', label: 'Reserve listing', target: 5, transaction: activePurchase.registration },
    { key: 'pay', label: 'Pay seller', target: 5, transaction: activePurchase.payment },
  ] : [];
  const activeStep = activePurchase?.stage.includes('payment') || activePurchase?.stage === 'ownership-verifying' ? 'pay' : 'register';
  const singleSteps: ArweaveSyncStep[] = transaction ? [{
    key: operation.kind,
    label: operationLabel(operation.kind),
    target: 5,
    transaction: { id: transaction.id, views },
  }] : [];
	  const formError = operation.kind === 'buy' && !matchedOrders.length
	    ? automaticMatchResult.error || (quantity
	      ? `No complete-listing combination totals ${quantity} ${ticker}. Choose listings instead.`
	      : 'Enter an amount to buy, or choose listings directly.')
	    : '';

  return (
    <div className="dialog-backdrop" role="presentation">
	      <div className="dialog fungible-dialog" role="dialog" aria-labelledby="fungible-dialog-title" aria-modal="true">
	        <div className="dialog-heading">
	          <div><p className="eyebrow">{operationLabel(operation.kind)}</p><h2 id="fungible-dialog-title">{asset.name}</h2></div>
	          {phase !== 'working' ? <button className="close" onClick={onClose} aria-label="Close dialog"><X /></button>
	            : transaction || activePurchase ? <button className="sync-close" onClick={onClose} type="button">Continue in background</button>
	              : null}
        </div>
        {phase === 'form' ? (
          <div className="trade-form">
            {operation.kind === 'sell' ? <>
              <div className="trade-balance"><span>Available to list</span><strong>{tokenLabel(liquidBalanceOf(state, owner), state)}</strong></div>
              <div className="trade-fields">
	                <label>Token quantity<input aria-invalid={Boolean(quantity) && (enteredQuantity === null || enteredQuantity > currentLiquid)} autoFocus inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="100" /></label>
	                <label>Price per {ticker} in AR<input aria-invalid={Boolean(unitPrice) && listingQuote === null} inputMode="decimal" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="0.01" /></label>
	              </div>
	              {listingQuote ? (
	                <div className="trade-quote"><span>Listing total</span><strong>{listingQuote} AR</strong></div>
	              ) : null}
	              {enteredQuantity && enteredQuantity <= currentLiquid ? (
	                <div className="trade-quote">
	                  <span>After network confirmation</span>
	                  <strong>{tokenLabel((currentLiquid - enteredQuantity).toString(), state)} liquid · {tokenLabel((currentListed + enteredQuantity).toString(), state)} listed</strong>
	                </div>
	              ) : null}
	              {quantity && (enteredQuantity === null || enteredQuantity > currentLiquid) ? <p className="trade-guidance">Enter a quantity up to {tokenLabel(currentLiquid.toString(), state)}.</p> : null}
	              <p className="settlement-disclosure">Listed tokens move into order escrow after network confirmation. Network fees are shown by your wallet before signing.</p>
	            </> : null}
            {operation.kind === 'transfer' ? <>
              <div className="trade-balance"><span>Available to send</span><strong>{tokenLabel(liquidBalanceOf(state, owner), state)}</strong></div>
	              <label>Recipient wallet address<input aria-invalid={Boolean(recipient) && !ADDRESS.test(recipient)} autoFocus value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="43-character Arweave address" /></label>
	              {recipient && !ADDRESS.test(recipient) ? <p className="trade-guidance">Enter a 43-character Arweave wallet address.</p> : null}
	              <label>Token quantity<input aria-invalid={Boolean(quantity) && (enteredQuantity === null || enteredQuantity > currentLiquid)} inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="100" /></label>
	              {quantity && (enteredQuantity === null || enteredQuantity > currentLiquid) ? <p className="trade-guidance">Enter a quantity up to {tokenLabel(currentLiquid.toString(), state)}.</p> : null}
            </> : null}
            {operation.kind === 'cancel' ? (
              <div className="cancel-summary">
                <CircleX aria-hidden="true" />
	                <div>
	                  <strong>Return this listing to your balance?</strong>
	                  <span>{tokenLabel(operation.order.quantity, state)} · {winstonToAr(operation.order.asking)} AR total</span>
	                  <span>After network confirmation: {tokenLabel((currentLiquid + BigInt(operation.order.quantity)).toString(), state)} liquid · {tokenLabel((currentListed - BigInt(operation.order.quantity)).toString(), state)} listed</span>
	                  <span>A reserved listing cannot be cancelled. This listing is currently open.</span>
	                </div>
              </div>
            ) : null}
            {operation.kind === 'buy' ? <>
              <div className="order-match-mode" role="tablist" aria-label="Order matching method">
                <button
                  aria-selected={matchMode === 'amount'}
                  className={matchMode === 'amount' ? 'active' : undefined}
                  onClick={() => {
                    setMatchMode('amount');
                    setManualOrderIds([]);
                  }}
                  role="tab"
                  type="button"
                >
	                  Buy exact amount
                </button>
                <button
                  aria-selected={matchMode === 'lots'}
                  className={matchMode === 'lots' ? 'active' : undefined}
                  onClick={() => {
                    const selected = automaticMatch?.orders ?? [];
                    setMatchMode('lots');
                    setManualOrderIds(selected.map((order) => order.orderId));
                  }}
                  role="tab"
                  type="button"
                >
                  Choose listings
                </button>
              </div>
              {matchMode === 'amount' ? (
	                <>
	                  <label>Amount to buy<input autoFocus inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
	                  <p className="trade-guidance">Uses the lowest-priced combination of complete listings. Listings cannot be partially filled.</p>
	                </>
              ) : (
                <div className="lot-picker" aria-label="Available listings">
                  <div><strong>Available listings</strong><span>Select any combination</span></div>
                  {eligible.map((order) => (
                    <button
                      className={matchedOrders.some((matched) => matched.orderId === order.orderId) ? 'selected' : undefined}
                      key={order.orderId}
                      onClick={() => chooseLot(order)}
                      type="button"
                    >
                      <span>{tokenLabel(order.quantity, state)}</span>
                      <strong>{orderPriceLabel(order, state)}</strong>
                      <small>{winstonToAr(order.asking)} AR total · {short(order.creator)}</small>
                    </button>
                  ))}
                </div>
              )}
              {formError ? <p className="trade-guidance">{formError}</p> : null}
              {matchedOrders.length ? (
                <div className="batch-quote">
                  <div><span>You receive</span><strong>{tokenLabel(matchedQuantity.toString(), state)}</strong></div>
	                  <div><span>Listings matched</span><strong>{matchedOrders.length}</strong></div>
	                  <div><span>Listing subtotal</span><strong>{winstonToAr(matchedAsking.toString())} AR</strong></div>
	                  <div><span>Network fees</span><strong>{estimatedCost ? `${winstonToAr((BigInt(estimatedCost) - matchedAsking).toString())} AR` : 'Checking…'}</strong></div>
	                  <div><span>Maximum total</span><strong>{estimatedCost ? `${winstonToAr(estimatedCost)} AR` : 'Checking…'}</strong></div>
	                  <div><span>Wallet after purchase</span><strong>{canAfford === false ? 'Insufficient AR' : estimatedCost && estimatedWalletBalance ? `${winstonToAr((BigInt(estimatedWalletBalance) - BigInt(estimatedCost)).toString())} AR` : 'Checking…'}</strong></div>
                </div>
              ) : null}
              {canAfford === false ? <p className="trade-guidance">This wallet does not have enough AR for the listings and network fees.</p> : null}
              {matchedOrders.length ? (
                <p className="settlement-disclosure">
                  Each listing completes separately. If one becomes unavailable, completed purchases remain final.
							Your wallet will ask for {matchedOrders.length * 2} approvals: one reservation and one payment for each listing. After approval, all settlements run in parallel.
                </p>
              ) : null}
            </> : null}
	            <button
	              className="primary wide"
	              disabled={
	                (operation.kind === 'buy' && (!matchedOrders.length || !estimatedCost || canAfford !== true)) ||
	                (operation.kind === 'sell' && !sellValid) ||
	                (operation.kind === 'transfer' && !transferValid)
	              }
	              onClick={() => void submit()}
	            >
	              {operation.kind === 'buy' && matchedOrders.length
	                ? `Buy ${formatGroupedTokenAmount(matchedQuantity.toString(), state.denomination)} ${ticker} from ${matchedOrders.length} ${matchedOrders.length === 1 ? 'listing' : 'listings'} · up to ${estimatedCost ? winstonToAr(estimatedCost) : '…'} AR`
	                : operation.kind === 'sell' && listingQuote && enteredQuantity
	                  ? `List ${tokenLabel(enteredQuantity.toString(), state)} for ${listingQuote} AR`
	                  : operation.kind === 'cancel'
	                    ? `Cancel listing and return ${tokenLabel(operation.order.quantity, state)}`
	                    : operation.kind === 'transfer' && enteredQuantity
	                      ? `Send ${tokenLabel(enteredQuantity.toString(), state)}`
	                      : operationLabel(operation.kind)}
	            </button>
          </div>
        ) : null}
	        {phase === 'working' ? <div aria-live="polite">
	          <p className="sync-intro">
            {operation.kind === 'buy' && visibleOrders.length > 1
	              ? `${visibleOrders.length} listings are settling independently. Switch between them below while every transaction continues in parallel.`
              : 'Signed. Now watching independent Arweave nodes agree on the transaction.'}
	          </p>
	          {transaction || activePurchase ? <p className="sync-resume-note">This action will resume automatically when you return.</p> : null}
          {message ? <p className="scheduler-wait">{message}</p> : null}
	          {operation.kind === 'buy' && visibleOrders.length ? <>
	            <p className="parallel-summary">{visibleOrders.length} listings · {settledPurchases} settled · {payingPurchases} paying · {visibleOrders.length - settledPurchases - payingPurchases} reserving</p>
	            <div className="settlement-tabs" role="tablist" aria-label="Parallel settlements">
              {visibleOrders.map((order, index) => {
                const purchase = purchaseStates[order.orderId];
                return (
	                  <button
	                    aria-controls={`settlement-panel-${order.orderId}`}
	                    aria-selected={order.orderId === (activeOrder?.orderId ?? visibleOrders[0].orderId)}
                    className={order.orderId === (activeOrder?.orderId ?? visibleOrders[0].orderId) ? 'active' : undefined}
                    key={order.orderId}
                    onClick={() => setActiveOrderId(order.orderId)}
                    role="tab"
                    type="button"
                  >
	                    <span>Listing {index + 1}</span>
                    <strong>{tokenLabel(order.quantity, state)}</strong>
                    <small>{batchStageLabel(purchase)}</small>
                  </button>
                );
              })}
            </div>
	            {activeOrder && activePurchase ? (
	              <div id={`settlement-panel-${activeOrder.orderId}`} role="tabpanel">
	                <ArweaveTransactionSync subject={`${asset.name} · ${tokenLabel(activeOrder.quantity, state)}`} steps={purchaseSteps} activeStep={activeStep} />
	              </div>
	            ) : <Loading label="Preparing each reservation and payment for your approval…" />}
          </> : singleSteps.length ? (
            <ArweaveTransactionSync subject={asset.name} steps={singleSteps} activeStep={operation.kind} />
          ) : <Loading label="Preparing the exact signed transaction…" />}
	        </div> : null}
	        {phase === 'done' ? (
	          <div className="result success" role="status">
	            <h3>{operation.kind === 'buy' ? 'Purchase complete' : operation.kind === 'sell' ? 'Tokens listed' : operation.kind === 'cancel' ? 'Listing cancelled' : 'Transfer complete'}</h3>
	            <p>{operation.kind === 'buy'
	              ? `${tokenLabel(completedPurchaseQuantity.toString(), state)} received from ${visibleOrders.length} ${visibleOrders.length === 1 ? 'listing' : 'listings'} · ${winstonToAr(visibleOrders.reduce((total, order) => total + BigInt(order.asking), 0n).toString())} AR paid to sellers.`
	              : operation.kind === 'sell' && enteredQuantity && listingQuote
	                ? `${tokenLabel(enteredQuantity.toString(), state)} listed for ${listingQuote} AR.`
	                : operation.kind === 'cancel'
	                  ? `${tokenLabel(operation.order.quantity, state)} returned to your liquid balance.`
	                  : enteredQuantity
	                    ? `${tokenLabel(enteredQuantity.toString(), state)} sent to ${short(recipient)}.`
	                    : 'The live token state now reflects this action.'}</p>
	            {transaction ? <a href={`https://arweave.net/${transaction.id}`} rel="noreferrer" target="_blank">View transaction {short(transaction.id)} ↗</a> : null}
	            {operation.kind === 'buy' ? <div className="result-links">{visibleOrders.flatMap((order, index) => {
	              const paymentId = purchaseStates[order.orderId]?.payment?.id;
	              return paymentId ? [<a href={`https://arweave.net/${paymentId}`} key={paymentId} rel="noreferrer" target="_blank">Payment {index + 1} · {short(paymentId)} ↗</a>] : [];
	            })}</div> : null}
	            <button className="primary with-icon" onClick={onClose}><ArrowLeft className="ui-icon ui-icon--sm" /> View updated order book</button>
	          </div>
	        ) : null}
	        {phase === 'error' ? (
	          <div className="result error" role="alert">
	            <h3>Could not complete this action</h3><p>{message}</p>
	            {operation.kind === 'buy' && visibleOrders.length ? <div className="settlement-tabs" aria-label="Settlement recovery status">{visibleOrders.map((order, index) => (
	              <button key={order.orderId} onClick={() => setActiveOrderId(order.orderId)} type="button"><span>Listing {index + 1}</span><strong>{tokenLabel(order.quantity, state)}</strong><small>{batchStageLabel(purchaseStates[order.orderId])}</small></button>
	            ))}</div> : null}
	            {operation.kind === 'buy' ? <><p>Completed purchases are final; only incomplete settlements will resume.</p><button onClick={() => window.location.reload()}>Resume {incompletePurchases} incomplete {incompletePurchases === 1 ? 'settlement' : 'settlements'}</button></>
	              : transaction ? <button onClick={() => void submit()}>Resume the signed transaction</button>
                : <button onClick={() => setPhase('form')}>Review and try again</button>}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function preparedEntry(prepared: PreparedPurchase): BatchEntry {
  return { order: prepared.order, snapshot: prepared.snapshot, paymentCost: prepared.paymentCost };
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

function tokenLabel(raw: string, state: AssetState) {
  return `${formatGroupedTokenAmount(raw, state.denomination)} ${state.ticker || 'tokens'}`;
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
  return { 'make-offer': 'Listed tokens', 'register-interest': 'Reservation submitted', transfer: 'Tokens transferred', 'cancel-order': 'Listing cancelled' }[action];
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp * 1000));
}

function short(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-5)}`;
}

function Loading({ label }: { label: string }) {
  return <div className="loading"><span />{label}</div>;
}

function ErrorPanel({ message }: { message: string }) {
  return <div className="error-panel"><strong>Unable to load</strong><span>{message}</span></div>;
}

function errorMessage(error: unknown) {
  const value = error instanceof Error ? error.message : String(error);
  return value.replaceAll('-', ' ');
}
