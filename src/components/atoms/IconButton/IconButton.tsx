import React from 'react';
import type { LucideIcon } from 'lucide-react';

import { Button, type ButtonVariant } from '../Button';

// Icon-only action with a required accessible name, such as a dialog close control.
export default function IconButton(props: {
	icon: LucideIcon;
	label: string;
	onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
	disabled?: boolean;
	variant?: ButtonVariant;
	className?: string;
	iconClassName?: string;
}) {
	return (
		<Button
			aria-label={props.label}
			className={props.className}
			disabled={props.disabled}
			onClick={props.onClick}
			size="icon"
			type="button"
			variant={props.variant ?? 'ghost'}
		>
			<props.icon aria-hidden="true" className={props.iconClassName} />
		</Button>
	);
}
