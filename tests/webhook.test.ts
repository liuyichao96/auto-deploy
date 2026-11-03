import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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

  it('writes a minimal audit record without persisting the payload', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'devflow-webhook-'));
    const auditFile = path.join(root, '.devflow', 'webhook-audit.jsonl');
    const { app } = createWebhookServer({ secret: 'secret', auditFile });
    await app.ready();
    const body = JSON.stringify({ pull_request: { title: 'do not log this' } });
    const signature = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/github',
      payload: body,
      headers: { 'x-hub-signature-256': signature, 'x-github-delivery': 'audit-1', 'x-github-event': 'pull_request', 'content-type': 'application/json' }
    });
    expect(response.statusCode).toBe(202);
    const record = await readFile(auditFile, 'utf8');
    expect(record).toContain('audit-1');
    expect(record).toContain('pull_request');
    expect(record).not.toContain('do not log this');
    await app.close();
    await rm(root, { recursive: true, force: true });
  });
});
