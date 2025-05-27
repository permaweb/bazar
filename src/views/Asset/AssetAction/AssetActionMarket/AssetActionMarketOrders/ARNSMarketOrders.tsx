import React from 'react';
import { useDispatch } from 'react-redux';

import Arweave from 'arweave';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import { createOrder, createOrderbook } from '@permaweb/ucm';

import { Button } from 'components/atoms/Button';
import { FormField } from 'components/atoms/FormField';
import { Panel } from 'components/molecules/Panel';
import { AO, GATEWAYS } from 'helpers/config';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';

interface IProps {
	arnsToken: any;
	type: 'buy' | 'sell' | 'transfer';
	toggleUpdate: () => void;
}

export default function ARNSMarketOrders({ arnsToken, type, toggleUpdate }: IProps) {
	const dispatch = useDispatch();
	const arweaveProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [price, setPrice] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	async function handleSubmit() {
		if (!arweaveProvider.wallet || !arweaveProvider.profile?.id) return;

		try {
			setLoading(true);
			setError(null);

			const dependencies = {
				ao: connect({ MODE: 'legacy' }),
				arweave: Arweave.init({
					host: GATEWAYS.arweave,
					protocol: 'https',
					port: 443,
					timeout: 40000,
					logging: false,
				}),
				signer: createDataItemSigner(arweaveProvider.wallet),
			};

			if (type === 'sell') {
				// Create sell order
				const order = await createOrder(
					dependencies,
					{
						assetId: arnsToken.ProcessId,
						price: price,
						quantity: 1,
					},
					arweaveProvider.wallet
				);

				if (order) {
					toggleUpdate();
				}
			} else if (type === 'buy') {
				// Create buy order
				const order = await createOrder(
					dependencies,
					{
						assetId: arnsToken.ProcessId,
						price: price,
						quantity: 1,
						type: 'buy',
					},
					arweaveProvider.wallet
				);

				if (order) {
					toggleUpdate();
				}
			} else if (type === 'transfer') {
				// Handle transfer
				const response = await dependencies.ao.message({
					process: arnsToken.ProcessId,
					signer: dependencies.signer,
					tags: [
						{ name: 'Action', value: 'Transfer' },
						{ name: 'Recipient', value: arweaveProvider.profile.id },
					],
				});

				if (response) {
					toggleUpdate();
				}
			}
		} catch (err: any) {
			setError(err.message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<S.Wrapper>
			<S.InputWrapper>
				<S.FieldsWrapper>
					{type !== 'transfer' && (
						<FormField
							type="number"
							label={language.price}
							value={price}
							onChange={(e) => setPrice(e.target.value)}
							disabled={loading}
							invalid={{ status: false, message: null }}
						/>
					)}
					<S.ActionWrapper>
						<Button
							type="primary"
							label={language[type]}
							handlePress={handleSubmit}
							loading={loading}
							disabled={!price || loading}
						/>
						{error && <S.ErrorMessage>{error}</S.ErrorMessage>}
					</S.ActionWrapper>
				</S.FieldsWrapper>
			</S.InputWrapper>
		</S.Wrapper>
	);
}
