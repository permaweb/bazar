import type { LucideIcon } from 'lucide-react';

export type IconSize = 'xs' | 'sm' | 'md';

// Decorative glyph using the shared icon sizing classes. Pass `label` only when the icon carries
// meaning on its own; otherwise it is hidden from assistive technology.
export default function Icon(props: { icon: LucideIcon; size?: IconSize; className?: string; label?: string }) {
	const className = [
		'ui-icon',
		props.size && props.size !== 'md' ? `ui-icon--${props.size}` : '',
		props.className ?? '',
	]
		.filter(Boolean)
		.join(' ');
	return props.label ? (
		<props.icon aria-label={props.label} className={className} role="img" />
	) : (
		<props.icon aria-hidden="true" className={className} />
	);
}
