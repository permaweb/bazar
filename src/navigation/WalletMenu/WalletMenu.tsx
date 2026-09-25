import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, LogOut, Monitor, Moon, Sun, SunDim, UserRound, Wallet } from 'lucide-react';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';
import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { Tooltip } from 'components/atoms/Tooltip';
import { toAppError } from 'helpers/app-error';
import { formatMessage } from 'helpers/i18n';
import { useAccountProfileSummary } from 'hooks/useAccountProfileSummary';
import { useAppErrorMessage } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';
import { useTheme } from 'providers/ThemeProvider';
import { useWallet } from 'providers/WalletProvider';

import { WALLET_MENU_MESSAGES, type WalletMenuMessages } from './messages';
import * as S from './styles';

const THEME_OPTIONS = [
	{ id: 'system', labelKey: 'walletMenuThemeSystem', Icon: Monitor },
	{ id: 'light', labelKey: 'walletMenuThemeLight', Icon: Sun },
	{ id: 'dimmed', labelKey: 'walletMenuThemeDimmed', Icon: SunDim },
	{ id: 'dark', labelKey: 'walletMenuThemeDark', Icon: Moon },
] as const;

export default function WalletMenu() {
	const navigate = useNavigate();
	const language = useMessages(WALLET_MENU_MESSAGES);
	const errorMessage = useAppErrorMessage();
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
	const walletLabel = walletMenuLabel(wallet.address, profile.displayName, language.walletMenuConnectShort);

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
			setError(language.walletMenuCopyFailed);
		}
	};
	const disconnect = async () => {
		setDisconnecting(true);
		setError('');
		try {
			await wallet.disconnect();
			setOpen(false);
		} catch (cause) {
			setError(errorMessage(toAppError(cause, 'wallet-disconnect-failed')));
		} finally {
			setDisconnecting(false);
		}
	};

	return (
		<S.Menu className="wallet-menu" ref={root}>
			<Tooltip content={wallet.address || language.walletMenuConnect} disabled={open}>
				{(tooltipId) => (
					<S.WalletButton
						aria-describedby={tooltipId}
						aria-expanded={wallet.address ? open : undefined}
						aria-haspopup={wallet.address ? 'menu' : undefined}
						aria-label={
							wallet.address
								? formatMessage(language.walletMenuWallet, { address: wallet.address })
								: language.walletMenuConnect
						}
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
						<Icon icon={Wallet} size="sm" />
						<span>{walletLabel}</span>
					</S.WalletButton>
				)}
			</Tooltip>
			{open && wallet.address ? (
				<S.Dropdown aria-label={language.walletMenuOptions} className="wallet-dropdown" role="menu">
					<S.DropdownHeader className="wallet-dropdown-header">
						<Icon icon={Wallet} />
						<div>
							<span>{language.walletMenuConnected}</span>
							<strong>{walletLabel}</strong>
						</div>
					</S.DropdownHeader>
					<S.Balances
						aria-label={language.walletMenuBalances}
						className="wallet-dropdown-balances"
						role="group"
					>
						<S.Balance className="wallet-dropdown-balance">
							<span>{language.walletMenuArBalance}</span>
							<strong aria-live="polite">
								<ArCurrencyText>
									{tokenBalanceLabel(
										wallet.arBalance,
										wallet.arBalanceStatus,
										'AR',
										wallet.arBalanceDenomination,
										language
									)}
								</ArCurrencyText>
							</strong>
						</S.Balance>
						{wallet.aoBalanceStatus !== 'idle' ? (
							<S.Balance className="wallet-dropdown-balance">
								<span>{language.walletMenuAoBalance}</span>
								<strong aria-live="polite">
									{tokenBalanceLabel(
										wallet.aoBalance,
										wallet.aoBalanceStatus,
										'AO',
										wallet.aoBalanceDenomination,
										language
									)}
								</strong>
							</S.Balance>
						) : null}
					</S.Balances>
					<S.Actions className="wallet-dropdown-actions">
						<Button
							onClick={() => {
								setOpen(false);
								navigate(`/profile/${wallet.address}`);
							}}
							role="menuitem"
							size="custom"
							variant="ghost"
						>
							<Icon icon={UserRound} size="sm" />
							{language.walletMenuProfile}
						</Button>
						<Button onClick={() => void copyAddress()} role="menuitem" size="custom" variant="ghost">
							<Icon icon={Copy} size="sm" />
							{copied ? language.walletMenuCopied : language.walletMenuCopyAddress}
						</Button>
					</S.Actions>
					<S.Appearance
						aria-labelledby={appearanceLabelId}
						className="wallet-dropdown-appearance"
						role="group"
					>
						<S.SectionLabel className="wallet-dropdown-section-label" id={appearanceLabelId}>
							{language.walletMenuAppearance}
						</S.SectionLabel>
						{THEME_OPTIONS.map(({ id, labelKey, Icon }) => {
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
									{language[labelKey]}
									{active ? (
										<S.ThemeOptionCheck className="theme-option-check" aria-hidden="true" />
									) : null}
								</Button>
							);
						})}
					</S.Appearance>
					<S.DropdownFooter className="wallet-dropdown-footer">
						<Button
							disabled={disconnecting}
							onClick={() => void disconnect()}
							role="menuitem"
							size="custom"
							variant="danger"
						>
							<Icon icon={LogOut} size="sm" />
							{disconnecting ? language.walletMenuDisconnecting : language.walletMenuDisconnect}
						</Button>
					</S.DropdownFooter>
					{error ? <p role="alert">{error}</p> : null}
				</S.Dropdown>
			) : null}
		</S.Menu>
	);
}

function shortAddress(address: string) {
	return `${address.slice(0, 6)}…${address.slice(-5)}`;
}

/** `connectLabel` is the already-resolved copy shown before a wallet is connected. */
export function walletMenuLabel(
	address: string | null | undefined,
	displayName: string | null | undefined,
	connectLabel: string
) {
	return displayName?.trim() || (address ? shortAddress(address) : connectLabel);
}

export function arBalanceLabel(
	balance: bigint | null,
	status: 'idle' | 'loading' | 'ready' | 'error',
	language: WalletMenuMessages
): string {
	return tokenBalanceLabel(balance, status, 'AR', 12, language);
}

export function tokenBalanceLabel(
	balance: bigint | null,
	status: 'idle' | 'loading' | 'ready' | 'error',
	symbol: string,
	denomination: number,
	language: WalletMenuMessages
): string {
	if (status === 'error') return language.walletMenuBalanceUnavailable;
	if (status !== 'ready' || balance === null) return language.walletMenuBalanceLoading;
	const atomicScale = 10n ** BigInt(denomination);
	const fixedBalance = (balance * 10_000n + atomicScale / 2n) / atomicScale;
	const whole = fixedBalance / 10_000n;
	const fraction = (fixedBalance % 10_000n).toString().padStart(4, '0');
	return formatMessage(language.walletMenuBalance, { amount: `${whole.toLocaleString()}.${fraction}`, symbol });
}
