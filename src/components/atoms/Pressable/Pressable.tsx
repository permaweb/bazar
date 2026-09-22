import React from 'react';

// Unstyled button primitive for custom controls whose presentation comes from their own classes.
// Use Button for standard actions; use Pressable when a control needs a bespoke visual treatment.
export const Pressable = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
	function Pressable(props, ref) {
		return <button {...props} ref={ref} type={props.type ?? 'button'} />;
	}
);

export default Pressable;
