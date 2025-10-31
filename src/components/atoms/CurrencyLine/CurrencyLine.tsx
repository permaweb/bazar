import React from 'react';
import { Link } from 'react-router-dom';

import { REFORMATTED_ASSETS, TOKEN_REGISTRY, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { formatCount } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { useTokenProvider } from 'providers/TokenProvider';

import * as S from './styles';

interface IProps {
	amount: number | string | null;
	currency: string;
	callback?: () => void;
}

export default function CurrencyLine(props: IProps & { tokenLogo?: string; tokenSymbol?: string }) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [_timedOut, setTimedOut] = React.useState(false);

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
			return `${language.loading}...`;
		}

		// Handle zero balance explicitly
		if (props.amount === 0 || props.amount === '0') {
			return '0';
		}

		if (isNaN(Number(props.amount))) {
			return `${language.loading}...`;
		}

		// Check TOKEN_REGISTRY first for dynamic tokens
		const tokenInfo = TOKEN_REGISTRY[currency];
		if (tokenInfo && tokenInfo.denomination) {
			const denomination = tokenInfo.denomination;
			const factor = Math.pow(10, denomination);
			const formattedAmount: string = (amount / factor).toFixed(denomination > 4 ? 4 : denomination);
			return formatCount(formattedAmount);
		}

		// Check REFORMATTED_ASSETS for fallback denomination
		if (REFORMATTED_ASSETS[currency]?.denomination) {
			const denomination = REFORMATTED_ASSETS[currency].denomination;
			const factor = Math.pow(10, denomination);
			const formattedAmount: string = (amount / factor).toFixed(denomination > 4 ? 4 : denomination);
			return formatCount(formattedAmount);
		}

		// Handle token without denomination - just return formatted amount
		if (amount !== null && amount !== undefined && !isNaN(Number(amount))) {
			return formatCount(amount.toString());
		}

		return `${language.loading}...`;
	}

	function getCurrency() {
		// Use the token from the provider which may have dynamic metadata
		const providerToken = useTokenProvider().availableTokens.find((token) => token.id === props.currency);

		if (providerToken) {
			return (
				<Link
					to={`${URLS.asset}${props.currency}`}
					onClick={(e: any) => (props.callback ? props.callback() : e.stopPropagation())}
				>
					<S.Currency>
						<img src={getTxEndpoint(providerToken.logo)} alt={providerToken.symbol || props.currency} />
					</S.Currency>
				</Link>
			);
		} else if (props.currency) {
			// Fallback: use REFORMATTED_ASSETS data when currency metadata isn't loaded yet
			if (REFORMATTED_ASSETS[props.currency]?.logo) {
				return (
					<Link
						to={`${URLS.asset}${props.currency}`}
						onClick={(e: any) => (props.callback ? props.callback() : e.stopPropagation())}
					>
						<S.Currency>
							<img
								src={getTxEndpoint(REFORMATTED_ASSETS[props.currency].logo)}
								alt={REFORMATTED_ASSETS[props.currency].title || props.currency}
							/>
						</S.Currency>
					</Link>
				);
			}

			// Final fallback: show a generic token indicator
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

	return (
		<S.Wrapper useReverseLayout={false}>
			{getCurrency()}
			<span>{getDenominatedTokenValue(Number(props.amount), props.currency)}</span>
		</S.Wrapper>
	);
}
