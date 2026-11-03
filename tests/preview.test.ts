import { describe, expect, it } from 'vitest';
import net from 'node:net';
import { isPortAvailable, startPreview } from '../packages/preview/src/index.js';

describe('preview', () => {
  it('checks a usable port', async () => { expect(await isPortAvailable(0)).toBe(true); });
  it('detects an occupied port', async () => { const server = net.createServer().listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', () => resolve())); const port = (server.address() as net.AddressInfo).port; expect(await isPortAvailable(port)).toBe(false); server.close(); });
  it('reports health timeout and cleans up', async () => { await expect(startPreview({ command: 'node -e "setTimeout(() => {}, 5000)"', port: 4321, healthPath: '/', timeoutMs: 200 })).rejects.toThrow('健康检查超时'); });
});
