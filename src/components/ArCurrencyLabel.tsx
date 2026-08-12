import arLogo from '../assets/ar.svg';

export function ArCurrencyLabel() {
	return (
		<span className="ar-currency-label">
			<img alt="" aria-hidden="true" src={arLogo} />
			AR
		</span>
	);
}
