import React from 'react';
import { Check, Info, Plus, RefreshCw, X } from 'lucide-react';

import { normalizeServingNodeOrigins } from 'api/marketplace';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { PortalIcon } from 'components/atoms/PortalIcon';
import { TextInput } from 'components/atoms/TextInput';
import { Tooltip } from 'components/atoms/Tooltip';
import {
	AO_TRANSPORT_QUERY_PARAMETER,
	BAZAR_AO_TRANSPORT,
	fallbackAoPeersFromLocation,
	gatewaysFromLocation,
	permawebOsAoAvailable,
	usesPermawebOsAo,
} from 'helpers/config';
import { useMarketProvider } from 'providers/MarketProvider';

export default function GatewayControl() {
	const { pageRefreshing } = useMarketProvider();
	const permawebOsConnected = permawebOsAoAvailable();
	const fallbackPeers = fallbackAoPeersFromLocation(window.location);
	const [computeValues, setComputeValues] = React.useState(() => (fallbackPeers.length ? fallbackPeers : ['']));
	const [usePermawebOs, setUsePermawebOs] = React.useState(() => usesPermawebOsAo(window.location));
	const [open, setOpen] = React.useState(false);
	const [error, setError] = React.useState('');
	const detailsRef = React.useRef<HTMLDetailsElement>(null);
	const triggerRef = React.useRef<HTMLElement>(null);
	const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
	React.useEffect(() => {
		if (!open) return;
		const focusFrame = window.requestAnimationFrame(() => inputRefs.current[0]?.focus());
		const closeOutside = (event: PointerEvent) => {
			if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) setOpen(false);
		};
		const closeWithEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			setOpen(false);
			window.requestAnimationFrame(() => triggerRef.current?.focus());
		};
		document.addEventListener('pointerdown', closeOutside, true);
		document.addEventListener('keydown', closeWithEscape, true);
		return () => {
			window.cancelAnimationFrame(focusFrame);
			document.removeEventListener('pointerdown', closeOutside, true);
			document.removeEventListener('keydown', closeWithEscape, true);
		};
	}, [open]);
	function apply(event: React.FormEvent) {
		event.preventDefault();
		const parsedPeers = computeValues.map((value) => normalizeServingNodeOrigins(value, window.location.protocol));
		const computeOrigins =
			parsedPeers.every((origins) => origins?.length === 1) && parsedPeers.length
				? [...new Set(parsedPeers.flatMap((origins) => origins ?? []))]
				: null;
		if (!computeOrigins) {
			setError('Enter one valid HTTP or HTTPS AO-Core peer in each field.');
			return;
		}
		setError('');
		const url = new URL(window.location.href);
		url.searchParams.set('node', computeOrigins.join(','));
		if (permawebOsConnected && usePermawebOs) {
			url.searchParams.delete(AO_TRANSPORT_QUERY_PARAMETER);
		} else {
			url.searchParams.set(AO_TRANSPORT_QUERY_PARAMETER, BAZAR_AO_TRANSPORT);
		}
		window.location.assign(url);
	}
	const activePeers = usePermawebOs && permawebOsConnected ? gatewaysFromLocation(window.location) : fallbackPeers;
	return (
		<div className="gateway-control">
			{pageRefreshing ? (
				<Tooltip content="Some assets on this page are still being refreshed on your configured AO peers.">
					{(tooltipId) => (
						<span
							aria-describedby={tooltipId}
							aria-label="Some assets on this page are still being refreshed on your configured AO peers."
							className="gateway-refreshing"
							role="status"
							tabIndex={0}
						>
							<Icon icon={RefreshCw} size="sm" />
						</span>
					)}
				</Tooltip>
			) : null}
			<details className="gateway" open={open} ref={detailsRef}>
				<summary
					aria-controls="gateway-panel"
					aria-expanded={open}
					aria-label={`AO-Core peers, ${activePeers.join(', ')}`}
					onClick={(event) => {
						event.preventDefault();
						setOpen((currentOpen) => !currentOpen);
					}}
					ref={triggerRef}
					role="button"
				>
					<Tooltip
						align="center"
						className="gateway-trigger-tooltip"
						content="AO-Core peers"
						delayMs={1000}
						disabled={open}
					>
						{(tooltipId) => (
							<span aria-describedby={tooltipId} className="gateway-summary-content">
								<PortalIcon className="ui-icon gateway-portal-icon" aria-hidden="true" />
								<span className="gateway-label">AO Core</span>
							</span>
						)}
					</Tooltip>
				</summary>
				<div id="gateway-panel">
					<form onSubmit={apply}>
						{permawebOsConnected ? (
							<Button
								aria-checked={usePermawebOs}
								className="gateway-permaweb-os-toggle"
								onClick={() => setUsePermawebOs((current) => !current)}
								role="switch"
								size="custom"
								type="button"
								variant="ghost"
							>
								<span>
									<strong>Use PermawebOS Routing</strong>
									<small>Use its role-aware routes and shared request state.</small>
								</span>
								<span className="gateway-permaweb-os-toggle-control" aria-hidden="true">
									{usePermawebOs ? <Icon icon={Check} size="sm" /> : null}
								</span>
							</Button>
						) : null}
						<fieldset className="gateway-peer-editor">
							<legend>AO-Core peers</legend>
							<p className="gateway-peer-description">
								Used by Bazar when PermawebOS is unavailable or disabled above.
							</p>
							<div className="gateway-peer-fields">
								{computeValues.map((value, index) => (
									<div className="gateway-peer-row" key={index}>
										<label className="sr-only" htmlFor={`gateway-peer-${index}`}>
											Fallback AO-Core peer {index + 1}
										</label>
										<TextInput
											aria-describedby={error ? 'gateway-error' : undefined}
											aria-invalid={Boolean(error)}
											autoComplete="url"
											id={`gateway-peer-${index}`}
											inputMode="url"
											onChange={(event) => {
												setComputeValues((current) =>
													current.map((peer, peerIndex) =>
														peerIndex === index ? event.target.value : peer
													)
												);
												setError('');
											}}
											placeholder="https://peer.example"
											ref={(node) => {
												inputRefs.current[index] = node;
											}}
											spellCheck={false}
											value={value}
										/>
										{computeValues.length > 1 ? (
											<Button
												aria-label={`Remove fallback AO-Core peer ${index + 1}`}
												className="gateway-peer-remove"
												onClick={() => {
													setComputeValues((current) =>
														current.filter((_, peerIndex) => peerIndex !== index)
													);
													setError('');
													window.requestAnimationFrame(() =>
														inputRefs.current[Math.max(0, index - 1)]?.focus()
													);
												}}
												size="custom"
												type="button"
												variant="ghost"
											>
												<Icon icon={X} size="sm" />
											</Button>
										) : null}
									</div>
								))}
							</div>
							<Button
								className="gateway-peer-add with-icon"
								onClick={() => {
									const nextIndex = computeValues.length;
									setComputeValues((current) => [...current, '']);
									setError('');
									window.requestAnimationFrame(() => inputRefs.current[nextIndex]?.focus());
								}}
								size="custom"
								type="button"
								variant="ghost"
							>
								<Icon icon={Plus} size="sm" /> Add peer
							</Button>
						</fieldset>
						{error ? (
							<p className="gateway-error" id="gateway-error" role="alert">
								{error}
							</p>
						) : null}
						<div className="gateway-apply-row">
							<Button className="gateway-apply-button with-icon" type="submit" size="custom">
								<PortalIcon className="ui-icon gateway-portal-icon" aria-hidden="true" /> Apply settings
							</Button>
							<Tooltip
								className="gateway-peer-help"
								content="The PermawebOS transport is selected by default when available. Turning it off keeps AO requests inside Bazar and uses the ordered fallback peers above."
							>
								{(tooltipId) => (
									<Button
										aria-describedby={tooltipId}
										aria-label="About AO transport settings"
										className="gateway-peer-help-trigger"
										size="custom"
										type="button"
										variant="ghost"
									>
										<Icon icon={Info} size="sm" />
									</Button>
								)}
							</Tooltip>
						</div>
					</form>
				</div>
			</details>
		</div>
	);
}
