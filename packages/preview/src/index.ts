import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import { parseCommand } from '../../config/src/index.js';

export interface PreviewOptions { command: string; port: number; healthPath?: string; timeoutMs?: number; cwd?: string; env?: NodeJS.ProcessEnv; detached?: boolean; }
export interface PreviewSession { url: string; pid?: number; logs: string[]; stop(): Promise<void>; }

export function isPortAvailable(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise(resolve => { const server = net.createServer().once('error', () => resolve(false)).once('listening', () => server.close(() => resolve(true))).listen(port, host); });
}

export async function startPreview(options: PreviewOptions): Promise<PreviewSession> {
  if (!(await isPortAvailable(options.port))) throw new Error(`预览端口 ${options.port} 已被占用，请修改 devflow.yaml 或停止占用进程`);
  const parsed = parseCommand(options.command, 'preview.command');
  const executable = process.platform === 'win32' && ['npm', 'npx', 'pnpm', 'yarn'].includes(parsed.executable) ? `${parsed.executable}.cmd` : parsed.executable;
  const child = spawn(executable, parsed.args, { cwd: options.cwd, env: { ...process.env, ...options.env, PORT: String(options.port) }, shell: process.platform === 'win32' && executable.endsWith('.cmd'), detached: options.detached });
  const logs: string[] = [];
  child.stdout?.on('data', d => logs.push(String(d)));
  child.stderr?.on('data', d => logs.push(String(d)));
  if (options.detached) child.unref();
  const timeout = options.timeoutMs ?? 30000;
  const url = `http://127.0.0.1:${options.port}`;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`预览服务提前退出（exit code ${child.exitCode}）\n${logs.join('')}`);
    try { const response = await fetch(url + (options.healthPath ?? '/')); if (response.ok) return { url, pid: child.pid, logs, stop: () => stopProcess(child) }; } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 200));
  }
  await stopProcess(child);
  throw new Error(`预览服务健康检查超时（${timeout}ms）\n${logs.join('')}`);
}

export async function stopProcess(child: ChildProcess) { if (child.exitCode === null) child.kill('SIGTERM'); }
