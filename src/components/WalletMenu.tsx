import { Copy, Library, LogOut, Wallet } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useWallet } from 'providers/WalletProvider';

export function WalletMenu() {
  const navigate = useNavigate();
  const wallet = useWallet();
  const root = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [error, setError] = React.useState('');

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
      <button
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
        title={wallet.address || undefined}
        type="button"
      >
        <Wallet className="ui-icon ui-icon--sm" aria-hidden="true" />
        <span>{wallet.address ? shortAddress(wallet.address) : 'Connect'}</span>
      </button>
      {open && wallet.address ? (
        <div aria-label="Wallet options" className="wallet-dropdown" role="menu">
          <div className="wallet-dropdown-header">
            <Wallet className="ui-icon" aria-hidden="true" />
            <div>
              <span>Connected wallet</span>
              <strong>{shortAddress(wallet.address)}</strong>
            </div>
          </div>
          <div className="wallet-dropdown-actions">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/my-assets');
              }}
              role="menuitem"
              type="button"
            >
              <Library className="ui-icon ui-icon--sm" aria-hidden="true" />
              My assets
            </button>
            <button onClick={() => void copyAddress()} role="menuitem" type="button">
              <Copy className="ui-icon ui-icon--sm" aria-hidden="true" />
              {copied ? 'Copied' : 'Copy address'}
            </button>
          </div>
          <div className="wallet-dropdown-footer">
            <button disabled={disconnecting} onClick={() => void disconnect()} role="menuitem" type="button">
              <LogOut className="ui-icon ui-icon--sm" aria-hidden="true" />
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
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
