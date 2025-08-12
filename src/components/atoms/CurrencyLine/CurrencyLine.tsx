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
		// Always use logo and symbol from TOKEN_REGISTRY
		const tokenInfo = TOKEN_REGISTRY[props.currency];
		if (tokenInfo) {
			return (
				<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
					{tokenInfo.logo && <img src={`https://arweave.net/${tokenInfo.logo}`} alt={tokenInfo.symbol || ''} />}
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
