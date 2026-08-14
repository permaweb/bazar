import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, LogOut, Monitor, Moon, Sun, SunDim, UserRound, Wallet } from 'lucide-react';

import { useTheme } from 'providers/ThemeProvider';
import { useWallet } from 'providers/WalletProvider';

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
	const profile = useAccountProfileSummary(wallet.address ?? '');
	const walletLabel = walletMenuLabel(wallet.address, profile.displayName);

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
			await wallet.disconnect();
			setOpen(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Wallet could not be disconnected.');
		} finally {
			setDisconnecting(false);
		}
	};

	return (
		<div className="wallet-menu" ref={root}>
			<Tooltip content={wallet.address || 'Connect wallet'} disabled={open}>
				{(tooltipId) => (
					<Button
						aria-describedby={tooltipId}
						aria-expanded={wallet.address ? open : undefined}
						aria-haspopup={wallet.address ? 'menu' : undefined}
						aria-label={wallet.address ? `Wallet ${wallet.address}` : 'Connect wallet'}
						className="wallet"
						onClick={(event) => {
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
							<span>Connected wallet</span>
							<strong>{walletLabel}</strong>
						</div>
					</div>
					<div aria-label="Balance" className="wallet-dropdown-balance" role="group">
						<span>Balance</span>
						<strong aria-live="polite">
							<ArCurrencyText>{arBalanceLabel(wallet.arBalance, wallet.arBalanceStatus)}</ArCurrencyText>
						</strong>
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
							<LogOut className="ui-icon ui-icon--sm" aria-hidden="true" />
							{disconnecting ? 'Disconnecting…' : 'Disconnect'}
						</Button>
					</div>
					{error ? <p role="alert">{error}</p> : null}
				</div>
			) : null}
		</div>
	);
}

function shortAddress(address: string) {
	return `${address.slice(0, 6)}…${address.slice(-5)}`;
}

export function walletMenuLabel(address?: string | null, displayName?: string | null) {
	return displayName?.trim() || (address ? shortAddress(address) : 'Connect');
}

export function arBalanceLabel(balance: bigint | null, status: 'idle' | 'loading' | 'ready' | 'error'): string {
	if (status === 'error') return 'Unavailable';
	if (status !== 'ready' || balance === null) return 'Loading…';
	const fixedBalance = (balance + 50_000_000n) / 100_000_000n;
	const whole = fixedBalance / 10_000n;
	const fraction = (fixedBalance % 10_000n).toString().padStart(4, '0');
	return `${whole.toLocaleString()}.${fraction} AR`;
}
