import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { formatCount } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { RootState } from 'store';

import * as S from './styles';
import { IProps } from './types';

export default function CurrencyLine(props: IProps) {
	const currenciesReducer = useSelector((state: RootState) => state.currenciesReducer);

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [timedOut, setTimedOut] = React.useState(false);

	React.useEffect(() => {
		const timer = setTimeout(() => {
			if (props.amount === null || props.amount === undefined || isNaN(Number(props.amount))) {
				setTimedOut(true);
			}
		}, 5000); // 5 seconds timeout

		return () => clearTimeout(timer);
	}, [props.amount]);

	function getDenominatedTokenValue(amount: number, currency: string) {
		// Check if amount is a valid number
		if (props.amount === null || props.amount === undefined || isNaN(Number(props.amount))) {
			return timedOut ? 'N/A' : `${language.loading}...`;
		}

		// Check if currency data is available
		if (!currenciesReducer || !currenciesReducer[currency]) {
			return timedOut ? 'N/A' : `${language.loading}...`;
		}

		if (currenciesReducer[currency].Denomination && currenciesReducer[currency].Denomination > 1) {
			const denomination = currenciesReducer[currency].Denomination;
			const factor = Math.pow(10, denomination);
			const formattedAmount: string = (Math.round(amount) / factor).toFixed(denomination);
			return formatCount(formattedAmount);
		}

		return timedOut ? 'N/A' : `${language.loading}...`;
	}

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
			<span>{getDenominatedTokenValue(Number(props.amount), props.currency)}</span>
			{getCurrency()}
		</S.Wrapper>
	) : null;
}
