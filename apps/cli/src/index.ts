#!/usr/bin/env node
import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { initProject, loadConfig } from '../../../packages/config/src/index.js';
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
    if (result.code !== 0) { console.error(`✗ ${stage} 失败（退出码 ${result.code}）\n${result.output}`); console.error(`原因：${stage} 命令未通过。建议：在本地运行上面的命令，先修复原始错误后再次执行 devflow test。`); process.exitCode = 1; return; }
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

program.command('review').description('运行结构化 AI Review（默认 dry-run）').option('--input <file>', '包含 title/body/diff/rules 的 JSON 文件').action(async options => { const config = await loadConfig(); const input = options.input ? JSON.parse(await readFile(path.resolve(options.input), 'utf8')) : { title: process.env.PR_TITLE ?? '', body: process.env.PR_BODY ?? '', diff: process.env.PR_DIFF ?? '', rules: await readFile(path.join(process.cwd(), 'AGENTS.md'), 'utf8').catch(() => '') }; const result = await createReviewProvider(config.review).review(input); console.log(JSON.stringify(result, null, 2)); if (result.blocksMerge) process.exitCode = 2; });

async function runCommand(command: string): Promise<{ code: number; output: string }> { return new Promise(resolve => { const child = spawn(command, { shell: true, cwd: process.cwd(), env: process.env }); let output = ''; child.stdout?.on('data', d => { output += String(d); process.stdout.write(d); }); child.stderr?.on('data', d => { output += String(d); process.stderr.write(d); }); child.on('close', code => resolve({ code: code ?? 1, output })); }); }

program.parseAsync().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
