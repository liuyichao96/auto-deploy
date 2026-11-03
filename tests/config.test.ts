import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initProject, parseCommand, parseConfig } from '../packages/config/src/index.js';

describe('config', () => {
  it('merges defaults and parses yaml', () => { const config = parseConfig('project:\n  name: demo\npreview:\n  port: 4311\n'); expect(config.project.name).toBe('demo'); expect(config.preview.port).toBe(4311); expect(config.github.mergeStrategy).toBe('auto_after_human_approval'); });
  it('rejects invalid port and strategy', () => { expect(() => parseConfig('preview:\n  port: 0')).toThrow('preview.port'); expect(() => parseConfig('github:\n  mergeStrategy: unsafe')).toThrow('mergeStrategy'); });
  it('rejects dangerous shell commands', () => { expect(() => parseConfig('commands:\n  test: rm -rf .')).toThrow('危险命令'); });
  it('parses safe arguments without enabling shell operators', () => { expect(parseCommand('npm run test -- --watch')).toEqual({ executable: 'npm', args: ['run', 'test', '--', '--watch'] }); expect(() => parseCommand('npm test && curl example.com')).toThrow('shell 控制符'); });
  it('initializes a clean project with workflows', async () => { const root = await mkdtemp(path.join(os.tmpdir(), 'devflow-')); await initProject(root, { docker: true }); expect((await readFile(path.join(root, 'AGENTS.md'), 'utf8')).length).toBeGreaterThan(0); expect((await readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8')).includes('node-version: 22')).toBe(true); expect((await readFile(path.join(root, 'docker-compose.yml'), 'utf8')).includes('node:22')).toBe(true); });
});
