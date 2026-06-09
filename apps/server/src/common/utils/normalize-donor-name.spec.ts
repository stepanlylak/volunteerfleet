import { describe, expect, it } from 'vitest';
import { normalizeDonorName } from './normalize-donor-name.js';

describe('normalizeDonorName', () => {
  it('trims, collapses Unicode whitespace, and lowercases deterministically', () => {
    expect(normalizeDonorName('\t ІВАН\u00a0\u00a0ПЕТРЕНКО \n')).toBe('іван петренко');
  });

  it('returns the same result for already normalized input', () => {
    const normalized = 'благодійний фонд';
    expect(normalizeDonorName(normalized)).toBe(normalized);
    expect(normalizeDonorName(normalizeDonorName(normalized))).toBe(normalized);
  });
});
