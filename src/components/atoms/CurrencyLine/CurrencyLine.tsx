import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { formatCount } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import { getDenominatedTokenValue } from '../../../helpers/token';

import * as S from './styles';
import { IProps } from './types';

export default function CurrencyLine(props: IProps) {
	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	function getCurrency() {
		if (props.currency && currenciesReducer && currenciesReducer[props.currency]) {
			let currency = null;
			if (currenciesReducer[props.currency].Ticker) {
				currency = <span>{currenciesReducer[props.currency].Ticker}</span>;
			}
			if (currenciesReducer[props.currency].Logo) {
				currency = (
					<img
						src={getTxEndpoint(currenciesReducer[props.currency].Logo)}
						alt={currenciesReducer[props.currency].Ticker}
					/>
				);
			}

			return (
				<Link
					to={`${URLS.asset}${props.currency}`}
					onClick={(e: any) => (props.callback ? props.callback() : e.stopPropagation())}
				>
					<S.Currency>{currency}</S.Currency>
				</Link>
			);
		}
		return null;
	}

	return props.currency ? (
		<S.Wrapper useReverseLayout={props.useReverseLayout}>
			<span>{getDenominatedTokenValue(props.amount, props.currency, currenciesReducer)}</span>
			{getCurrency()}
		</S.Wrapper>
	) : null;
}
