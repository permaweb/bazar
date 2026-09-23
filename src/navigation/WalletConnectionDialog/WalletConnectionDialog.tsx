import React from 'react';
import { Copy, Download, FileUp, KeyRound, Wallet, X } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { FileInput } from 'components/atoms/FileInput';
import { Icon } from 'components/atoms/Icon';
import { IconButton } from 'components/atoms/IconButton';
import { Dialog } from 'components/organisms/Dialog';
import { useAppErrorMessage } from 'hooks/useAppErrorMessage';
import { useWalletConnectionFlow } from 'hooks/useWalletConnectionFlow';
import { useMessages } from 'providers/LanguageProvider';

import { WALLET_CONNECTION_DIALOG_MESSAGES } from './messages';

// Wallet connection, generation, and keyfile import dialog opened through the wallet provider.
export default function WalletConnectionDialog() {
	const language = useMessages(WALLET_CONNECTION_DIALOG_MESSAGES);
	const errorMessage = useAppErrorMessage();
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
					<h2 id="wallet-connect-title">{language.walletConnectTitle}</h2>
				</div>
				<IconButton
					icon={X}
					label={language.walletConnectClose}
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
							<strong>{language.walletConnectGeneratedTitle}</strong>
							<span>{language.walletConnectGeneratedDetail}</span>
						</div>
					</div>
					<div className="generated-wallet-address">
						<div>
							<span>{language.walletConnectAddress}</span>
							<code>{generatedWallet.address}</code>
						</div>
						<Button
							className="with-icon"
							onClick={() => void flow.copyAddress()}
							type="button"
							size="custom"
						>
							<Icon icon={Copy} size="sm" />
							{copied ? language.walletConnectCopied : language.walletConnectCopy}
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
						{language.walletConnectDownload}
					</Button>
					<p className="wallet-keyfile-warning">
						<strong>{language.walletConnectKeepSafeTitle}</strong> {language.walletConnectKeepSafeDetail}
					</p>
				</div>
			) : (
				<>
					<div className="wallet-option-list">
						<div className="wallet-option">
							<div className="wallet-option-copy">
								<Icon icon={Wallet} />
								<div>
									<strong>{language.walletConnectPermawebOs}</strong>
									<span>{language.walletConnectPermawebOsDetail}</span>
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
								{pending === 'permaweb-os'
									? language.walletConnectConnecting
									: language.walletConnectConnect}
							</Button>
						</div>
						<div className="wallet-option">
							<div className="wallet-option-copy">
								<Icon icon={Wallet} />
								<div>
									<strong>{language.walletConnectWander}</strong>
									<span>{language.walletConnectWanderDetail}</span>
								</div>
							</div>
							<Button
								onClick={() => void flow.connect('wander')}
								disabled={pending !== null}
								type="button"
								size="custom"
								variant="primary"
							>
								{pending === 'wander'
									? language.walletConnectConnecting
									: language.walletConnectConnect}
							</Button>
						</div>
						<div className="wallet-option">
							<div className="wallet-option-copy">
								<Icon icon={KeyRound} />
								<div>
									<strong>{language.walletConnectGenerateTitle}</strong>
									<span>{language.walletConnectGenerateDetail}</span>
								</div>
							</div>
							<Button
								onClick={() => void flow.generate()}
								disabled={pending !== null}
								type="button"
								size="custom"
							>
								{pending === 'generate'
									? language.walletConnectGenerating
									: language.walletConnectGenerate}
							</Button>
						</div>
						<div className="wallet-option">
							<div className="wallet-option-copy">
								<Icon icon={FileUp} />
								<div>
									<strong>{language.walletConnectImportTitle}</strong>
									<span>{language.walletConnectImportDetail}</span>
								</div>
							</div>
							<Button
								onClick={() => fileInput.current?.click()}
								disabled={pending !== null}
								type="button"
								size="custom"
							>
								{pending === 'import' ? language.walletConnectImporting : language.walletConnectImport}
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
							{errorMessage(error)}
						</p>
					) : null}
				</>
			)}
		</Dialog>
	);
}
