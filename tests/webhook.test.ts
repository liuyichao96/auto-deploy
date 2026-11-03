import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { createWebhookServer } from '../apps/webhook/src/index.js';

describe('webhook', () => {
  it('rejects bad signatures and deduplicates delivery ids', async () => {
    const { app } = createWebhookServer({ secret: 'secret' });
    await app.ready();
    const body = '{}';
    const signature = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
    const headers = { 'x-hub-signature-256': signature, 'x-github-delivery': 'delivery-1', 'x-github-event': 'pull_request', 'content-type': 'application/json' };
    expect((await app.inject({ method: 'POST', url: '/webhooks/github', payload: body, headers: { ...headers, 'x-hub-signature-256': 'sha256=bad' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/webhooks/github', payload: body, headers })).statusCode).toBe(202);
    expect((await app.inject({ method: 'POST', url: '/webhooks/github', payload: body, headers })).json()).toMatchObject({ duplicate: true });
    await app.close();
  });
});
