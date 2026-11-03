import Fastify from 'fastify';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { verifyWebhookSignature } from '../../../packages/github/src/index.js';
import { FeishuWebhookSender, type FeishuEvent, type FeishuSender, type Notification } from '../../../packages/feishu/src/index.js';

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
  if (event === 'ping') return undefined;
  const action = stringValue(payload.action) ?? stringValue((payload.workflow_run as Record<string, unknown> | undefined)?.conclusion) ?? 'updated';
  const pr = payload.pull_request as Record<string, unknown> | undefined;
  const run = (payload.workflow_run ?? payload.check_run) as Record<string, unknown> | undefined;
  const title = stringValue(pr?.title) ?? stringValue(run?.name) ?? event;
  const url = stringValue(pr?.html_url) ?? stringValue(run?.html_url) ?? stringValue(payload.html_url);
  let notificationEvent: FeishuEvent = 'ci_completed';
  let status = action;
  if (event === 'pull_request' && action === 'opened') notificationEvent = 'pr_created';
  else if (event === 'pull_request' && action === 'closed' && pr?.merged === true) { notificationEvent = 'merged'; status = 'merged'; }
  else if (event === 'pull_request' && action === 'closed') { notificationEvent = 'failed'; status = 'closed'; }
  else if ((event === 'check_run' || event === 'workflow_run') && ['failure', 'cancelled', 'timed_out', 'action_required'].includes(action)) notificationEvent = 'failed';
  else if (event === 'check_run' && stringValue(payload.check_suite ? (payload.check_suite as Record<string, unknown>).conclusion : undefined) === 'failure') notificationEvent = 'failed';
  return { event: notificationEvent, project, status, summary: `${title} · GitHub ${event} ${action}`, url };
}

if (process.argv[1]?.endsWith('index.ts')) {
  const port = Number(process.env.PORT ?? 8787);
  const notifier = process.env.FEISHU_WEBHOOK_URL
    ? new FeishuWebhookSender(process.env.FEISHU_WEBHOOK_URL, { auditFile: process.env.FEISHU_AUDIT_FILE })
    : undefined;
  const { app } = createWebhookServer({
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    port,
    auditFile: process.env.GITHUB_AUDIT_FILE || undefined,
    notifier,
    project: process.env.DEVFLOW_PROJECT
  });
  app.listen({ host: '0.0.0.0', port }).catch(error => { app.log.error(error); process.exit(1); });
}
