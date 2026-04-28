import { describe, expect, it, beforeEach, afterEach, spyOn } from 'bun:test';
import { initConfig } from '../src/init';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

class ExitCaptureError extends Error {
  constructor() { super('process.exit captured'); this.name = 'ExitCaptureError'; }
}

let capturedExitCode: number | null = null;
let tmpDir: string;

beforeEach(async () => {
  capturedExitCode = null;
  tmpDir = await mkdtemp(join(tmpdir(), 'cms-init-test-'));
  // @ts-expect-error
  spyOn(process, 'exit').mockImplementation((code?: number) => { capturedExitCode = code ?? 1; throw new ExitCaptureError(); });
});

async function runInit(configPath: string): Promise<void> {
  try {
    await initConfig(configPath);
  } catch (e) {
    if (e instanceof ExitCaptureError) return;
    throw e;
  }
}

describe('initConfig', () => {
  it('creates directory and writes template when config does not exist', async () => {
    const configPath = join(tmpDir, 'claude-model-switcher', 'providers.json');

    let stdoutMsg = '';
    spyOn(process.stdout, 'write').mockImplementation((msg: string) => { stdoutMsg += msg; return true; });

    await runInit(configPath);

    expect(existsSync(configPath)).toBe(true);
    expect(existsSync(join(tmpDir, 'claude-model-switcher'))).toBe(true);
    const content = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(Array.isArray(content)).toBe(true);
    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({
      name: 'example-provider',
      base_url: 'https://your-api-endpoint/anthropic',
      api_key_env: 'EXAMPLE_API_KEY',
      default_model: 'model-name',
    });
    expect(capturedExitCode).toBe(0);
    expect(stdoutMsg).toContain('Config initialized');
    expect(stdoutMsg).toContain(configPath);
  });
});
