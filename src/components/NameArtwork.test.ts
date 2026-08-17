import { describe, expect, it } from 'vitest';

import { nameArtworkFontScale } from './NameArtwork';

describe('name artwork sizing', () => {
	it('reduces the font scale as names get longer', () => {
		expect(nameArtworkFontScale('R')).toBe(28);
		expect(nameArtworkFontScale('rule34')).toBe(20);
		expect(nameArtworkFontScale('blockdata')).toBeCloseTo(13.33, 2);
		expect(nameArtworkFontScale('123456789012345')).toBe(8);
	});

	it('keeps extreme names within readable bounds', () => {
		expect(nameArtworkFontScale('')).toBe(28);
		expect(nameArtworkFontScale('a'.repeat(100))).toBe(6.5);
	});
});
