import Fastify from 'fastify';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { verifyWebhookSignature } from '../../../packages/github/src/index.js';

export function createWebhookServer(options: { secret?: string; port?: number; auditFile?: string } = {}) {
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
    if (options.auditFile) {
      // Keep the audit trail outside the request body so untrusted PR content is
      // never copied into the operational log. The directory is created lazily
      // to keep local dry-runs free of filesystem side effects.
      await mkdir(path.dirname(options.auditFile), { recursive: true });
      await appendFile(options.auditFile, JSON.stringify({ at: new Date().toISOString(), event, deliveryId }) + '\n');
    }
    app.log.info({ event, deliveryId }, 'GitHub webhook accepted');
    return reply.code(202).send({ accepted: true, event, deliveryId });
  });
  return { app, deliveries };
}

if (process.argv[1]?.endsWith('index.ts')) {
  const port = Number(process.env.PORT ?? 8787);
  const { app } = createWebhookServer({
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    port,
    auditFile: process.env.GITHUB_AUDIT_FILE || undefined
  });
  app.listen({ host: '0.0.0.0', port }).catch(error => { app.log.error(error); process.exit(1); });
}
