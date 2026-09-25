import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import Pressable from 'components/atoms/Pressable/Pressable';

describe('Pressable', () => {
	it('defaults to a non-submitting button and forwards attributes', () => {
		const markup = renderToStaticMarkup(
			<Pressable aria-pressed className="chip">
				Range
			</Pressable>
		);
		expect(markup).toBe('<button aria-pressed="true" class="chip" type="button">Range</button>');
		expect(renderToStaticMarkup(<Pressable type="submit">Go</Pressable>)).toContain('type="submit"');
	});
});
