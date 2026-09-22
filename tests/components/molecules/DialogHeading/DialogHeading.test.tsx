import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import DialogHeading from 'components/molecules/DialogHeading/DialogHeading';

describe('DialogHeading', () => {
	it('renders the plain dialog title structure', () => {
		expect(
			renderToStaticMarkup(
				<DialogHeading
					control={<button type="button">Close</button>}
					eyebrow="Profile"
					title="Edit profile"
					titleId="title"
				/>
			)
		).toBe(
			'<div class="dialog-heading"><div><p class="eyebrow">Profile</p><h2 id="title">Edit profile</h2></div><button type="button">Close</button></div>'
		);
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
		expect(withArtwork).toContain(
			'<div class="dialog-asset-heading"><img alt="" src="logo.png"/><div class="dialog-asset-heading-copy">'
		);
		expect(withArtwork).toContain('<p class="eyebrow" id="operation">Buy</p>');
		const withoutArtwork = renderToStaticMarkup(
			<DialogHeading control={null} layout="asset" title="Token" titleId="title" />
		);
		expect(withoutArtwork).toBe(
			'<div class="dialog-heading"><div><div class="dialog-asset-heading-copy"><h2 id="title">Token</h2></div></div></div>'
		);
	});
});
