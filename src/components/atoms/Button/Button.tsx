import React from 'react';

import { omitProps } from 'helpers/props';

export type ButtonSize = 'custom' | 'icon' | 'medium' | 'small';
export type ButtonVariant = 'danger' | 'ghost' | 'neutral' | 'primary';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	size?: ButtonSize;
	variant?: ButtonVariant;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
	return (
		<button
			{...omitProps(props, ['className', 'size', 'type', 'variant'])}
			className={[
				'ui-button',
				`ui-button--${props.size ?? 'medium'}`,
				`ui-button--${props.variant ?? 'neutral'}`,
				props.className ?? '',
			]
				.filter(Boolean)
				.join(' ')}
			ref={ref}
			type={props.type ?? 'button'}
		/>
	);
});

export default Button;
