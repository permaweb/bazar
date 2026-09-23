import React from 'react';
import { Copy, Download, FileUp, KeyRound, Wallet, X } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { Icon } from 'components/atoms/Icon';
import { IconButton } from 'components/atoms/IconButton';
import { Dialog } from 'components/organisms/Dialog';
import { appErrorMessage } from 'helpers/app-error';
import { useWalletConnectionFlow } from 'hooks/useWalletConnectionFlow';

// Wallet connection, generation, and keyfile import dialog opened through the wallet provider.
export default function WalletConnectionDialog() {
	const flow = useWalletConnectionFlow();
	const fileInput = React.useRef<HTMLInputElement>(null);
	const pending = flow.state.step === 'choose' ? flow.state.pending : null;
	const error = flow.state.step === 'choose' ? flow.state.error : null;
	const generatedWallet = flow.state.step === 'generated' ? flow.state.wallet : null;
	const copied = flow.state.step === 'generated' && flow.state.copied;
	const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const input = event.currentTarget;
		const file = input.files?.[0];
		if (!file) return;
		if (!(await flow.importKeyfile(file))) input.value = '';
	};

	return (
		<Dialog
			backdropClassName="dialog-backdrop wallet-connect-backdrop"
			className="dialog dialog-compact wallet-connect-dialog"
			focusKey={generatedWallet?.address}
			labelledBy="wallet-connect-title"
			onDismiss={flow.close}
			open={flow.open}
			restoreTarget={flow.restoreTarget}
		>
			<div className="dialog-heading wallet-connect-heading">
				<div>
					<h2 id="wallet-connect-title">Connect wallet</h2>
				</div>
				<IconButton
					icon={X}
					label="Close wallet options"
					onClick={flow.close}
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
							onClick={() => void flow.copyAddress()}
							type="button"
							size="custom"
						>
							<Icon icon={Copy} size="sm" />
							{copied ? 'Copied' : 'Copy'}
						</Button>
					</div>
					<Button
						className="wide with-icon"
						onClick={flow.downloadKeyfile}
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
								onClick={() => void flow.connect('permaweb-os')}
								disabled={pending !== null}
								type="button"
								size="custom"
								variant="primary"
							>
								{pending === 'permaweb-os' ? 'Connecting…' : 'Connect'}
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
								onClick={() => void flow.connect('wander')}
								disabled={pending !== null}
								type="button"
								size="custom"
								variant="primary"
							>
								{pending === 'wander' ? 'Connecting…' : 'Connect'}
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
								onClick={() => void flow.generate()}
								disabled={pending !== null}
								type="button"
								size="custom"
							>
								{pending === 'generate' ? 'Generating…' : 'Generate'}
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
								disabled={pending !== null}
								type="button"
								size="custom"
							>
								{pending === 'import' ? 'Importing…' : 'Import'}
							</Button>
							<FileInput
								ref={fileInput}
								hidden
								accept=".json,application/json"
								onChange={(event) => void handleImport(event)}
							/>
						</div>
					</div>
					{error ? (
						<p className="wallet-connect-error" role="alert">
							{appErrorMessage(error)}
						</p>
					) : null}
				</>
			)}
		</Dialog>
	);
}
