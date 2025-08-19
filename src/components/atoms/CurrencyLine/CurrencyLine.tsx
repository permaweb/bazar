import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { AO, TOKEN_REGISTRY, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { formatCount } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { useTokenProvider } from 'providers/TokenProvider';
import { RootState } from 'store';

import * as S from './styles';
import { IProps } from './types';

export default function CurrencyLine(props: IProps & { tokenLogo?: string; tokenSymbol?: string }) {
	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);
	const { selectedToken } = useTokenProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	function getDenominatedTokenValue(amount: number, currency: string) {
		if (props.amount === null) {
			return `${language.loading}...`;
		}
		// Always use denomination from TOKEN_REGISTRY
		const tokenInfo = TOKEN_REGISTRY[currency];
		const denomination = tokenInfo && tokenInfo.denomination ? tokenInfo.denomination : 0;

		if (denomination > 0) {
			const factor = Math.pow(10, denomination);
			const formattedAmount: string = (Math.round(amount) / factor).toFixed(denomination);

			return formatCount(formattedAmount);
		}
		return formatCount(amount.toString());
	}

	function getCurrency() {
		// Use the token from the provider which may have dynamic metadata
		const providerToken = useTokenProvider().availableTokens.find((token) => token.id === props.currency);
		const tokenInfo = providerToken || TOKEN_REGISTRY[props.currency];

		if (tokenInfo) {
			return (
				<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
					{tokenInfo.logo ? (
						<img src={getTxEndpoint(tokenInfo.logo)} alt={tokenInfo.symbol || ''} />
					) : (
						<div
							style={{
								width: '16px',
								height: '16px',
								backgroundColor: '#e5e5e5',
								borderRadius: '50%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontSize: '8px',
								fontWeight: 'bold',
								color: '#666',
							}}
						>
							{tokenInfo.symbol?.charAt(0) || '?'}
						</div>
					)}
					{tokenInfo.symbol && <span>{tokenInfo.symbol}</span>}
				</span>
			);
		}
		return null;
	}

	return props.currency ? (
		<S.Wrapper useReverseLayout={props.useReverseLayout}>
			<span>{getDenominatedTokenValue(Number(props.amount), props.currency)}</span>
			{getCurrency()}
		</S.Wrapper>
	) : null;
}
