import bazarLogo from '../assets/logo.svg';

export function BazarMark({ className = '' }: { className?: string }) {
	return <img className={`bazar-mark${className ? ` ${className}` : ''}`} src={bazarLogo} alt="" aria-hidden="true" />;
}
