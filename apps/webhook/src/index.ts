import Fastify from 'fastify';
import { appendFile } from 'node:fs/promises';
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
    if (options.auditFile) await appendFile(options.auditFile, JSON.stringify({ at: new Date().toISOString(), event, deliveryId }) + '\n').catch(() => undefined);
    app.log.info({ event, deliveryId }, 'GitHub webhook accepted');
    return reply.code(202).send({ accepted: true, event, deliveryId });
  });
  return { app, deliveries };
}

if (process.argv[1]?.endsWith('index.ts')) { const { app } = createWebhookServer({ secret: process.env.GITHUB_WEBHOOK_SECRET, port: Number(process.env.PORT ?? 8787) }); app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 8787) }).catch(error => { app.log.error(error); process.exit(1); }); }
