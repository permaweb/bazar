import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import FileInput from 'components/atoms/FileInput/FileInput';
import RangeInput from 'components/atoms/RangeInput/RangeInput';
import TextArea from 'components/atoms/TextArea/TextArea';
import TextInput, { IDENTIFIER_INPUT_PROPS } from 'components/atoms/TextInput/TextInput';

describe('input primitives', () => {
	it('applies identifier attributes that disable autocorrection', () => {
		expect(renderToStaticMarkup(<TextInput {...IDENTIFIER_INPUT_PROPS} aria-label="Recipient" />)).toBe(
			'<input autoCapitalize="none" autoComplete="off" autoCorrect="off" spellcheck="false" aria-label="Recipient"/>'
		);
	});

	it('renders file, range, and multiline inputs with their native types', () => {
		expect(renderToStaticMarkup(<FileInput accept="image/png" aria-label="Logo" />)).toContain('type="file"');
		expect(renderToStaticMarkup(<RangeInput aria-label="Seek" max={10} />)).toContain('type="range"');
		expect(renderToStaticMarkup(<TextArea aria-label="Description" rows={3} />)).toBe(
			'<textarea aria-label="Description" rows="3"></textarea>'
		);
	});
});
