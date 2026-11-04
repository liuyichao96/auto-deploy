import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export type FeishuEvent = 'pr_created' | 'pr_updated' | 'ci_completed' | 'review_completed' | 'merged' | 'failed';
export interface Notification { event: FeishuEvent; project: string; status: string; summary: string; url?: string; previewUrl?: string; }
export interface FeishuSender { send(notification: Notification): Promise<void>; }

const secretPatterns = [
  /(?:ghp_|github_pat_|sk-|xox[baprs]-)[A-Za-z0-9_\-]+/gi,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/gi,
  /(?:token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi
];

export function sanitizeNotification(notification: Notification): Notification {
  let summary = notification.summary;
  for (const pattern of secretPatterns) summary = summary.replaceAll(pattern, '[REDACTED]');
  return { ...notification, summary: summary.slice(0, 2000), url: notification.url?.slice(0, 2000), previewUrl: notification.previewUrl?.slice(0, 2000) };
}

export interface FeishuSenderOptions { retries?: number; sleepMs?: number; auditFile?: string; fetchImpl?: typeof fetch; }

async function appendAudit(auditFile: string | undefined, entry: Record<string, unknown>): Promise<void> {
  if (!auditFile) return;
  try {
    await mkdir(path.dirname(auditFile), { recursive: true });
    await appendFile(auditFile, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
  } catch {
    // Audit volume failures must not hide the delivery result.
  }
}

export class FeishuWebhookSender implements FeishuSender {
  private readonly retries: number;
  private readonly sleepMs: number;
  private readonly auditFile?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly webhookUrl: string, retriesOrOptions: number | FeishuSenderOptions = 3, sleepMs = 200) {
    const options = typeof retriesOrOptions === 'number' ? { retries: retriesOrOptions, sleepMs } : retriesOrOptions;
    this.retries = Math.max(1, options.retries ?? 3);
    this.sleepMs = Math.max(0, options.sleepMs ?? 200);
    this.auditFile = options.auditFile;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(notification: Notification): Promise<void> {
    const safe = sanitizeNotification(notification);
    const body = {
      msg_type: 'interactive',
      card: {
        header: { title: { tag: 'plain_text', content: `Devflow · ${safe.event}` } },
        elements: [
          { tag: 'div', text: { tag: 'lark_md', content: `**${safe.project}**\n状态：${safe.status}\n${safe.summary}` } },
          ...(safe.url || safe.previewUrl ? [{
            tag: 'action',
            actions: [
              ...(safe.url ? [{ tag: 'button', text: { tag: 'plain_text', content: '打开链接' }, url: safe.url, type: 'default' }] : []),
              ...(safe.previewUrl ? [{ tag: 'button', text: { tag: 'plain_text', content: '打开预览' }, url: safe.previewUrl, type: 'default' }] : [])
            ]
          }] : [])
        ]
      }
    };

    let last: unknown;
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const response = await this.fetchImpl(this.webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        if (response.ok) { await appendAudit(this.auditFile, { event: safe.event, project: safe.project, status: 'sent', attempt }); return; }
        last = new Error(`Feishu HTTP ${response.status}`);
      } catch (error) { last = error; }
      if (attempt < this.retries) await new Promise(resolve => setTimeout(resolve, this.sleepMs * 2 ** (attempt - 1)));
    }
    await appendAudit(this.auditFile, { event: safe.event, project: safe.project, status: 'failed', attempts: this.retries });
    throw last instanceof Error ? last : new Error('Feishu notification failed');
  }
}

export class ProjectFeishuRouter implements FeishuSender {
  constructor(private readonly projectGroups: Record<string, FeishuSender>, private readonly fallback?: FeishuSender) {}
  async send(notification: Notification): Promise<void> {
    const sender = this.projectGroups[notification.project] ?? this.fallback;
    if (!sender) throw new Error(`项目 ${notification.project} 未配置飞书群映射`);
    await sender.send(notification);
  }
}

export class DryRunFeishuSender implements FeishuSender { public readonly sent: Notification[] = []; async send(notification: Notification) { this.sent.push(sanitizeNotification(notification)); } }
