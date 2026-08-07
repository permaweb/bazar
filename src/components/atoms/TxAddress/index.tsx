import { Check, Copy } from 'lucide-react';
import React from 'react';

import { transactionExplorerUrl } from 'api/arweave-explorer';
import { Button } from 'components/Button';

export function TxAddress({ address, wrap = false }: { address: string; wrap?: boolean; tooltipPosition?: string }) {
  const [copied, setCopied] = React.useState(false);
  const resetTimer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className={`tx-address${wrap ? ' is-wrapped' : ''}`}>
      <a
        className="tx-address-link"
        href={transactionExplorerUrl(address)}
        target="_blank"
        rel="noreferrer"
        title={address}
      >
        {wrap ? address : `${address.slice(0, 7)}…${address.slice(-6)}`}
      </a>
      <Button
        aria-label={copied ? 'Transaction address copied' : 'Copy transaction address'}
        className="tx-address-copy"
        onClick={() => void copyAddress()}
        size="icon"
        title={copied ? 'Copied' : 'Copy transaction address'}
        variant="ghost"
      >
        {copied ? (
          <Check className="ui-icon ui-icon--xs" aria-hidden="true" />
        ) : (
          <Copy className="ui-icon ui-icon--xs" aria-hidden="true" />
        )}
      </Button>
      <span className="sr-only" aria-live="polite" role="status">
        {copied ? 'Transaction address copied.' : ''}
      </span>
    </span>
  );
}
