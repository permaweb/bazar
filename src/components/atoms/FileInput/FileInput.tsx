import React from 'react';

// File picker primitive. Callers usually hide it and open it from a visible Button or drop zone.
export const FileInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
	function FileInput(props, ref) {
		return <input {...props} ref={ref} type="file" />;
	}
);

export default FileInput;
