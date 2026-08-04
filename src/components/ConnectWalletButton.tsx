import React from 'react';
import { Wallet } from 'lucide-react';

import { useWallet } from 'providers/WalletProvider';
import { marketplaceErrorMessage } from '../app/marketplace-error';

export function ConnectWalletButton({ className = 'primary with-icon' }: { className?: string }) {
  const wallet = useWallet();
  const [connecting, setConnecting] = React.useState(false);
  const [error, setError] = React.useState('');

  const connect = async () => {
    setConnecting(true);
    setError('');
    try {
      await wallet.connect();
    } catch (cause) {
      setError(marketplaceErrorMessage(cause));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <>
      <button
        aria-label={connecting ? 'Connecting wallet' : error ? 'Retry wallet connection' : 'Connect wallet'}
        className={className}
        disabled={connecting}
        onClick={() => void connect()}
        type="button"
      >
        <Wallet className="ui-icon ui-icon--sm" aria-hidden="true" />
        {connecting ? 'Connecting…' : error ? 'Try connecting again' : 'Connect wallet'}
      </button>
      {error ? <p className="connect-wallet-error" role="alert">Wallet connection failed: {error}</p> : null}
    </>
  );
}
