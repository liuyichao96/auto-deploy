import { describe, expect, it } from 'vitest';
import { autoMergeIfAllowed, canMerge, createAppJwt, verifyWebhookSignature } from '../packages/github/src/index.js';
import crypto from 'node:crypto';

describe('github policy', () => {
  it('requires human approval by default', () => { const base = { number: 1, url: '', headSha: 'x', ciPassed: true, aiBlocks: false, conversationsResolved: true, approvals: 0 }; expect(canMerge(base, 'auto_after_human_approval', 1)).toBe(false); expect(canMerge({ ...base, approvals: 1 }, 'auto_after_human_approval', 1)).toBe(true); });
  it('verifies webhook signature', () => { const body = '{}'; const secret = 'secret'; const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex'); expect(verifyWebhookSignature(body, sig, secret)).toBe(true); expect(verifyWebhookSignature(body, 'sha256=nope', secret)).toBe(false); });
  it('creates an app JWT without exposing the key', () => { const key = `-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK7uCj8rC2mRrYwVxZ1n0j7k6p4vM0w9d5f8m5vP1m0sJ2nH6p9k\n-----END RSA PRIVATE KEY-----`; expect(() => createAppJwt('1', key, 1700000000)).toThrow(); });
  it('enables auto-merge only after all policy checks pass', async () => {
    let enabled = false;
    const client = { getPullRequestState: async () => ({ number: 1, url: '', headSha: 'x', ciPassed: true, aiBlocks: false, approvals: 1, conversationsResolved: true }), enableAutoMerge: async () => { enabled = true; } };
    expect(await autoMergeIfAllowed(client, { owner: 'o', repo: 'r', number: 1 }, 'auto_after_human_approval', 1)).toBe(true);
    expect(enabled).toBe(true);
    enabled = false;
    const blocked = { ...client, getPullRequestState: async () => ({ number: 1, url: '', headSha: 'x', ciPassed: true, aiBlocks: false, approvals: 0, conversationsResolved: true }) };
    expect(await autoMergeIfAllowed(blocked, { owner: 'o', repo: 'r', number: 1 }, 'auto_after_human_approval', 1)).toBe(false);
    expect(enabled).toBe(false);
  });
});
