import { describe, expect, test } from 'vitest';

import { evaluateBlankPageSnapshot } from '../../src/core/blank-page.js';

describe('evaluateBlankPageSnapshot', () => {
  test('does not mark a normal page as blank', () => {
    expect(
      evaluateBlankPageSnapshot({
        url: 'https://example.com',
        text: 'This page has enough visible content for a normal page.',
        visibleElementCount: 3,
        timestamp: '2026-05-21T00:00:00.000Z'
      })
    ).toMatchObject({
      isBlank: false,
      textLength: 55,
      visibleElementCount: 3
    });
  });

  test('marks a page with very little text and few visible elements as blank', () => {
    expect(
      evaluateBlankPageSnapshot({
        url: 'https://example.com/blank',
        text: '  empty  ',
        visibleElementCount: 1,
        timestamp: '2026-05-21T00:00:00.000Z'
      })
    ).toMatchObject({
      isBlank: true,
      textLength: 5,
      visibleElementCount: 1,
      url: 'https://example.com/blank'
    });
  });
});
