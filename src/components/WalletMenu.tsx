import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Download, LogOut, Monitor, Moon, Sun, SunDim, Trash2, UserRound, Wallet } from 'lucide-react';

import type { ThemePreference } from 'helpers/theme';
import { groupDecimalAmount } from 'helpers/token-display';
import { useTheme } from 'providers/ThemeProvider';
import {
	useWallet,
	type WalletBalanceStatus,
	WALLET_DISCONNECT_UNCONFIRMED_MESSAGE,
	type WalletConnectionStatus,
	walletDisconnectPlan,
	type WalletKind,
} from 'providers/WalletProvider';

import { ArCurrencyText } from './ArCurrencyLabel';
import { Button } from './Button';
import { useAccountProfileSummary } from './ProfileIdentity';
import { Tooltip } from './Tooltip';

const THEME_OPTIONS = [
	{ id: 'system', label: 'System', Icon: Monitor },
	{ id: 'light', label: 'Light', Icon: Sun },
	{ id: 'dimmed', label: 'Dimmed', Icon: SunDim },
	{ id: 'dark', label: 'Dark', Icon: Moon },
] as const;

/**
 * The header wallet control is a disclosure (the same pattern as the Transaction activity popover):
 * a button with aria-expanded/aria-controls that reveals a labelled section of ordinary buttons.
 * It deliberately carries no ARIA menu roles, because it has no menu keyboard model (arrow keys,
 * roving focus); Tab moves through the panel and Escape closes it and returns focus to the trigger.
 */
export function WalletMenu() {
	const navigate = useNavigate();
	const theme = useTheme();
	const wallet = useWallet();
	const panelId = React.useId();
	const root = React.useRef<HTMLDivElement>(null);
	const trigger = React.useRef<HTMLButtonElement>(null);
	const [open, setOpen] = React.useState(false);
	const [copied, setCopied] = React.useState(false);
	const [disconnecting, setDisconnecting] = React.useState(false);
	const [error, setError] = React.useState('');
	const [notice, setNotice] = React.useState('');
	const profile = useAccountProfileSummary(wallet.address ?? '');
	const walletLabel = walletMenuLabel(wallet.address, profile.displayName, wallet.connectionStatus);
	const restoring = wallet.connectionStatus === 'restoring';
	const dangerAction = walletMenuDangerAction(wallet.walletKind);
	const returnFocusToTrigger = React.useCallback(() => {
		window.requestAnimationFrame(() => trigger.current?.focus());
	}, []);

	React.useEffect(() => {
		if (!open) return;
		const closeFromOutside = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false);
		};
		const closeFromKeyboard = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			setOpen(false);
			returnFocusToTrigger();
		};
		document.addEventListener('pointerdown', closeFromOutside);
		document.addEventListener('keydown', closeFromKeyboard);
		return () => {
			document.removeEventListener('pointerdown', closeFromOutside);
			document.removeEventListener('keydown', closeFromKeyboard);
		};
	}, [open, returnFocusToTrigger]);

	React.useEffect(() => {
		if (!wallet.address) setOpen(false);
	}, [wallet.address]);

	React.useEffect(() => {
		if (!notice) return;
		const timer = window.setTimeout(() => setNotice(''), WALLET_MENU_NOTICE_MS);
		return () => window.clearTimeout(timer);
	}, [notice]);

	const copyAddress = async () => {
		if (!wallet.address) return;
		setError('');
		try {
			await navigator.clipboard.writeText(wallet.address);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1800);
		} catch {
			setError('Address could not be copied.');
		}
	};
	const disconnect = async () => {
		setDisconnecting(true);
		setError('');
		try {
			const result = await wallet.disconnect();
			if (result === 'kept') return;
			setOpen(false);
			// The panel (and the focused Disconnect button) unmounts; keep the keyboard user's place on
			// the trigger, which stays mounted as "Connect wallet".
			returnFocusToTrigger();
			if (result === 'unconfirmed') setNotice(WALLET_DISCONNECT_UNCONFIRMED_MESSAGE);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Wallet could not be disconnected.');
		} finally {
			setDisconnecting(false);
		}
	};
	const downloadKeyfile = () => {
		setError('');
		try {
			if (!wallet.exportLocalWallet()) setError('No keyfile is stored in this browser.');
		} catch {
			setError('Keyfile could not be downloaded.');
		}
	};

	return (
		<div className="wallet-menu" ref={root}>
			{/* The accessible name already holds the tooltip text (the full address), so it is not also
			    wired up as a description. */}
			<Tooltip content={wallet.address || (restoring ? RESTORING_LABEL : 'Connect wallet')} disabled={open}>
				{() => (
					<Button
						{...walletTriggerAria({
							address: wallet.address,
							connectionStatus: wallet.connectionStatus,
							displayName: profile.displayName,
							open,
							panelId,
						})}
						aria-busy={restoring || undefined}
						aria-disabled={restoring || undefined}
						className="wallet"
						onClick={(event) => {
							setNotice('');
							// Restoring is bounded by WALLET_RESTORE_GRACE_MS; until then the session is unknown.
							if (restoring) return;
							if (!wallet.address) {
								wallet.openConnectDialog(event.currentTarget);
								return;
							}
							if (!open && walletBalancesNeedRetry(wallet.arBalanceStatus, wallet.aoBalanceStatus)) {
								wallet.refreshBalances();
							}
							setOpen((current) => !current);
							setError('');
						}}
						ref={trigger}
						size="custom"
						variant="primary"
					>
						<Wallet className="ui-icon ui-icon--sm" aria-hidden="true" />
						<span>{walletLabel}</span>
					</Button>
				)}
			</Tooltip>
			{open && wallet.address ? (
				<WalletMenuPanel
					aoBalance={
						wallet.aoBalanceStatus !== 'idle'
							? tokenBalanceLabel(
									wallet.aoBalance,
									wallet.aoBalanceStatus,
									'AO',
									wallet.aoBalanceDenomination
							  )
							: null
					}
					arBalance={tokenBalanceLabel(
						wallet.arBalance,
						wallet.arBalanceStatus,
						'AR',
						wallet.arBalanceDenomination
					)}
					copied={copied}
					dangerAction={dangerAction}
					disconnecting={disconnecting}
					error={error}
					id={panelId}
					label={walletLabel}
					onCopyAddress={() => void copyAddress()}
					onDisconnect={() => void disconnect()}
					onDownloadKeyfile={downloadKeyfile}
					onOpenProfile={() => {
						// Route changes move focus to the page (RouteFocus), so no trigger focus here.
						setOpen(false);
						navigate(`/profile/${wallet.address}`);
					}}
					onSelectTheme={theme.setPreference}
					themePreference={theme.preference}
				/>
			) : null}
			<div className="wallet-menu-status" role="status">
				{notice && !open ? <p className="wallet-dropdown wallet-menu-notice">{notice}</p> : null}
			</div>
		</div>
	);
}

export type WalletMenuPanelProps = {
	aoBalance: string | null;
	arBalance: string;
	copied: boolean;
	dangerAction: ReturnType<typeof walletMenuDangerAction>;
	disconnecting: boolean;
	error: string;
	id: string;
	label: string;
	onCopyAddress: () => void;
	onDisconnect: () => void;
	onDownloadKeyfile: () => void;
	onOpenProfile: () => void;
	onSelectTheme: (preference: ThemePreference) => void;
	themePreference: ThemePreference;
};

/** The open wallet disclosure panel: a labelled section of plain buttons, with toggle-button themes. */
export function WalletMenuPanel({
	aoBalance,
	arBalance,
	copied,
	dangerAction,
	disconnecting,
	error,
	id,
	label,
	onCopyAddress,
	onDisconnect,
	onDownloadKeyfile,
	onOpenProfile,
	onSelectTheme,
	themePreference,
}: WalletMenuPanelProps) {
	const appearanceLabelId = React.useId();
	return (
		<section aria-label="Wallet options" className="wallet-dropdown" id={id}>
			<div className="wallet-dropdown-header">
				<Wallet className="ui-icon" aria-hidden="true" />
				<div>
					<span>{dangerAction.heading}</span>
					<strong>{label}</strong>
				</div>
			</div>
			<div aria-label="Balances" className="wallet-dropdown-balances" role="group">
				<div className="wallet-dropdown-balance">
					<span>AR balance</span>
					<strong aria-live="polite">
						<ArCurrencyText>{arBalance}</ArCurrencyText>
					</strong>
				</div>
				{aoBalance !== null ? (
					<div className="wallet-dropdown-balance">
						<span>AO balance</span>
						<strong aria-live="polite">{aoBalance}</strong>
					</div>
				) : null}
			</div>
			<div className="wallet-dropdown-actions">
				<Button className="wallet-dropdown-item" onClick={onOpenProfile} size="custom" variant="ghost">
					<UserRound className="ui-icon ui-icon--sm" aria-hidden="true" />
					My profile
				</Button>
				<Button className="wallet-dropdown-item" onClick={onCopyAddress} size="custom" variant="ghost">
					<Copy className="ui-icon ui-icon--sm" aria-hidden="true" />
					{copied ? 'Copied' : 'Copy address'}
				</Button>
				{dangerAction.showsExport ? (
					<Button className="wallet-dropdown-item" onClick={onDownloadKeyfile} size="custom" variant="ghost">
						<Download className="ui-icon ui-icon--sm" aria-hidden="true" />
						Download keyfile
					</Button>
				) : null}
			</div>
			<div aria-labelledby={appearanceLabelId} className="wallet-dropdown-appearance" role="group">
				<span className="wallet-dropdown-section-label" id={appearanceLabelId}>
					Appearance
				</span>
				{THEME_OPTIONS.map(({ id: optionId, label: optionLabel, Icon }) => {
					const active = themePreference === optionId;
					return (
						<Button
							aria-pressed={active}
							className={active ? 'wallet-dropdown-item is-active' : 'wallet-dropdown-item'}
							key={optionId}
							onClick={() => onSelectTheme(optionId)}
							size="custom"
							variant="ghost"
						>
							<Icon className="ui-icon ui-icon--sm" aria-hidden="true" />
							{optionLabel}
							{active ? <Check className="theme-option-check" aria-hidden="true" /> : null}
						</Button>
					);
				})}
			</div>
			<div className="wallet-dropdown-footer">
				<Button
					className="wallet-dropdown-item"
					disabled={disconnecting}
					onClick={onDisconnect}
					size="custom"
					variant="danger"
				>
					{dangerAction.showsExport ? (
						<Trash2 className="ui-icon ui-icon--sm" aria-hidden="true" />
					) : (
						<LogOut className="ui-icon ui-icon--sm" aria-hidden="true" />
					)}
					{disconnecting ? dangerAction.busyLabel : dangerAction.label}
				</Button>
			</div>
			<span aria-live="polite" className="sr-only" role="status">
				{copied ? 'Address copied.' : ''}
			</span>
			{error ? <p role="alert">{error}</p> : null}
		</section>
	);
}

/**
 * The trigger's accessible name starts with its visible text (WCAG 2.5.3, so "click Agent Smith"
 * works for voice control) and then carries the full address the tooltip shows.
 */
export function walletTriggerName(
	address?: string | null,
	displayName?: string | null,
	connectionStatus?: WalletConnectionStatus
) {
	if (address) return `${walletMenuLabel(address, displayName)}, wallet ${address}`;
	return connectionStatus === 'restoring'
		? `${walletMenuLabel(address, displayName, connectionStatus)}, ${RESTORING_LABEL.toLowerCase()}`
		: 'Connect wallet';
}

/** Disclosure ARIA for the trigger: aria-controls names the panel only while it is rendered. */
export function walletTriggerAria({
	address,
	connectionStatus,
	displayName,
	open,
	panelId,
}: {
	address?: string | null;
	connectionStatus?: WalletConnectionStatus;
	displayName?: string | null;
	open: boolean;
	panelId: string;
}) {
	if (!address) return { 'aria-label': walletTriggerName(address, displayName, connectionStatus) };
	return {
		'aria-controls': open ? panelId : undefined,
		'aria-expanded': open,
		'aria-label': walletTriggerName(address, displayName),
	};
}

const RESTORING_LABEL = 'Checking wallet connection…';
const WALLET_MENU_NOTICE_MS = 10_000;

function shortAddress(address: string) {
	return `${address.slice(0, 6)}…${address.slice(-5)}`;
}

export function walletMenuLabel(
	address?: string | null,
	displayName?: string | null,
	connectionStatus?: WalletConnectionStatus
) {
	if (!address && connectionStatus === 'restoring') return 'Wallet…';
	return displayName?.trim() || (address ? shortAddress(address) : 'Connect');
}

/**
 * The menu's wallet-kind copy and its danger action. Derived from walletDisconnectPlan so the label,
 * the confirmation and whether the key is erased cannot disagree.
 */
export function walletMenuDangerAction(kind: WalletKind | null) {
	const plan = walletDisconnectPlan(kind);
	return plan.clearsKey
		? {
				heading: 'Keyfile wallet, stored only in this browser',
				label: 'Remove keyfile…',
				busyLabel: 'Removing…',
				needsConfirm: plan.confirm,
				showsExport: true,
		  }
		: {
				heading: 'Connected wallet',
				label: 'Disconnect',
				busyLabel: 'Disconnecting…',
				needsConfirm: plan.confirm,
				showsExport: false,
		  };
}

/** Opening the menu retries a balance that last read as 'Unavailable'. */
export function walletBalancesNeedRetry(arStatus: WalletBalanceStatus, aoStatus: WalletBalanceStatus) {
	return arStatus === 'error' || aoStatus === 'error';
}

export function arBalanceLabel(balance: bigint | null, status: 'idle' | 'loading' | 'ready' | 'error'): string {
	return tokenBalanceLabel(balance, status, 'AR', 12);
}

export function tokenBalanceLabel(
	balance: bigint | null,
	status: 'idle' | 'loading' | 'ready' | 'error',
	symbol: string,
	denomination: number
): string {
	if (status === 'error') return 'Unavailable';
	if (status !== 'ready' || balance === null) return 'Loading…';
	const atomicScale = 10n ** BigInt(denomination);
	const fixedBalance = (balance * 10_000n + atomicScale / 2n) / atomicScale;
	const whole = fixedBalance / 10_000n;
	const fraction = (fixedBalance % 10_000n).toString().padStart(4, '0');
	return `${groupDecimalAmount(`${whole}.${fraction}`)} ${symbol}`;
}
