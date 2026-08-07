import { Wallet } from 'lucide-react';

import { useWallet } from 'providers/WalletProvider';

import { Button } from './Button';

export function ConnectWalletButton({ className }: { className?: string }) {
  const wallet = useWallet();

  return (
    <Button
      aria-label="Connect wallet"
      className={className}
      onClick={(event) => wallet.openConnectDialog(event.currentTarget)}
      variant="primary"
    >
      <Wallet className="ui-icon ui-icon--sm" aria-hidden="true" />
      Connect wallet
    </Button>
  );
}
