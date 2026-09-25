import React from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';

// Renders `element` into a detached document container and returns axe violations for it.
// Requires the jsdom test environment (`// @vitest-environment jsdom`).
export async function axeViolations(element: React.ReactElement) {
	const container = document.createElement('main');
	document.body.append(container);
	const root = createRoot(container);
	await React.act(async () => root.render(element));
	const results = await axe.run(container, {
		rules: {
			// jsdom cannot compute layout or colors; contrast is verified in a real browser.
			'color-contrast': { enabled: false },
			region: { enabled: false },
		},
	});
	React.act(() => root.unmount());
	container.remove();
	return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}
