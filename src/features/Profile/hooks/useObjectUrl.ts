import React from 'react';

/** A blob URL for a local file, revoked when the file changes or the component unmounts; empty without a file. */
export function useObjectUrl(file: File | null): string {
	const [url, setUrl] = React.useState('');
	React.useEffect(() => {
		if (!file) {
			setUrl('');
			return;
		}
		const next = URL.createObjectURL(file);
		setUrl(next);
		return () => URL.revokeObjectURL(next);
	}, [file]);
	return url;
}
