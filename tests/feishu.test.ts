import { describe, expect, it } from 'vitest';
import { DryRunFeishuSender, FeishuWebhookSender, ProjectFeishuRouter, sanitizeNotification } from '../packages/feishu/src/index.js';

describe('feishu', () => {
  it('redacts secrets and supports dry-run', async () => { const n = sanitizeNotification({ event: 'failed', project: 'demo', status: 'failed', summary: 'token ghp_123456' }); expect(n.summary).toContain('[REDACTED]'); const sender = new DryRunFeishuSender(); await sender.send(n); expect(sender.sent).toHaveLength(1); });
  it('retries delivery and routes by project', async () => {
    let attempts = 0;
    const sender = new FeishuWebhookSender('https://feishu.invalid/hook', { retries: 2, sleepMs: 0, fetchImpl: async () => { attempts++; return new Response('{}', { status: attempts === 1 ? 500 : 200 }); } });
    const router = new ProjectFeishuRouter({ demo: sender });
    await router.send({ event: 'ci_completed', project: 'demo', status: 'success', summary: 'ok', previewUrl: 'http://127.0.0.1:3000' });
    expect(attempts).toBe(2);
  });
});
