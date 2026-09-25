import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import DialogHeading from 'components/molecules/DialogHeading/DialogHeading';

describe('DialogHeading', () => {
	it('renders the plain dialog title structure', () => {
		const markup = renderToStaticMarkup(
			<DialogHeading
				control={<button type="button">Close</button>}
				eyebrow="Profile"
				title="Edit profile"
				titleId="title"
			/>
		);

		expect(markup).toMatch(
			/^<div class="[^"]*\bdialog-heading\b[^"]*"><div><p class="[^"]*\beyebrow\b[^"]*">Profile<\/p>/
		);
		expect(markup).toContain('<h2 id="title">Edit profile</h2></div><button type="button">Close</button></div>');
	});

	it('renders the transaction dialog layout with and without artwork', () => {
		const withArtwork = renderToStaticMarkup(
			<DialogHeading
				artwork={<img alt="" src="logo.png" />}
				control={null}
				eyebrow="Buy"
				eyebrowId="operation"
				layout="asset"
				title="Token"
				titleId="title"
			/>
		);
		expect(withArtwork).toMatch(
			/^<div class="[^"]*\bdialog-heading\b[^"]*"><div class="[^"]*\bdialog-asset-heading\b[^"]*"><img alt="" src="logo.png"\/><div class="[^"]*\bdialog-asset-heading-copy\b[^"]*">/
		);
		expect(withArtwork).toMatch(/<p class="[^"]*\beyebrow\b[^"]*" id="operation">Buy<\/p>/);
		const withoutArtwork = renderToStaticMarkup(
			<DialogHeading control={null} layout="asset" title="Token" titleId="title" />
		);
		expect(withoutArtwork).toMatch(
			/^<div class="[^"]*\bdialog-heading\b[^"]*"><div><div class="[^"]*\bdialog-asset-heading-copy\b[^"]*"><h2 id="title">Token<\/h2><\/div><\/div><\/div>$/
		);
	});
});
