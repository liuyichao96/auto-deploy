export type FeishuEvent = 'pr_created' | 'ci_completed' | 'review_completed' | 'merged' | 'failed';
export interface Notification { event: FeishuEvent; project: string; status: string; summary: string; url?: string; previewUrl?: string; }
export interface FeishuSender { send(notification: Notification): Promise<void>; }

export function sanitizeNotification(notification: Notification): Notification { return { ...notification, summary: notification.summary.replaceAll(/(ghp_|sk-|xoxb-)[A-Za-z0-9_\-]+/g, '[REDACTED]').slice(0, 2000) }; }

export class FeishuWebhookSender implements FeishuSender {
  constructor(private readonly webhookUrl: string, private readonly retries = 3, private readonly sleepMs = 200) {}
  async send(notification: Notification) { const body = { msg_type: 'interactive', card: { header: { title: { tag: 'plain_text', content: `Devflow · ${notification.event}` } }, elements: [{ tag: 'div', text: { tag: 'lark_md', content: `**${notification.project}**\n状态：${notification.status}\n${sanitizeNotification(notification).summary}` } }, ...(notification.url ? [{ tag: 'action', actions: [{ tag: 'button', text: { tag: 'plain_text', content: '打开链接' }, url: notification.url, type: 'default' }] }] : [])] } }; let last: unknown; for (let i = 0; i < this.retries; i++) { try { const response = await fetch(this.webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (response.ok) return; last = new Error(`Feishu HTTP ${response.status}`); } catch (error) { last = error; } await new Promise(r => setTimeout(r, this.sleepMs * 2 ** i)); } throw last instanceof Error ? last : new Error('Feishu notification failed'); }
}

export class DryRunFeishuSender implements FeishuSender { public readonly sent: Notification[] = []; async send(notification: Notification) { this.sent.push(sanitizeNotification(notification)); } }
