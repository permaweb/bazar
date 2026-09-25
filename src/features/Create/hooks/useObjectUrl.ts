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

/** Blob URLs for a list of local files, all revoked together when the list changes or the component unmounts. */
export function useObjectUrls(files: File[]): string[] {
	const [urls, setUrls] = React.useState<string[]>([]);
	React.useEffect(() => {
		const next = files.map((file) => URL.createObjectURL(file));
		setUrls(next);
		return () => next.forEach((url) => URL.revokeObjectURL(url));
	}, [files]);
	return urls;
}
