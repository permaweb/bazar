import React from 'react';

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
	function TextArea(props, ref) {
		return <textarea {...props} ref={ref} />;
	}
);

export default TextArea;
