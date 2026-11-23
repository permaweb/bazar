import { Wallet } from 'lucide-react';

import { useWallet } from 'providers/WalletProvider';

import { Button } from './Button';

export function ConnectWalletButton({ className }: { className?: string }) {
	const wallet = useWallet();
	const restoring = wallet.connectionStatus === 'restoring';

	return (
		<Button
			aria-busy={restoring || undefined}
			aria-disabled={restoring || undefined}
			aria-label={restoring ? 'Checking wallet connection' : 'Connect wallet'}
			className={className}
			onClick={(event) => {
				// The restore is bounded by WALLET_RESTORE_GRACE_MS; do not offer Connect before it settles.
				if (!restoring) wallet.openConnectDialog(event.currentTarget);
			}}
			variant="primary"
		>
			<Wallet className="ui-icon ui-icon--sm" aria-hidden="true" />
			{restoring ? 'Checking wallet…' : 'Connect wallet'}
		</Button>
	);
}
