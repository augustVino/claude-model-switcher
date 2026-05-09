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
let exitSpy: ReturnType<typeof spyOn>;
let stdoutSpy: ReturnType<typeof spyOn>;
let stderrSpy: ReturnType<typeof spyOn>;

beforeEach(async () => {
  capturedExitCode = null;
  tmpDir = await mkdtemp(join(tmpdir(), 'cms-init-test-'));
  exitSpy = spyOn(process, 'exit').mockImplementation((code?: number) => { capturedExitCode = code ?? 1; throw new ExitCaptureError(); });
});

afterEach(() => {
  exitSpy.mockRestore();
  stdoutSpy?.mockRestore();
  stderrSpy?.mockRestore();
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
    stdoutSpy = spyOn(process.stdout, 'write').mockImplementation((msg: string) => { stdoutMsg += msg; return true; });

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

  it('exits 0 with success message when config already exists and valid', async () => {
    const configDir = join(tmpDir, 'claude-model-switcher');
    mkdirSync(configDir, { recursive: true });
    const configPath = join(configDir, 'providers.json');
    writeFileSync(configPath, JSON.stringify([{
      name: 'test-provider',
      base_url: 'https://test.example.com/api',
      api_key_env: 'TEST_KEY',
    }]), 'utf8');

    let stdoutMsg = '';
    stdoutSpy = spyOn(process.stdout, 'write').mockImplementation((msg: string) => { stdoutMsg += msg; return true; });

    await runInit(configPath);

    expect(stdoutMsg).toContain('Config file already exists');
    expect(stdoutMsg).toContain(configPath);
    expect(capturedExitCode).toBe(0);
  });

  it('exits 1 with error when config exists but is invalid', async () => {
    const configDir = join(tmpDir, 'claude-model-switcher');
    mkdirSync(configDir, { recursive: true });
    const configPath = join(configDir, 'providers.json');
    writeFileSync(configPath, 'not valid json', 'utf8');

    let stderrMsg = '';
    stderrSpy = spyOn(process.stderr, 'write').mockImplementation((msg: string) => { stderrMsg += msg; return true; });

    await runInit(configPath);

    expect(stderrMsg).toContain('✗');
    expect(stderrMsg).toContain('invalid');
    expect(capturedExitCode).toBe(1);
  });

  it('includes agent_cli field in template', async () => {
    const configPath = join(tmpDir, 'claude-model-switcher', 'providers.json');
    stdoutSpy = spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runInit(configPath);

    const content = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(content[0]).toHaveProperty('agent_cli');
    expect(content[0].agent_cli).toBe('cc');
  });
});
