import { describe, expect, it } from 'vitest';
import { reviewBlocksMerge, validateReviewResult } from '../packages/review/src/index.js';

describe('review', () => {
  it('validates structured JSON and blocks P1', () => { const result = validateReviewResult({ summary: 'x', provider: 'test', blocksMerge: false, findings: [{ severity: 'P1', file: 'a.ts', line: 3, trigger: 'x', expected: 'y', actual: 'z', suggestion: 'fix' }] }); expect(reviewBlocksMerge(result)).toBe(true); });
  it('rejects malformed JSON shape', () => { expect(() => validateReviewResult({ summary: 'x', findings: [] })).toThrow('blocksMerge'); });
});
