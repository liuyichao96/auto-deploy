#!/usr/bin/env node
import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { initProject, loadConfig, parseCommand } from '../../../packages/config/src/index.js';
import { startPreview } from '../../../packages/preview/src/index.js';
import { createReviewProvider } from '../../../packages/review/src/index.js';

const program = new Command().name('devflow').description('面向非专业开发者的自动化开发助手').version('0.1.0');

program.command('init').description('初始化标准 Devflow 项目').option('--docker', '生成 docker-compose.yml').option('--devcontainer', '生成 devcontainer 配置').action(async options => { await initProject(process.cwd(), options); console.log('Devflow 项目已初始化：AGENTS.md、devflow.yaml、GitHub Actions 和 README 已生成。'); });

program.command('test').description('执行 install/lint/typecheck/test/build').action(async () => {
  const config = await loadConfig();
  const stages = Object.entries(config.commands).filter(([, command]) => Boolean(command)) as Array<[string, string]>;
  for (const [stage, command] of stages) {
    console.log(`\n▶ ${stage}: ${command}`);
    const result = await runCommand(command);
    if (result.code !== 0) { console.error(`✗ ${stage} 失败（退出码 ${result.code}）\n${result.output}`); console.error(`原因：${explainFailure(stage, result.output)}`); console.error('建议：先按上面的建议修复原始错误，再次执行 devflow test。'); process.exitCode = 1; return; }
    console.log(`✓ ${stage} 通过`);
  }
  console.log('\n所有检查通过。');
});

program.command('preview').description('启动本地开发预览').option('--detach', '启动后保持进程运行').action(async options => {
  const config = await loadConfig();
  const session = await startPreview({ ...config.preview, detached: Boolean(options.detach) });
  console.log(`预览已启动：${session.url}\nPID：${session.pid ?? 'unknown'}`);
  if (options.detach) { await mkdir(path.join(process.cwd(), '.devflow'), { recursive: true }); await writeFile(path.join(process.cwd(), '.devflow', 'preview.json'), JSON.stringify({ pid: session.pid, url: session.url })); console.log('后台预览状态已写入 .devflow/preview.json。'); }
  else { console.log('按 Ctrl+C 停止预览。'); await new Promise<void>(resolve => { const stop = async () => { await session.stop(); resolve(); }; process.once('SIGINT', stop); process.once('SIGTERM', stop); }); }
});

program.command('preview:stop').description('停止后台预览并清理状态').action(async () => { const statePath = path.join(process.cwd(), '.devflow', 'preview.json'); try { const state = JSON.parse(await readFile(statePath, 'utf8')) as { pid?: number }; if (state.pid) process.kill(state.pid); await rm(statePath, { force: true }); console.log('后台预览已停止。'); } catch (error) { console.error(`停止预览失败：${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; } });

program.command('review').description('运行结构化 AI Review（默认 dry-run）').option('--input <file>', '包含 title/body/diff/rules 的 JSON 文件').option('--output <file>', '将结构化结果写入 JSON 文件').action(async options => { const config = await loadConfig(); const input = options.input ? JSON.parse(await readFile(path.resolve(options.input), 'utf8')) : { title: process.env.PR_TITLE ?? '', body: process.env.PR_BODY ?? '', diff: process.env.PR_DIFF ?? '', rules: await readFile(path.join(process.cwd(), 'AGENTS.md'), 'utf8').catch(() => '') }; const result = await createReviewProvider(config.review).review(input); if (options.output) await writeFile(path.resolve(options.output), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2)); if (result.blocksMerge) process.exitCode = 2; });

async function runCommand(command: string): Promise<{ code: number; output: string }> {
  const { executable, args } = parseCommand(command);
  // npm is a .cmd shim on Windows and cannot be launched through a shell-free
  // spawn under its bare name.
  const resolvedExecutable = process.platform === 'win32' && ['npm', 'npx', 'pnpm', 'yarn'].includes(executable) ? `${executable}.cmd` : executable;
  return new Promise(resolve => {
    // Windows exposes npm/pnpm/yarn as .cmd shims. They require a shell to
    // launch, but the command was already parsed and rejected shell operators
    // by packages/config before reaching this point.
    const child = spawn(resolvedExecutable, args, { shell: process.platform === 'win32' && resolvedExecutable.endsWith('.cmd'), cwd: process.cwd(), env: process.env });
    let output = '';
    child.stdout?.on('data', d => { output += String(d); process.stdout.write(d); });
    child.stderr?.on('data', d => { output += String(d); process.stderr.write(d); });
    child.on('error', error => { output += `${error.message}\n`; resolve({ code: 1, output }); });
    child.on('close', code => resolve({ code: code ?? 1, output }));
  });
}

function explainFailure(stage: string, output: string): string {
  if (/EBADENGINE|required.*node.*22|current.*node.*20/i.test(output)) return '当前 Node.js 版本低于项目要求的 Node.js 22。请切换到 Node.js 22 后重试。';
  if (/EPERM.*unlink|operation not permitted/i.test(output)) return `${stage} 需要替换一个仍被其他进程占用的文件。请关闭正在运行的 Devflow/测试/编辑器进程，或重启终端后重试。`;
  if (/EADDRINUSE|已被占用|address already in use/i.test(output)) return '目标端口已被其他服务占用，请停止该服务或修改 devflow.yaml 中的端口。';
  if (/健康检查超时/i.test(output)) return '预览服务没有在超时时间内返回 2xx。请确认服务监听 PORT，并检查健康路径。';
  return `${stage} 命令未通过。原始错误已保留在上方输出中。`;
}

program.parseAsync().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
