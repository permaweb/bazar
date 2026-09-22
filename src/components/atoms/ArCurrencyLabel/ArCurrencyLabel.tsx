import React from 'react';

import arLogo from 'assets/ar.svg';

export default function ArCurrencyLabel() {
	return (
		<span className="ar-currency-label">
			<img alt="" aria-hidden="true" src={arLogo} />
			$AR
		</span>
	);
}

export function formatArCurrencyText(value: string) {
	return value.replace(/\$?\bAR\b/g, '$AR');
}

export function ArCurrencyText(props: { children: string }) {
	return (
		<>
			{props.children
				.split(/(\$?\bAR\b)/g)
				.map((part, index) =>
					part === 'AR' || part === '$AR' ? (
						<ArCurrencyLabel key={`ar-${index}`} />
					) : (
						<React.Fragment key={index}>{part}</React.Fragment>
					)
				)}
		</>
	);
}
