import React from 'react';

export type ButtonSize = 'custom' | 'icon' | 'medium' | 'small';
export type ButtonVariant = 'danger' | 'ghost' | 'neutral' | 'primary';

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
      className={['ui-button', `ui-button--${size}`, `ui-button--${variant}`, className ?? '']
        .filter(Boolean)
        .join(' ')}
      ref={ref}
      type={type}
    />
  );
});
