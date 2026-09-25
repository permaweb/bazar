import React from 'react';

// Attributes for identifier fields such as wallet addresses and transaction IDs.
export const IDENTIFIER_INPUT_PROPS = {
	autoCapitalize: 'none',
	autoComplete: 'off',
	autoCorrect: 'off',
	spellCheck: false,
} as const satisfies React.InputHTMLAttributes<HTMLInputElement>;

// Text-like input primitive (text, search, number, url).
export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
	function TextInput(props, ref) {
		return <input {...props} ref={ref} />;
	}
);

export default TextInput;
