import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('composes shared size and variant classes with native button props', () => {
    const markup = renderToStaticMarkup(
      <Button aria-current="page" className="extra" size="small" variant="primary">
        Current
      </Button>,
    );

    expect(markup).toContain('ui-button ui-button--small ui-button--primary primary extra');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('type="button"');
  });
});
