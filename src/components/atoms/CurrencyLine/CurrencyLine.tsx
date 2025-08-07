import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { REFORMATTED_ASSETS, URLS } from 'helpers/config';
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
		// Check if amount is a valid number (but allow zero)
		if (props.amount === null || props.amount === undefined) {
			return timedOut ? 'N/A' : `${language.loading}...`;
		}

		// Handle zero balance explicitly
		if (props.amount === 0 || props.amount === '0') {
			return '0';
		}

		if (isNaN(Number(props.amount))) {
			return timedOut ? 'N/A' : `${language.loading}...`;
		}

		// If we have a valid amount but no currency data yet, check for fallback denomination
		if (!currenciesReducer || !currenciesReducer[currency]) {
			// Check if we have fallback denomination info in REFORMATTED_ASSETS
			if (REFORMATTED_ASSETS[currency]?.denomination) {
				const denomination = REFORMATTED_ASSETS[currency].denomination;
				const factor = Math.pow(10, denomination);
				const formattedAmount: string = (amount / factor).toFixed(denomination > 4 ? 4 : denomination);
				return formatCount(formattedAmount);
			}

			// Show the raw balance while currency metadata loads
			if (amount !== null && amount !== undefined && !isNaN(Number(amount))) {
				return formatCount(amount.toString());
			}
			return timedOut ? 'N/A' : `${language.loading}...`;
		}

		// Handle token with denomination
		if (currenciesReducer[currency].Denomination && currenciesReducer[currency].Denomination > 1) {
			const denomination = currenciesReducer[currency].Denomination;
			const factor = Math.pow(10, denomination);
			const formattedAmount: string = (Math.round(amount) / factor).toFixed(denomination);
			return formatCount(formattedAmount);
		}

		// Handle token without denomination - just return formatted amount
		if (amount !== null && amount !== undefined && !isNaN(Number(amount))) {
			return formatCount(amount.toString());
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
		} else if (props.currency) {
			// Fallback: show a generic token indicator when currency metadata isn't loaded yet
			return (
				<Link
					to={`${URLS.asset}${props.currency}`}
					onClick={(e: any) => (props.callback ? props.callback() : e.stopPropagation())}
				>
					<S.Currency>
						<span>🪙</span> {/* Generic token emoji as fallback */}
					</S.Currency>
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
