import React from 'react';
import { Copy, Download, FileUp, KeyRound, Wallet, X } from 'lucide-react';

import { type BrowserWalletId, GeneratedWallet } from 'api/wallet';

import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { Icon } from 'components/atoms/Icon';
import { IconButton } from 'components/atoms/IconButton';
import { Dialog } from 'components/organisms/Dialog';
import { appErrorMessage, toAppError } from 'helpers/app-error';
import { useWallet } from 'providers/WalletProvider';

// Wallet connection, generation, and keyfile import dialog opened through the wallet provider.
export default function WalletConnectionDialog() {
	const wallet = useWallet();
	const open = wallet.connectDialogOpen;
	const onClose = wallet.closeConnectDialog;
	const restoreTarget = wallet.connectDialogRestoreTarget;
	const fileInput = React.useRef<HTMLInputElement>(null);
	const [action, setAction] = React.useState<BrowserWalletId | 'generate' | 'import' | null>(null);
	const [error, setError] = React.useState('');
	const [generatedWallet, setGeneratedWallet] = React.useState<GeneratedWallet | null>(null);
	const [copied, setCopied] = React.useState(false);
	const close = React.useCallback(() => {
		if (generatedWallet) return;
		setError('');
		setAction(null);
		onClose();
	}, [generatedWallet, onClose]);

	React.useEffect(() => {
		if (!open) {
			setCopied(false);
			setGeneratedWallet(null);
		}
	}, [open]);

	const connectBrowserWallet = async (walletId: BrowserWalletId) => {
		setAction(walletId);
		setError('');
		try {
			await wallet.connect(walletId);
			onClose();
		} catch (cause) {
			setError(walletErrorMessage(cause));
		} finally {
			setAction(null);
		}
	};
	const generate = async () => {
		setAction('generate');
		setError('');
		try {
			setGeneratedWallet(await wallet.generateLocalWallet());
		} catch (cause) {
			setError(walletErrorMessage(cause));
		} finally {
			setAction(null);
		}
	};
	const importWallet = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const input = event.currentTarget;
		const file = input.files?.[0];
		if (!file) return;
		setAction('import');
		setError('');
		try {
			await wallet.importLocalWallet(file);
			onClose();
		} catch (cause) {
			setError(walletErrorMessage(cause));
			input.value = '';
		} finally {
			setAction(null);
		}
	};
	const downloadGeneratedWallet = () => {
		if (!generatedWallet) return;
		const blob = new Blob([JSON.stringify(generatedWallet.jwk, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${generatedWallet.address}.json`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
		setGeneratedWallet(null);
		onClose();
	};

	return (
		<Dialog
			backdropClassName="dialog-backdrop wallet-connect-backdrop"
			className="dialog dialog-compact wallet-connect-dialog"
			focusKey={generatedWallet?.address}
			labelledBy="wallet-connect-title"
			onDismiss={close}
			open={open}
			restoreTarget={restoreTarget}
		>
			<div className="dialog-heading wallet-connect-heading">
				<div>
					<h2 id="wallet-connect-title">Connect wallet</h2>
				</div>
				<IconButton
					icon={X}
					label="Close wallet options"
					onClick={close}
					disabled={Boolean(generatedWallet)}
					className="close"
				/>
			</div>
			{generatedWallet ? (
				<div className="generated-wallet-panel">
					<div>
						<Icon icon={KeyRound} />
						<div>
							<strong>Keyfile generated</strong>
							<span>Download this keyfile before closing.</span>
						</div>
					</div>
					<div className="generated-wallet-address">
						<div>
							<span>Address</span>
							<code>{generatedWallet.address}</code>
						</div>
						<Button
							className="with-icon"
							onClick={async () => {
								await navigator.clipboard.writeText(generatedWallet.address);
								setCopied(true);
							}}
							type="button"
							size="custom"
						>
							<Icon icon={Copy} size="sm" />
							{copied ? 'Copied' : 'Copy'}
						</Button>
					</div>
					<Button
						className="wide with-icon"
						onClick={downloadGeneratedWallet}
						type="button"
						size="custom"
						variant="primary"
					>
						<Icon icon={Download} size="sm" />
						Download keyfile
					</Button>
					<p className="wallet-keyfile-warning">
						<strong>Keep this file safe.</strong> Anyone with it controls the wallet, and it cannot be
						recovered if lost.
					</p>
				</div>
			) : (
				<>
					<div className="wallet-option-list">
						<div className="wallet-option">
							<div className="wallet-option-copy">
								<Icon icon={Wallet} />
								<div>
									<strong>PermawebOS</strong>
									<span>Permaweb wallet extension</span>
								</div>
							</div>
							<Button
								data-dialog-initial
								onClick={() => void connectBrowserWallet('permaweb-os')}
								disabled={action !== null}
								type="button"
								size="custom"
								variant="primary"
							>
								{action === 'permaweb-os' ? 'Connecting…' : 'Connect'}
							</Button>
						</div>
						<div className="wallet-option">
							<div className="wallet-option-copy">
								<Icon icon={Wallet} />
								<div>
									<strong>Wander</strong>
									<span>Browser extension wallet</span>
								</div>
							</div>
							<Button
								onClick={() => void connectBrowserWallet('wander')}
								disabled={action !== null}
								type="button"
								size="custom"
								variant="primary"
							>
								{action === 'wander' ? 'Connecting…' : 'Connect'}
							</Button>
						</div>
						<div className="wallet-option">
							<div className="wallet-option-copy">
								<Icon icon={KeyRound} />
								<div>
									<strong>Generate keyfile</strong>
									<span>Create a new local wallet</span>
								</div>
							</div>
							<Button
								onClick={() => void generate()}
								disabled={action !== null}
								type="button"
								size="custom"
							>
								{action === 'generate' ? 'Generating…' : 'Generate'}
							</Button>
						</div>
						<div className="wallet-option">
							<div className="wallet-option-copy">
								<Icon icon={FileUp} />
								<div>
									<strong>Import keyfile</strong>
									<span>Load an existing Arweave keyfile</span>
								</div>
							</div>
							<Button
								onClick={() => fileInput.current?.click()}
								disabled={action !== null}
								type="button"
								size="custom"
							>
								{action === 'import' ? 'Importing…' : 'Import'}
							</Button>
							<FileInput ref={fileInput} hidden accept=".json,application/json" onChange={importWallet} />
						</div>
					</div>
					{error ? (
						<p className="wallet-connect-error" role="alert">
							{error}
						</p>
					) : null}
				</>
			)}
		</Dialog>
	);
}

function walletErrorMessage(cause: unknown) {
	return appErrorMessage(toAppError(cause, 'wallet-connection-failed'));
}
