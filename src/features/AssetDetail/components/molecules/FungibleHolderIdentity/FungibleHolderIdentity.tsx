import { WalletAddress, WalletIdentity } from 'components/organisms/WalletAddress';
import { isArweaveId } from 'helpers/arweave-id';

export default function FungibleHolderIdentity(props: { address: string }) {
	return isArweaveId(props.address) ? (
		<WalletAddress address={props.address} label="holder" />
	) : (
		<WalletIdentity address={props.address} />
	);
}
