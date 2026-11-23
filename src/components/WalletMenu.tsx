import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Download, LogOut, Monitor, Moon, Sun, SunDim, Trash2, UserRound, Wallet } from 'lucide-react';

import { useTheme } from 'providers/ThemeProvider';
import {
	useWallet,
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

export function WalletMenu() {
	const navigate = useNavigate();
	const theme = useTheme();
	const wallet = useWallet();
	const appearanceLabelId = React.useId();
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

	React.useEffect(() => {
		if (!open) return;
		const closeFromOutside = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false);
		};
		const closeFromKeyboard = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			setOpen(false);
			window.requestAnimationFrame(() => trigger.current?.focus());
		};
		document.addEventListener('pointerdown', closeFromOutside);
		document.addEventListener('keydown', closeFromKeyboard);
		return () => {
			document.removeEventListener('pointerdown', closeFromOutside);
			document.removeEventListener('keydown', closeFromKeyboard);
		};
	}, [open]);

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
			<Tooltip content={wallet.address || (restoring ? RESTORING_LABEL : 'Connect wallet')} disabled={open}>
				{(tooltipId) => (
					<Button
						aria-busy={restoring || undefined}
						aria-describedby={tooltipId}
						aria-disabled={restoring || undefined}
						aria-expanded={wallet.address ? open : undefined}
						aria-haspopup={wallet.address ? 'menu' : undefined}
						aria-label={
							wallet.address ? `Wallet ${wallet.address}` : restoring ? RESTORING_LABEL : 'Connect wallet'
						}
						className="wallet"
						onClick={(event) => {
							setNotice('');
							// Restoring is bounded by WALLET_RESTORE_GRACE_MS; until then the session is unknown.
							if (restoring) return;
							if (!wallet.address) {
								wallet.openConnectDialog(event.currentTarget);
								return;
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
				<div aria-label="Wallet options" className="wallet-dropdown" role="menu">
					<div className="wallet-dropdown-header">
						<Wallet className="ui-icon" aria-hidden="true" />
						<div>
							<span>{dangerAction.heading}</span>
							<strong>{walletLabel}</strong>
						</div>
					</div>
					<div aria-label="Balances" className="wallet-dropdown-balances" role="group">
						<div className="wallet-dropdown-balance">
							<span>AR balance</span>
							<strong aria-live="polite">
								<ArCurrencyText>
									{tokenBalanceLabel(
										wallet.arBalance,
										wallet.arBalanceStatus,
										'AR',
										wallet.arBalanceDenomination
									)}
								</ArCurrencyText>
							</strong>
						</div>
						{wallet.aoBalanceStatus !== 'idle' ? (
							<div className="wallet-dropdown-balance">
								<span>AO balance</span>
								<strong aria-live="polite">
									{tokenBalanceLabel(
										wallet.aoBalance,
										wallet.aoBalanceStatus,
										'AO',
										wallet.aoBalanceDenomination
									)}
								</strong>
							</div>
						) : null}
					</div>
					<div className="wallet-dropdown-actions">
						<Button
							onClick={() => {
								setOpen(false);
								navigate(`/profile/${wallet.address}`);
							}}
							role="menuitem"
							size="custom"
							variant="ghost"
						>
							<UserRound className="ui-icon ui-icon--sm" aria-hidden="true" />
							My profile
						</Button>
						<Button onClick={() => void copyAddress()} role="menuitem" size="custom" variant="ghost">
							<Copy className="ui-icon ui-icon--sm" aria-hidden="true" />
							{copied ? 'Copied' : 'Copy address'}
						</Button>
						{dangerAction.showsExport ? (
							<Button onClick={downloadKeyfile} role="menuitem" size="custom" variant="ghost">
								<Download className="ui-icon ui-icon--sm" aria-hidden="true" />
								Download keyfile
							</Button>
						) : null}
					</div>
					<div aria-labelledby={appearanceLabelId} className="wallet-dropdown-appearance" role="group">
						<span className="wallet-dropdown-section-label" id={appearanceLabelId}>
							Appearance
						</span>
						{THEME_OPTIONS.map(({ id, label, Icon }) => {
							const active = theme.preference === id;
							return (
								<Button
									aria-checked={active}
									className={active ? 'is-active' : undefined}
									key={id}
									onClick={() => theme.setPreference(id)}
									role="menuitemradio"
									size="custom"
									variant="ghost"
								>
									<Icon className="ui-icon ui-icon--sm" aria-hidden="true" />
									{label}
									{active ? <Check className="theme-option-check" aria-hidden="true" /> : null}
								</Button>
							);
						})}
					</div>
					<div className="wallet-dropdown-footer">
						<Button
							disabled={disconnecting}
							onClick={() => void disconnect()}
							role="menuitem"
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
					{error ? <p role="alert">{error}</p> : null}
				</div>
			) : null}
			<div className="wallet-menu-status" role="status">
				{notice && !open ? <p className="wallet-dropdown wallet-menu-notice">{notice}</p> : null}
			</div>
		</div>
	);
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
	return `${whole.toLocaleString()}.${fraction} ${symbol}`;
}
