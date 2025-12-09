import React from 'react';
import { ANT } from '@ar.io/sdk';
import Arweave from '@irys/arweave';
import { ArconnectSigner } from 'arbundles';

import { ANTInfo } from 'helpers/arnsFetch';
import { useArweaveProvider } from 'providers/ArweaveProvider';

import * as S from './styles';

export interface ARNSMetadataProps {
	metadata: Partial<ANTInfo>;
	onTransfer?: () => void;
	compact?: boolean;
}

const ARNSMetadata: React.FC<ARNSMetadataProps> = ({ metadata, onTransfer, compact = false }) => {
	const {
		Name,
		Ticker,
		Owner,
		Description,
		Logo,
		Keywords = [],
		Denomination,
		processId: processId,
		'Total-Supply': TotalSupply,
		Handlers,
		HandlerNames,
		name,
	} = metadata;
	const arProvider = useArweaveProvider();
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const profileProcessId = arProvider.profile?.id;
	const wallet = arProvider.wallet;

	const showTransferButton = profileProcessId && Owner !== profileProcessId && wallet;

	async function handleTransfer() {
		setLoading(true);
		setError(null);
		try {
			const signer = new ArconnectSigner(window.arweaveWallet, Arweave.init({ url: 'https://arweave.net' }));
			const antClient = ANT.init({
				processId: processId,
				signer,
			});
			await antClient.transfer({ target: profileProcessId });
			onTransfer?.();
		} catch (e: any) {
			setError(e.message || 'Transfer failed');
		} finally {
			setLoading(false);
		}
	}

	if (compact) {
		return (
			<S.CompactCard>
				<S.CompactContent>
					{Logo ? (
						<S.CompactLogo src={`https://arweave.net/${Logo}`} alt={`${Name} logo`} />
					) : (
						<S.CompactLogoPlaceholder>No Image</S.CompactLogoPlaceholder>
					)}
					<S.CompactInfo>
						<S.CompactName>{Name}</S.CompactName>
						<S.CompactTicker>{Ticker}</S.CompactTicker>
						{name && <S.CompactArNS>ArNS: {name}</S.CompactArNS>}
					</S.CompactInfo>
				</S.CompactContent>
			</S.CompactCard>
		);
	}

	return (
		<S.Card>
			<S.CardContent>
				<S.Container>
					<S.Row>
						{Logo ? (
							<S.Logo src={`https://arweave.net/${Logo}`} alt={`${Name} logo`} />
						) : (
							<S.LogoPlaceholder>No Image</S.LogoPlaceholder>
						)}
						<S.InfoSection>
							<S.Name>{Name}</S.Name>
							<S.Ticker>Ticker: {Ticker}</S.Ticker>
							{name && <S.ArNSName>ArNS Name: {name}</S.ArNSName>}
							<S.Owner>Owner: {Owner}</S.Owner>
							{processId && <S.ProcessId>Process ID: {processId}</S.ProcessId>}
							{Denomination && <S.Denomination>Denomination: {Denomination}</S.Denomination>}
							{TotalSupply && <S.TotalSupply>Total Supply: {TotalSupply}</S.TotalSupply>}
						</S.InfoSection>
					</S.Row>
					{Description && <S.Description>{Description}</S.Description>}
					{Keywords.length > 0 && (
						<S.KeywordList>
							{Keywords.map((keyword, index) => (
								<S.Badge key={index}>{keyword}</S.Badge>
							))}
						</S.KeywordList>
					)}
					{(Handlers?.length > 0 || HandlerNames?.length > 0) && (
						<S.HandlersSection>
							{Handlers?.length > 0 && (
								<S.HandlerList>
									<S.HandlerTitle>Handlers:</S.HandlerTitle>
									{Handlers.map((handler, index) => (
										<S.HandlerItem key={index}>{handler}</S.HandlerItem>
									))}
								</S.HandlerList>
							)}
							{HandlerNames?.length > 0 && (
								<S.HandlerList>
									<S.HandlerTitle>Handler Names:</S.HandlerTitle>
									{HandlerNames.map((name, index) => (
										<S.HandlerItem key={index}>{name}</S.HandlerItem>
									))}
								</S.HandlerList>
							)}
						</S.HandlersSection>
					)}
					{showTransferButton && (
						<S.TransferButton disabled={loading} onClick={handleTransfer}>
							{loading ? 'Transferring...' : 'Transfer to Profile'}
						</S.TransferButton>
					)}
					{error && <S.ErrorMsg>{error}</S.ErrorMsg>}
				</S.Container>
			</S.CardContent>
		</S.Card>
	);
};

export default ARNSMetadata;
