import { Wallet } from 'lucide-react';

import { useMessages } from 'providers/LanguageProvider';
import { useWallet } from 'providers/WalletProvider';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';

import { CONNECT_WALLET_BUTTON_MESSAGES } from './messages';

export default function ConnectWalletButton(props: { className?: string }) {
	const messages = useMessages(CONNECT_WALLET_BUTTON_MESSAGES);
	const wallet = useWallet();

	return (
		<Button
			aria-label={messages.connectWallet}
			className={props.className}
			onClick={(event) => wallet.openConnectDialog(event.currentTarget)}
			variant="primary"
		>
			<Icon icon={Wallet} size="sm" />
			{messages.connectWallet}
		</Button>
	);
}
