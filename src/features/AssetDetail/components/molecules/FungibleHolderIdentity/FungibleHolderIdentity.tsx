import { WalletAddress, WalletIdentity } from 'components/organisms/WalletAddress';
import { isArweaveId } from 'helpers/arweave-id';
import { useMessages } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';

export default function FungibleHolderIdentity(props: { address: string }) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);

	return isArweaveId(props.address) ? (
		<WalletAddress address={props.address} label={messages.assetDetailWalletLabelHolder} />
	) : (
		<WalletIdentity address={props.address} />
	);
}
