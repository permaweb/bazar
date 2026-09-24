import React from 'react';

import arLogo from 'assets/ar.svg';

import * as S from './styles';

export default function ArCurrencyLabel() {
	return (
		<S.Label className="ar-currency-label">
			<img alt="" aria-hidden="true" src={arLogo} />
			$AR
		</S.Label>
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
