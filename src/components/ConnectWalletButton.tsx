import { Wallet } from 'lucide-react';

import { useWallet } from 'providers/WalletProvider';

export function ConnectWalletButton({ className = 'primary with-icon' }: { className?: string }) {
  const wallet = useWallet();

  return (
    <button
      aria-label="Connect wallet"
      className={className}
      onClick={(event) => wallet.openConnectDialog(event.currentTarget)}
      type="button"
    >
      <Wallet className="ui-icon ui-icon--sm" aria-hidden="true" />
      Connect wallet
    </button>
  );
}
