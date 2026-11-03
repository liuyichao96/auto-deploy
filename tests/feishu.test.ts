import { describe, expect, it } from 'vitest';
import { DryRunFeishuSender, sanitizeNotification } from '../packages/feishu/src/index.js';

describe('feishu', () => {
  it('redacts secrets and supports dry-run', async () => { const n = sanitizeNotification({ event: 'failed', project: 'demo', status: 'failed', summary: 'token ghp_123456' }); expect(n.summary).toContain('[REDACTED]'); const sender = new DryRunFeishuSender(); await sender.send(n); expect(sender.sent).toHaveLength(1); });
});
