import React from 'react';

import { ArCurrencyText } from 'components/atoms/ArCurrencyLabel';

import { useActivityAmountTicker } from '../../../hooks/useActivityAmountTicker';

import * as S from './styles';

export default function CompactActivityAmount(props: { amount: string }) {
	const amountTicker = useActivityAmountTicker(props.amount);
	const value = <ArCurrencyText>{props.amount}</ArCurrencyText>;
	return (
		<S.Amount
			className={`activity-compact-amount${amountTicker.ticker.active ? ' is-overflowing' : ''}`}
			ref={amountTicker.containerRef}
			style={
				amountTicker.ticker.active
					? ({
							'--activity-ticker-duration': `${amountTicker.ticker.duration}s`,
							'--activity-ticker-shift': `-${amountTicker.ticker.shift}px`,
					  } as React.CSSProperties)
					: undefined
			}
		>
			<S.Static className="activity-compact-amount-static" ref={amountTicker.textRef}>
				{value}
			</S.Static>
			<S.Track aria-hidden="true" className="activity-compact-amount-track">
				<span>{value}</span>
				<span>{value}</span>
			</S.Track>
		</S.Amount>
	);
}
