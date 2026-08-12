import React from 'react';

import arLogo from '../assets/ar.svg';

export function ArCurrencyLabel() {
	return (
		<span className="ar-currency-label">
			<img alt="" aria-hidden="true" src={arLogo} />
			AR
		</span>
	);
}

export function ArCurrencyText({ children }: { children: string }) {
	return (
		<>
			{children
				.split(/\b(AR)\b/g)
				.map((part, index) =>
					part === 'AR' ? (
						<ArCurrencyLabel key={`ar-${index}`} />
					) : (
						<React.Fragment key={index}>{part}</React.Fragment>
					)
				)}
		</>
	);
}
