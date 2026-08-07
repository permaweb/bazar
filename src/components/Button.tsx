import React from 'react';

export type ButtonSize = 'custom' | 'medium' | 'small';
export type ButtonVariant = 'neutral' | 'primary';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, size = 'medium', type = 'button', variant = 'neutral', ...props },
  ref,
) {
  return (
    <button
      {...props}
      className={[
        'ui-button',
        `ui-button--${size}`,
        `ui-button--${variant}`,
        variant === 'primary' ? 'primary' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      ref={ref}
      type={type}
    />
  );
});
