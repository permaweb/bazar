import React from 'react';
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import {
	SwapPurchase,
	type ObserverView,
	type PreparedTransaction,
	type PurchaseSnapshot,
	type PurchaseState,
} from 'weave-wrangler';

import { loadCollections, loadMoreCarrierNames, type AssetSummary, type Collection } from 'api/collections';
import {
	ownerOfAsset,
	readAssetState,
	type AssetState,
	type SwapOrder,
} from 'api/asset-marketplace';
import { ArweaveObserverNetwork } from 'api/arweave-observers';
import { assetObserverNetworkOptions } from 'api/asset-observers';
import {
	AssetTransactionClient,
	DEFAULT_REGISTRATION_FEE,
	dispatchAndConfirm,
} from 'api/asset-transactions';
import {
	ArweaveTransactionSync,
	type ArweaveSyncStep,
} from 'components/ArweaveTransactionSync';
import { useWallet } from 'providers/WalletProvider';

import './styles.css';

type MarketContextValue = {
	collections: Collection[];
	loading: boolean;
	error: string | null;
	loadMore(collectionId: string): Promise<void>;
};

const MarketContext = React.createContext<MarketContextValue>({
	collections: [],
	loading: true,
	error: null,
	loadMore: async () => undefined,
});

export function App() {
	const [market, setMarket] = React.useState<MarketContextValue>({
		collections: [],
		loading: true,
		error: null,
		loadMore: async () => undefined,
	});
	React.useEffect(() => {
		const controller = new AbortController();
		loadCollections(controller.signal).then(
			(collections) => setMarket((current) => ({ ...current, collections, loading: false, error: null })),
			(error) => {
				if (!controller.signal.aborted) {
					setMarket((current) => ({ ...current, collections: [], loading: false, error: errorMessage(error) }));
				}
			}
		);
		return () => controller.abort();
	}, []);
	const loadMore = React.useCallback(async (collectionId: string) => {
		const collection = market.collections.find((item) => item.id === collectionId);
		if (!collection) return;
		const updated = await loadMoreCarrierNames(collection);
		setMarket((current) => ({
			...current,
			collections: current.collections.map((item) => item.id === collectionId ? updated : item),
		}));
	}, [market.collections]);
	const value = React.useMemo(() => ({ ...market, loadMore }), [loadMore, market]);

	return (
		<MarketContext.Provider value={value}>
			<HashRouter>
				<RouteScroll />
				<Header />
				<main>
					<Routes>
						<Route path="/" element={<Home />} />
						<Route path="/collection/:collectionId" element={<CollectionView />} />
						<Route path="/asset/:collectionId/:assetId" element={<AssetView />} />
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
				</main>
				<footer>
					<span>Bazar 2.0</span>
					<span>Ownership, offers, and settlement live on Arweave.</span>
				</footer>
			</HashRouter>
		</MarketContext.Provider>
	);
}

function RouteScroll() {
	const { pathname } = useLocation();
	React.useEffect(() => {
		window.scrollTo({ top: 0, left: 0 });
	}, [pathname]);
	return null;
}

function Header() {
	const wallet = useWallet();
	return (
		<header>
			<Link className="brand" to="/">
				<span className="brand-mark">B</span>
				<span>Bazar</span>
			</Link>
			<nav>
				<Link to="/">Collections</Link>
				<GatewayControl />
				{wallet.loadDevelopmentWallet ? (
					<label className="development-wallet">
						Test wallet
						<input
							type="file"
							accept=".json,application/json"
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (file) void wallet.loadDevelopmentWallet?.(file);
							}}
						/>
					</label>
				) : null}
				<button className="wallet" onClick={() => void (wallet.address ? wallet.disconnect() : wallet.connect())}>
					{wallet.address ? short(wallet.address) : 'Connect wallet'}
				</button>
			</nav>
		</header>
	);
}

function Home() {
	const market = React.useContext(MarketContext);
	return (
		<>
			<section className="hero">
				<p className="eyebrow">ARWEAVE-NATIVE MARKETPLACE</p>
				<h1>Assets that belong<br />to their owners.</h1>
				<p className="lead">
					Buy and sell permanent assets without a custodian, intermediary, or marketplace backend.
				</p>
				<div className="principles">
					<span>Direct wallet ownership</span>
					<span>AR settlement</span>
					<span>Any HyperBEAM gateway</span>
				</div>
			</section>
			<section className="content-section">
				<div className="section-heading">
					<div>
						<p className="eyebrow">LIVE COLLECTIONS</p>
						<h2>Explore the weave</h2>
					</div>
					<p>Every item below resolves from permanent data and live process state.</p>
				</div>
				{market.loading ? <Loading label="Loading collection indexes from Arweave…" /> : null}
				{market.error ? <ErrorPanel message={market.error} /> : null}
				<div className="collection-grid">
					{market.collections.map((collection, index) => (
						<Link className={`collection-card tone-${index % 3}`} key={collection.id} to={`/collection/${collection.id}`}>
							<div className="collection-art" aria-hidden="true">
								{collection.kind === 'names' ? <span className="name-glyph">A</span> : <AssetMosaic assets={collection.assets} />}
							</div>
							<div>
								<p className="count">{(collection.total ?? collection.assets.length).toLocaleString()} assets</p>
								<h3>{collection.name}</h3>
								<p>{collection.description}</p>
							</div>
							<span className="arrow">↗</span>
						</Link>
					))}
				</div>
			</section>
		</>
	);
}

function GatewayControl() {
	const current = new URLSearchParams(window.location.search).get('node') ?? 'https://arweave.net';
	const [value, setValue] = React.useState(current);
	function apply() {
		try {
			const origin = new URL(value.includes('://') ? value : `https://${value}`).origin;
			const url = new URL(window.location.href);
			url.searchParams.set('node', origin);
			window.location.assign(url);
		} catch {
			setValue(current);
		}
	}
	return (
		<details className="gateway">
			<summary title={current}>Compute gateway</summary>
			<div>
				<label>HyperBEAM gateway<input value={value} onChange={(event) => setValue(event.target.value)} /></label>
				<button onClick={apply}>Use gateway</button>
				<p>Process reads and browser-safe observer checks use this node. Transactions still settle on Arweave.</p>
			</div>
		</details>
	);
}

function CollectionView() {
	const { collectionId = '' } = useParams();
	const market = React.useContext(MarketContext);
	const collection = market.collections.find((item) => item.id === collectionId);
	const [query, setQuery] = React.useState('');
	const [limit, setLimit] = React.useState(48);
	if (market.loading) return <Loading label="Reading collection index…" />;
	if (!collection) return <ErrorPanel message="This collection could not be found on Arweave." />;
	const filtered = collection.assets.filter((asset) => asset.name.toLowerCase().includes(query.toLowerCase()));
	return (
		<section className="collection-page">
			<Link className="back" to="/">← All collections</Link>
			<div className="collection-title">
				<div>
					<p className="eyebrow">{collection.kind === 'names' ? 'CARRIER ASSETS' : 'TOKEN ASSETS'}</p>
					<h1>{collection.name}</h1>
				</div>
				<p>{collection.description}</p>
			</div>
			<div className="asset-tools">
				<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this collection" />
				<span>
					{query
						? `${filtered.length.toLocaleString()} loaded matches`
						: `${collection.assets.length.toLocaleString()} of ${(collection.total ?? collection.assets.length).toLocaleString()}`}
				</span>
			</div>
			<div className="asset-grid">
				{filtered.slice(0, limit).map((asset) => (
					<AssetCard key={asset.id} collection={collection} asset={asset} />
				))}
			</div>
			{limit < filtered.length ? (
				<button className="load-more" onClick={() => setLimit((value) => value + 48)}>Show more</button>
			) : collection.hasMore && !query ? (
				<button className="load-more" onClick={() => void market.loadMore(collection.id)}>Load 100 more from Arweave</button>
			) : null}
		</section>
	);
}

function AssetCard({ collection, asset }: { collection: Collection; asset: AssetSummary }) {
	return (
		<Link className="asset-card" to={`/asset/${collection.id}/${asset.id}`}>
			<div className="asset-media">
				{asset.image ? <img src={asset.image} loading="lazy" alt="" /> : <span>{asset.name.slice(0, 1).toUpperCase()}</span>}
			</div>
			<div className="asset-card-copy">
				<p>{collection.name}</p>
				<h3>{asset.name}</h3>
				<span>{short(asset.id)}</span>
			</div>
		</Link>
	);
}

function AssetView() {
	const { collectionId = '', assetId = '' } = useParams();
	const market = React.useContext(MarketContext);
	const wallet = useWallet();
	const collection = market.collections.find((item) => item.id === collectionId);
	const asset = collection?.assets.find((item) => item.id === assetId);
	const [state, setState] = React.useState<AssetState | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [operation, setOperation] = React.useState<Operation | null>(null);
	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setState((await readAssetState(assetId)).state);
		} catch (cause) {
			setError(errorMessage(cause));
		} finally {
			setLoading(false);
		}
	}, [assetId]);
	React.useEffect(() => void load(), [load]);
	React.useEffect(() => {
		if (!wallet.address || operation || !state) return;
		try {
			const saved = JSON.parse(localStorage.getItem(`bazar-purchase:${assetId}`) ?? 'null');
			if (saved?.buyer === wallet.address && saved?.order) {
				if (!state.orders[saved.order.orderId] && state.balances[wallet.address] === '1') {
					localStorage.removeItem(`bazar-purchase:${assetId}`);
				} else {
					setOperation({ kind: 'buy', order: saved.order, resume: saved.snapshot });
					return;
				}
			}
			const order = liveOrder(state);
			if (order && order.creator !== wallet.address) {
				const client = new AssetTransactionClient();
				const registrationId = client.findStoredRegistration(assetId, order.orderId, wallet.address);
				if (registrationId) {
					setOperation({
						kind: 'buy',
						order,
						resume: {
							registration: { id: registrationId, dispatched: false },
						},
					});
					return;
				}
			}
			const savedOperation = JSON.parse(localStorage.getItem(`bazar-operation:${assetId}`) ?? 'null');
			if (
				savedOperation?.signer === wallet.address &&
				typeof savedOperation?.txId === 'string' &&
				['sell', 'cancel', 'transfer'].includes(savedOperation?.kind)
			) {
				if (savedOperation.kind === 'cancel' && savedOperation.order) {
					setOperation({
						kind: 'cancel',
						order: savedOperation.order,
						resumeId: savedOperation.txId,
					});
				} else {
					setOperation({
						kind: savedOperation.kind,
						resumeId: savedOperation.txId,
						value: savedOperation.value,
					});
				}
			}
		} catch {
			localStorage.removeItem(`bazar-purchase:${assetId}`);
			localStorage.removeItem(`bazar-operation:${assetId}`);
		}
	}, [assetId, operation, state, wallet.address]);
	if (!collection || !asset) return <ErrorPanel message="This asset is not in the selected collection." />;
	const owner = state ? ownerOfAsset(state) : null;
	const order = state ? liveOrder(state) : null;
	const mine = Boolean(wallet.address && owner === wallet.address);
	return (
		<section className="asset-page">
			<Link className="back" to={`/collection/${collection.id}`}>← {collection.name}</Link>
			<div className="asset-layout">
				<div className="asset-hero-media">
					{asset.image ? <img src={asset.image} alt={asset.name} /> : <span>{asset.name.slice(0, 1).toUpperCase()}</span>}
				</div>
				<div className="asset-details">
					<p className="eyebrow">{collection.name}</p>
					<h1>{asset.name}</h1>
					<p className="permanent-id">Process <a href={`https://arweave.net/${asset.id}`} target="_blank" rel="noreferrer">{asset.id}</a></p>
					{loading ? <Loading label="Computing current state…" /> : null}
					{error ? <ErrorPanel message={error} /> : null}
					{state ? (
						<div className="facts">
							<div><span>Owner</span><strong>{owner ? short(owner) : 'Unassigned'}</strong></div>
							<div><span>Execution</span><strong>{state.device || 'token@1.0'}</strong></div>
							<div><span>Status</span><strong>{order ? 'Listed for sale' : 'Not listed'}</strong></div>
							{order ? <div><span>Price</span><strong>{winstonToAr(order.asking)} AR</strong></div> : null}
						</div>
					) : null}
					<div className="actions">
						{!wallet.address ? <button className="primary" onClick={() => void wallet.connect()}>Connect wallet</button> : null}
						{wallet.address && order && !mine ? (
							<button className="primary" onClick={() => setOperation({ kind: 'buy', order })}>Buy for {winstonToAr(order.asking)} AR</button>
						) : null}
						{wallet.address && mine && !order ? (
							<button className="primary" onClick={() => setOperation({ kind: 'sell' })}>List for sale</button>
						) : null}
						{wallet.address && mine && order?.status === 'open' ? (
							<button onClick={() => setOperation({ kind: 'cancel', order })}>Cancel listing</button>
						) : null}
						{wallet.address && mine && !order ? (
							<button onClick={() => setOperation({ kind: 'transfer' })}>Transfer</button>
						) : null}
						<button onClick={() => void load()}>Refresh state</button>
					</div>
				</div>
			</div>
			{operation && wallet.address ? (
				<OperationDialog
					asset={asset}
					owner={wallet.address}
					operation={operation}
					onClose={() => { setState(null); setOperation(null); void load(); }}
				/>
			) : null}
		</section>
	);
}

type Operation =
	| { kind: 'sell' | 'transfer'; resumeId?: string; value?: string }
	| { kind: 'cancel'; order: SwapOrder; resumeId?: string }
	| { kind: 'buy'; order: SwapOrder; resume?: PurchaseSnapshot };

function OperationDialog({
	asset,
	owner,
	operation,
	onClose,
}: {
	asset: AssetSummary;
	owner: string;
	operation: Operation;
	onClose(): void;
}) {
	const [value, setValue] = React.useState(
		operation.kind === 'sell' || operation.kind === 'transfer' ? operation.value ?? '' : ''
	);
	const [phase, setPhase] = React.useState<'form' | 'working' | 'done' | 'error'>(
		(operation.kind === 'buy' && operation.resume) ||
			(operation.kind !== 'buy' && operation.resumeId)
			? 'working'
			: 'form'
	);
	const [message, setMessage] = React.useState('');
	const [views, setViews] = React.useState<ObserverView[]>([]);
	const [transaction, setTransaction] = React.useState<PreparedTransaction | null>(null);
	const [purchaseState, setPurchaseState] = React.useState<PurchaseState | null>(null);
	const purchaseRef = React.useRef<SwapPurchase | null>(null);
	const networkRef = React.useRef<ArweaveObserverNetwork | null>(null);
	const lifecycleRef = React.useRef<object | null>(null);

	React.useEffect(() => {
		const lifecycle = {};
		lifecycleRef.current = lifecycle;
		return () => {
			queueMicrotask(() => {
				if (lifecycleRef.current !== lifecycle) return;
				purchaseRef.current?.abandon();
				networkRef.current?.stop();
			});
		};
	}, []);
	const resumed = React.useRef(false);
	React.useEffect(() => {
		const shouldResume =
			(operation.kind === 'buy' && operation.resume) ||
			(operation.kind !== 'buy' && operation.resumeId);
		if (!shouldResume || resumed.current) return;
		resumed.current = true;
		void submit();
	}, []);

	async function submit() {
		setPhase('working');
		try {
			const client = new AssetTransactionClient();
			if (operation.kind === 'buy') {
				const network = new ArweaveObserverNetwork(assetObserverNetworkOptions());
				networkRef.current = network;
				await network.ready();
				const purchase = new SwapPurchase(
					network,
					client.purchaseAdapter({
						processId: asset.id,
						order: operation.order,
						buyer: owner,
						network,
					}),
					{
						registrationTarget: 5,
						paymentTarget: 5,
						paymentSuccessDepth: 1,
						skipFrom: 2,
						propagation: 'all',
						minObservers: 2,
						...(operation.resume ? { resume: operation.resume } : {}),
					}
				);
				purchaseRef.current = purchase;
				const update = (state: PurchaseState) => {
					setPurchaseState(state);
					localStorage.setItem(
						`bazar-purchase:${asset.id}`,
						JSON.stringify({
							asset: { id: asset.id, name: asset.name },
							buyer: owner,
							order: operation.order,
							snapshot: purchase.snapshot(),
						})
					);
				};
				purchase.on('state', update);
				purchase.on('failed', update);
				purchase.on('complete', update);
				update(purchase.state());
				const finalState = await purchase.run();
				if (finalState.stage !== 'complete' || !finalState.success) {
					throw new Error(finalState.error?.message ?? finalState.error?.code ?? 'asset-purchase-failed');
				}
				localStorage.removeItem(`bazar-purchase:${asset.id}`);
				setPhase('done');
				return;
			}
			let prepared: PreparedTransaction;
			if (transaction) {
				prepared = transaction;
			} else if (operation.resumeId) {
				prepared = client.restore(operation.resumeId, owner);
			} else if (operation.kind === 'sell') {
				const winston = arToWinston(value);
				prepared = await client.makeOffer({ processId: asset.id, asking: winston, seller: owner });
			} else if (operation.kind === 'cancel') {
				prepared = await client.cancelOrder(asset.id, operation.order.orderId, owner);
			} else if (operation.kind === 'transfer') {
				prepared = await client.transfer(asset.id, value, owner);
			} else throw new Error('invalid-operation');
			setTransaction(prepared);
			localStorage.setItem(`bazar-operation:${asset.id}`, JSON.stringify({
				txId: prepared.id,
				kind: operation.kind,
				assetId: asset.id,
				signer: owner,
				...(operation.kind === 'cancel' ? { order: operation.order } : { value }),
				createdAt: Date.now(),
			}));
			await dispatchAndConfirm(prepared, {
				target: 5,
				onViews: setViews,
			});
			setMessage('Five confirmations reached. Waiting for the scheduler safety depth and live asset state…');
			if (operation.kind === 'sell') {
				await client.waitForOfferAcceptance(asset.id, {
					orderId: prepared.id,
					seller: owner,
					asking: arToWinston(value),
					minimumFee: DEFAULT_REGISTRATION_FEE.toString(),
				});
			} else if (operation.kind === 'cancel') {
				await client.waitForOrderCancelled(asset.id, operation.order.orderId);
			} else if (operation.kind === 'transfer') {
				await client.waitForAssetOwnership(asset.id, value);
			}
			localStorage.removeItem(`bazar-operation:${asset.id}`);
			setPhase('done');
		} catch (cause) {
			setMessage(errorMessage(cause));
			setPhase('error');
		}
	}

	const purchaseSteps: ArweaveSyncStep[] = purchaseState
		? [
				{
					key: 'register',
					label: 'Reserve asset',
					target: 5,
					transaction: purchaseState.registration,
				},
				{
					key: 'pay',
					label: 'Pay seller',
					target: 5,
					transaction: purchaseState.payment,
				},
		  ]
		: [];
	const steps: ArweaveSyncStep[] = transaction
		? [{
				key: operation.kind,
				label: operationLabel(operation.kind),
				target: 5,
				transaction: { id: transaction.id, views },
		  }]
		: purchaseSteps;
	const activeStep = purchaseState?.stage.includes('payment') || purchaseState?.stage === 'ownership-verifying'
		? 'pay'
		: operation.kind === 'buy'
			? 'register'
			: operation.kind;
	const visiblePhase =
		operation.kind === 'buy' && phase === 'done' && purchaseState?.stage !== 'complete'
			? 'error'
			: phase;
	const visibleMessage =
		message ||
		(purchaseState?.error
			? errorMessage(new Error(purchaseState.error.message || purchaseState.error.code))
			: '');
	const workingStatus = message || purchaseStatusMessage(purchaseState);
	return (
		<div className="dialog-backdrop" role="presentation">
			<div className="dialog" role="dialog" aria-modal="true">
				<div className="dialog-heading">
					<div><p className="eyebrow">{operationLabel(operation.kind)}</p><h2>{asset.name}</h2></div>
					{visiblePhase !== 'working' ? <button className="close" onClick={onClose}>×</button> : null}
				</div>
				{visiblePhase === 'form' ? (
					<>
						{operation.kind === 'sell' ? (
							<label>Sale price in AR<input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="0.25" /></label>
						) : null}
						{operation.kind === 'transfer' ? (
							<label>Recipient wallet address<input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="43-character Arweave address" /></label>
						) : null}
						{operation.kind === 'cancel' ? <p>This removes the open order. The asset remains in your wallet.</p> : null}
						<button className="primary wide" onClick={() => void submit()}>Sign {operationLabel(operation.kind).toLowerCase()}</button>
					</>
				) : null}
				{visiblePhase === 'working' && steps.length ? (
					<>
						<p className="sync-intro">
							{(operation.kind === 'buy' && operation.resume) ||
							(operation.kind !== 'buy' && operation.resumeId)
								? 'Recovered the exact signed transactions. Resuming from the weave—nothing will be signed twice.'
								: 'Signed. Now watching independent Arweave nodes agree on the transaction.'}
						</p>
						{workingStatus ? <p className="scheduler-wait">{workingStatus}</p> : null}
						<ArweaveTransactionSync subject={asset.name} steps={steps} activeStep={activeStep} />
					</>
				) : null}
				{visiblePhase === 'done' ? <div className="result success"><h3>Applied to live asset state</h3><p>Arweave nodes now compute this action as part of the asset.</p><button className="primary" onClick={onClose}>Return to asset</button></div> : null}
				{visiblePhase === 'error' ? (
					<div className="result error">
						<h3>Could not complete this action</h3>
						<p>{visibleMessage}</p>
						{operation.kind === 'buy' ? (
							<button
								onClick={() => {
									if (purchaseState) {
										localStorage.setItem(
											`bazar-purchase:${asset.id}`,
											JSON.stringify({
												asset: { id: asset.id, name: asset.name },
												buyer: owner,
												order: operation.order,
												snapshot: purchaseSnapshot(purchaseState),
											})
										);
									}
									window.location.reload();
								}}
							>
								Reload and resume safely
							</button>
						) : /^transaction dispatch 4\d\d/.test(message) && transaction ? (
							<button
								onClick={() => {
									localStorage.removeItem(`bazar-operation:${asset.id}`);
									localStorage.removeItem(`bazar-signed-transaction:${transaction.id}`);
									onClose();
								}}
							>
								Discard rejected signature and sign again
							</button>
						) : transaction ? (
							<button onClick={() => void submit()}>Resume the signed transaction</button>
						) : (
							<button onClick={() => setPhase('form')}>Try again</button>
						)}
					</div>
				) : null}
			</div>
		</div>
	);
}

function AssetMosaic({ assets }: { assets: AssetSummary[] }) {
	return <>{assets.slice(0, 4).map((asset) => asset.image ? <img key={asset.id} src={asset.image} alt="" /> : null)}</>;
}
function Loading({ label }: { label: string }) { return <div className="loading"><span />{label}</div>; }
function ErrorPanel({ message }: { message: string }) { return <div className="error-panel"><strong>Unable to load</strong><span>{message}</span></div>; }
function liveOrder(state: AssetState) { return Object.values(state.orders).find((order) => order.status === 'open' || order.status === 'reserved') ?? null; }
function short(value: string) { return `${value.slice(0, 6)}…${value.slice(-5)}`; }
function winstonToAr(value: string) { return (Number(value) / 1e12).toLocaleString(undefined, { maximumFractionDigits: 12 }); }
function arToWinston(value: string) {
	if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(value) || Number(value) <= 0) throw new Error('Enter a positive AR amount.');
	const [whole, decimals = ''] = value.split('.');
	return (BigInt(whole) * 1_000_000_000_000n + BigInt(decimals.padEnd(12, '0'))).toString();
}
function operationLabel(kind: Operation['kind']) { return ({ sell: 'List for sale', buy: 'Buy asset', cancel: 'Cancel listing', transfer: 'Transfer asset' })[kind]; }
function purchaseSnapshot(state: PurchaseState): PurchaseSnapshot {
	return {
		...(state.registration
			? { registration: { id: state.registration.id, dispatched: state.registration.dispatched } }
			: {}),
		...(state.payment
			? { payment: { id: state.payment.id, dispatched: state.payment.dispatched } }
			: {}),
		...(state.dismissed ? { dismissed: true } : {}),
	};
}
function purchaseStatusMessage(state: PurchaseState | null) {
	if (!state) return '';
	if (
		state.stage === 'dispatching-registration' ||
		state.stage === 'registration-propagating' ||
		state.stage === 'registration-confirming'
	) {
		return 'The payment is signed but held locally. It will only be released after the reservation reaches five confirmations and appears in live process state.';
	}
	if (state.stage === 'registration-accepting') {
		return 'Registration has five confirmations. Waiting for ~arweave-scheduler@1.0 to reserve the order in live process state before releasing payment.';
	}
	if (state.stage === 'signing-payment' || state.stage === 'dispatching-payment') {
		return 'The reservation is live. Preparing the exact payment to the seller.';
	}
	if (state.stage === 'payment-propagating' || state.stage === 'payment-confirming') {
		return 'The reservation is live and the payment has been posted. Independent nodes are confirming settlement.';
	}
	if (state.stage === 'ownership-verifying') {
		return 'Payment is confirmed. Waiting for ~arweave-scheduler@1.0 to settle the order and transfer ownership in live process state.';
	}
	return '';
}
function errorMessage(error: unknown) {
	const value = error instanceof Error ? error.message : String(error);
	const friendly: Record<string, string> = {
		'asset-purchase-insufficient-funds-after-signing':
			'This wallet does not have enough AR for the transaction and network fee. Add AR, then resume the same signed transaction.',
		'transaction-propagation-timeout':
			'Arweave nodes did not reach propagation consensus in time. The signed transaction is saved and safe to resume.',
		'asset-state-timeout':
			'The transaction is confirmed, but the selected compute gateway has not applied it yet. Resume to keep checking live state.',
		'wallet-account-changed':
			'The connected wallet changed after signing. Reconnect the original signer to resume safely.',
		'registration not found':
			'Arweave nodes accepted the reservation, but it was not mined during this observation window. Reload to resume the exact signed transaction without signing again.',
		'payment not found':
			'Arweave nodes accepted the payment, but it was not mined during this observation window. Reload to resume the exact signed payment without paying again.',
	};
	return friendly[value] ?? value.replaceAll('-', ' ');
}
