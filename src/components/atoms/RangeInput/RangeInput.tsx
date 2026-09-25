import React from 'react';

export const RangeInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
	function RangeInput(props, ref) {
		return <input {...props} ref={ref} type="range" />;
	}
);

export default RangeInput;
