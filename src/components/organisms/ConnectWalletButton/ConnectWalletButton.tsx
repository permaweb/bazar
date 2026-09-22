import { Wallet } from 'lucide-react';

import { useWallet } from 'providers/WalletProvider';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';

export default function ConnectWalletButton(props: { className?: string }) {
	const wallet = useWallet();

	return (
		<Button
			aria-label="Connect wallet"
			className={props.className}
			onClick={(event) => wallet.openConnectDialog(event.currentTarget)}
			variant="primary"
		>
			<Icon icon={Wallet} size="sm" />
			Connect wallet
		</Button>
	);
}
