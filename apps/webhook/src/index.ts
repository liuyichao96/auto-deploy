import Fastify from 'fastify';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { verifyWebhookSignature } from '../../../packages/github/src/index.js';
import { FeishuWebhookSender, ProjectFeishuRouter, type FeishuEvent, type FeishuSender, type Notification } from '../../../packages/feishu/src/index.js';

export interface WebhookServerOptions { secret?: string; port?: number; auditFile?: string; notifier?: FeishuSender; project?: string; }

export function createWebhookServer(options: WebhookServerOptions = {}) {
  const app = Fastify({ logger: true });
  const deliveries = new Set<string>();
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', { parseAs: 'string' }, (_request, body, done) => done(null, body));
  app.get('/healthz', async () => ({ ok: true }));
  app.post('/webhooks/github', async (request, reply) => {
    const raw = String(request.body ?? '');
    const deliveryId = String(request.headers['x-github-delivery'] ?? '');
    if (!options.secret || !verifyWebhookSignature(raw, String(request.headers['x-hub-signature-256'] ?? ''), options.secret)) return reply.code(401).send({ error: 'invalid signature' });
    if (deliveryId && deliveries.has(deliveryId)) return reply.code(200).send({ duplicate: true });
    if (deliveryId) deliveries.add(deliveryId);
    const event = String(request.headers['x-github-event'] ?? 'unknown');
    const payload = parsePayload(raw);
    if (options.auditFile) {
      // Keep the audit trail outside the request body so untrusted PR content is
      // never copied into the operational log. The directory is created lazily
      // to keep local dry-runs free of filesystem side effects.
      await mkdir(path.dirname(options.auditFile), { recursive: true });
      await appendFile(options.auditFile, JSON.stringify({ at: new Date().toISOString(), event, deliveryId, status: 'accepted' }) + '\n');
    }
    const notification = toNotification(event, payload, options.project ?? process.env.DEVFLOW_PROJECT ?? 'devflow');
    if (notification && options.notifier) {
      try { await options.notifier.send(notification); }
      catch (error) { app.log.error({ event, deliveryId, error: error instanceof Error ? error.message : String(error) }, 'Feishu notification failed'); }
    }
    app.log.info({ event, deliveryId }, 'GitHub webhook accepted');
    return reply.code(202).send({ accepted: true, event, deliveryId });
  });
  return { app, deliveries };
}

function parsePayload(raw: string): Record<string, unknown> {
  try { const value = JSON.parse(raw) as unknown; return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
  catch { return {}; }
}

function stringValue(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined; }

export function toNotification(event: string, payload: Record<string, unknown>, project: string): Notification | undefined {
  // CI, check and workflow lifecycle events are intentionally ignored. A
  // single pull request can produce several of those events, which creates
  // noisy duplicate Feishu cards. PR updates are the user-facing signal.
  if (event !== 'pull_request') return undefined;
  const action = stringValue(payload.action) ?? 'updated';
  const pr = payload.pull_request as Record<string, unknown> | undefined;
  if (!pr) return undefined;
  const title = stringValue(pr.title) ?? 'Pull request';
  const url = stringValue(pr.html_url);
  let notificationEvent: FeishuEvent = 'pr_updated';
  let status = action;
  if (action === 'opened') notificationEvent = 'pr_created';
  else if (action === 'closed' && pr.merged === true) { notificationEvent = 'merged'; status = 'merged'; }
  else if (action === 'closed') { notificationEvent = 'failed'; status = 'closed'; }
  return { event: notificationEvent, project, status, summary: `${title} · GitHub ${event} ${action}`, url };
}

if (process.argv[1]?.endsWith('index.ts')) {
  const port = Number(process.env.PORT ?? 8787);
  const notifier = createNotifierFromEnv();
  const { app } = createWebhookServer({
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    port,
    auditFile: process.env.GITHUB_AUDIT_FILE || undefined,
    notifier,
    project: process.env.DEVFLOW_PROJECT
  });
  app.listen({ host: '0.0.0.0', port }).catch(error => { app.log.error(error); process.exit(1); });
}

function createNotifierFromEnv(): FeishuSender | undefined {
  const options = { auditFile: process.env.FEISHU_AUDIT_FILE };
  if (process.env.FEISHU_WEBHOOK_URL) return new FeishuWebhookSender(process.env.FEISHU_WEBHOOK_URL, options);
  if (!process.env.FEISHU_PROJECT_GROUPS_JSON) return undefined;
  try {
    const groups = JSON.parse(process.env.FEISHU_PROJECT_GROUPS_JSON) as unknown;
    if (!groups || typeof groups !== 'object') return undefined;
    const senders: Record<string, FeishuSender> = {};
    for (const [project, url] of Object.entries(groups as Record<string, unknown>)) if (typeof url === 'string' && url.startsWith('https://')) senders[project] = new FeishuWebhookSender(url, options);
    return Object.keys(senders).length ? new ProjectFeishuRouter(senders) : undefined;
  } catch { return undefined; }
}
