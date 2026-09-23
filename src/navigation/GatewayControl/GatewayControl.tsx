import React from 'react';
import { Check, Info, Plus, RefreshCw, X } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { PortalIcon } from 'components/atoms/PortalIcon';
import { TextInput } from 'components/atoms/TextInput';
import { Tooltip } from 'components/atoms/Tooltip';
import { formatMessage } from 'helpers/i18n';
import { useAoPeerSettings } from 'hooks/useAoPeerSettings';
import { useMessages } from 'providers/LanguageProvider';
import { useMarketProvider } from 'providers/MarketProvider';

import { GATEWAY_CONTROL_MESSAGES } from './messages';

export default function GatewayControl() {
	const language = useMessages(GATEWAY_CONTROL_MESSAGES);
	const { pageRefreshing } = useMarketProvider();
	const settings = useAoPeerSettings();
	const [open, setOpen] = React.useState(false);
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
	function handleApply(event: React.FormEvent) {
		event.preventDefault();
		settings.apply();
	}
	function handleAddPeer() {
		const nextIndex = settings.peers.length;
		settings.addPeer();
		window.requestAnimationFrame(() => inputRefs.current[nextIndex]?.focus());
	}
	function handleRemovePeer(index: number) {
		settings.removePeer(index);
		window.requestAnimationFrame(() => inputRefs.current[Math.max(0, index - 1)]?.focus());
	}
	return (
		<div className="gateway-control">
			{pageRefreshing ? (
				<Tooltip content={language.gatewayRefreshing}>
					{(tooltipId) => (
						<span
							aria-describedby={tooltipId}
							aria-label={language.gatewayRefreshing}
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
					aria-label={formatMessage(language.gatewayPeersSummary, {
						peers: settings.activePeers.join(', '),
					})}
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
						content={language.gatewayPeersTooltip}
						delayMs={1000}
						disabled={open}
					>
						{(tooltipId) => (
							<span aria-describedby={tooltipId} className="gateway-summary-content">
								<PortalIcon className="ui-icon gateway-portal-icon" aria-hidden="true" />
								<span className="gateway-label">{language.gatewayLabel}</span>
							</span>
						)}
					</Tooltip>
				</summary>
				<div id="gateway-panel">
					<form onSubmit={handleApply}>
						{settings.permawebOsAvailable ? (
							<Button
								aria-checked={settings.usesPermawebOs}
								className="gateway-permaweb-os-toggle"
								onClick={settings.togglePermawebOs}
								role="switch"
								size="custom"
								type="button"
								variant="ghost"
							>
								<span>
									<strong>{language.gatewayPermawebOsTitle}</strong>
									<small>{language.gatewayPermawebOsDetail}</small>
								</span>
								<span className="gateway-permaweb-os-toggle-control" aria-hidden="true">
									{settings.usesPermawebOs ? <Icon icon={Check} size="sm" /> : null}
								</span>
							</Button>
						) : null}
						<fieldset className="gateway-peer-editor">
							<legend>{language.gatewayPeersLegend}</legend>
							<p className="gateway-peer-description">{language.gatewayPeersDescription}</p>
							<div className="gateway-peer-fields">
								{settings.peers.map((value, index) => (
									<div className="gateway-peer-row" key={index}>
										<label className="sr-only" htmlFor={`gateway-peer-${index}`}>
											{formatMessage(language.gatewayPeerLabel, { position: index + 1 })}
										</label>
										<TextInput
											aria-describedby={settings.peersInvalid ? 'gateway-error' : undefined}
											aria-invalid={settings.peersInvalid}
											autoComplete="url"
											id={`gateway-peer-${index}`}
											inputMode="url"
											onChange={(event) => settings.updatePeer(index, event.target.value)}
											placeholder={language.gatewayPeerPlaceholder}
											ref={(node) => {
												inputRefs.current[index] = node;
											}}
											spellCheck={false}
											value={value}
										/>
										{settings.peers.length > 1 ? (
											<Button
												aria-label={formatMessage(language.gatewayPeerRemove, {
													position: index + 1,
												})}
												className="gateway-peer-remove"
												onClick={() => handleRemovePeer(index)}
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
								onClick={handleAddPeer}
								size="custom"
								type="button"
								variant="ghost"
							>
								<Icon icon={Plus} size="sm" /> {language.gatewayPeerAdd}
							</Button>
						</fieldset>
						{settings.peersInvalid ? (
							<p className="gateway-error" id="gateway-error" role="alert">
								{language.gatewayPeersInvalid}
							</p>
						) : null}
						<div className="gateway-apply-row">
							<Button className="gateway-apply-button with-icon" type="submit" size="custom">
								<PortalIcon className="ui-icon gateway-portal-icon" aria-hidden="true" />{' '}
								{language.gatewayApply}
							</Button>
							<Tooltip className="gateway-peer-help" content={language.gatewayHelp}>
								{(tooltipId) => (
									<Button
										aria-describedby={tooltipId}
										aria-label={language.gatewayHelpLabel}
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
