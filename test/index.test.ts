import { describe, expect, it, beforeEach, afterEach, spyOn } from 'bun:test';
import { main } from '../src/index';
import { readFileSync } from 'node:fs';

/** Sentinel error thrown by the process.exit mock to halt execution. */
class ExitCaptureError extends Error {
  constructor() { super('process.exit captured'); this.name = 'ExitCaptureError'; }
}

async function runMain(argv: string[], spawnFn?: Parameters<typeof main>[1]): Promise<void> {
  try {
    await main(argv, spawnFn);
  } catch (e) {
    if (e instanceof ExitCaptureError) return; // expected — process.exit was called
    throw e; // re-throw unexpected errors
  }
}
import { setupTmpDir, writeConfig, getTmpDir } from './helpers';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';

const envSnapshots: Record<string, string | undefined> = {};
let capturedExitCode: number | null = null;

beforeEach(async () => {
  await setupTmpDir();
  capturedExitCode = null;
  // @ts-expect-error — process.exit returns never, we need to intercept it
  spyOn(process, 'exit').mockImplementation((code?: number) => { capturedExitCode = code ?? 1; throw new ExitCaptureError(); });

  const keys = [
    'XDG_CONFIG_HOME',
    'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_MODEL', 'ANTHROPIC_SMALL_FAST_MODEL', 'ANTHROPIC_REASONING_MODEL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'TEST_KEY', 'LP_KEY'
  ];
  for (const k of keys) {
    envSnapshots[k] = process.env[k];
    delete process.env[k];
  }
  process.env.XDG_CONFIG_HOME = getTmpDir();
});

afterEach(() => {
  for (const [k, v] of Object.entries(envSnapshots)) {
    if (v !== undefined) process.env[k] = v;
    else delete process.env[k];
  }
});

/** Create a mock spawn that emits 'close' with the given exit code. */
function mockSpawnClose(code: number = 0) {
  let lastCmd = '';
  let lastArgs: string[] = [];
  let lastOpts: Record<string, unknown> = {};

  const mockFn = function (cmd: string, args?: string[], opts?: Record<string, unknown>): ChildProcess {
    lastCmd = cmd;
    lastArgs = args ?? [];
    lastOpts = opts ?? {};
    return {
      on(event: string, cb: Function) {
        if (event === 'close') cb(code);
        return this;
      },
    } as unknown as ChildProcess;
  };

  // Attach inspection helpers
  (mockFn as any).__lastCall = () => ({ cmd: lastCmd, args: lastArgs, opts: lastOpts });
  return mockFn;
}

describe('main', () => {
  it('sets ANTHROPIC env vars and spawns claude for @provider', async () => {
    await writeConfig(JSON.stringify([{
      name: 'zhipu', base_url: 'https://z.ai/api', api_key_env: 'TEST_KEY', default_model: 'glm-4'
    }]));
    process.env.TEST_KEY = 'secret-key';

    const mockFn = mockSpawnClose(0);
    await runMain(['@zhipu'], mockFn);

    expect((mockFn as any).__lastCall().cmd).toBe('claude');
    expect((mockFn as any).__lastCall().args).toEqual([]);
    expect((mockFn as any).__lastCall().opts).toEqual(expect.objectContaining({ stdio: 'inherit' }));
    expect(process.env.ANTHROPIC_BASE_URL).toBe('https://z.ai/api');
    expect(process.env.ANTHROPIC_AUTH_TOKEN).toBe('secret-key');
    expect(process.env.ANTHROPIC_MODEL).toBe('glm-4');
    expect(process.env.ANTHROPIC_SMALL_FAST_MODEL).toBe('glm-4');
  });

  it('passes rest args to spawn', async () => {
    await writeConfig(JSON.stringify([{
      name: 'zhipu', base_url: 'https://z.ai/api', api_key_env: 'TEST_KEY', default_model: 'glm-4'
    }]));
    process.env.TEST_KEY = 'k';

    const mockFn = mockSpawnClose(0);
    await runMain(['@zhipu', '-p', 'hello'], mockFn);

    expect((mockFn as any).__lastCall().args).toEqual(['-p', 'hello']);
  });

  it('calls listProviders for @list and exits with code 0 without spawning', async () => {
    await writeConfig(JSON.stringify([{
      name: 'zhipu', base_url: 'https://z.ai/api', api_key_env: 'TEST_KEY', default_model: 'glm-4'
    }]));

    let spawned = false;
    const noSpawnMock = function (): ChildProcess { spawned = true; return { on() { return this; } } as unknown as ChildProcess; };
    await runMain(['@list'], noSpawnMock);

    expect(spawned).toBe(false);
    expect(capturedExitCode).toBe(0);
  });

  it('warns about --model flag conflict when API key is set', async () => {
    await writeConfig(JSON.stringify([{
      name: 'zhipu', base_url: 'https://z.ai/api', api_key_env: 'TEST_KEY', default_model: 'glm-4'
    }]));
    process.env.TEST_KEY = 'k';

    const mockFn = mockSpawnClose(0);
    const warnSpy = spyOn(process.stderr, 'write').mockImplementation(() => true as any);

    await runMain(['@zhipu', '--model', 'sonnet'], mockFn);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('--model flag conflicts')
    );

    warnSpy.mockRestore();
  });

  it('warns about --model flag even when API key is missing (exits with 1)', async () => {
    await writeConfig(JSON.stringify([{
      name: 'zhipu', base_url: 'https://z.ai/api', api_key_env: 'MISSING_KEY', default_model: 'glm-4'
    }]));

    const warnSpy = spyOn(process.stderr, 'write').mockImplementation(() => true as any);

    await runMain(['@zhipu', '--model', 'sonnet']);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('--model flag conflicts')
    );
    expect(capturedExitCode).toBe(1);

    warnSpy.mockRestore();
  });

  it('deletes ANTHROPIC_API_KEY before setting new values', async () => {
    await writeConfig(JSON.stringify([{
      name: 'zhipu', base_url: 'https://z.ai/api', api_key_env: 'TEST_KEY', default_model: 'glm-4'
    }]));
    process.env.TEST_KEY = 'k';
    process.env.ANTHROPIC_API_KEY = 'old-key';

    const mockFn = mockSpawnClose(0);
    await runMain(['@zhipu'], mockFn);

    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('calls process.exit with error code on launch failure', async () => {
    await writeConfig(JSON.stringify([{
      name: 'zhipu', base_url: 'https://z.ai/api', api_key_env: 'TEST_KEY', default_model: 'glm-4'
    }]));
    process.env.TEST_KEY = 'k';

    let errorCbCalled = false;
    const errorMock = function (): ChildProcess {
      return {
        on(event: string, cb: Function) {
          if (event === 'error') {
            errorCbCalled = true; // Set before callback — callback will throw ExitCaptureError
            cb(new Error('launch failed'));
          }
          return this;
        },
      } as unknown as ChildProcess;
    };

    await runMain(['@zhipu'], errorMock);

    expect(errorCbCalled).toBe(true);
    expect(capturedExitCode).toBe(1);
  });

  it('propagates child process non-zero exit code', async () => {
    await writeConfig(JSON.stringify([{
      name: 'zhipu', base_url: 'https://z.ai/api', api_key_env: 'TEST_KEY', default_model: 'glm-4'
    }]));
    process.env.TEST_KEY = 'k';

    const mockFn = mockSpawnClose(42);
    await runMain(['@zhipu'], mockFn);

    expect(capturedExitCode).toBe(42);
  });

  it('exits with code 1 when config file not found', async () => {
    // Override XDG_CONFIG_HOME to an empty dir (no providers.json inside)
    const emptyDir = join(getTmpDir(), 'empty-config');
    const { mkdir: mk } = await import('node:fs/promises');
    await mk(emptyDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = emptyDir;

    await runMain(['@zhipu']);

    expect(capturedExitCode).toBe(1);
  });

  it('calls initConfig for @init and exits with code 0 without spawning', async () => {
    // Use empty XDG_CONFIG_HOME — no config file exists
    const emptyDir = join(getTmpDir(), 'empty-init');
    const { mkdir: mk } = await import('node:fs/promises');
    await mk(emptyDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = emptyDir;

    let spawned = false;
    const noSpawnMock = function (): ChildProcess { spawned = true; return { on() { return this; } } as unknown as ChildProcess; };
    await runMain(['@init'], noSpawnMock);

    expect(spawned).toBe(false);
    expect(capturedExitCode).toBe(0);

    // Verify the config file was actually created
    const configPath = join(emptyDir, 'claude-model-switcher', 'providers.json');
    const { existsSync } = await import('node:fs');
    expect(existsSync(configPath)).toBe(true);
  });

  it('calls npm install for @update without requiring config file', async () => {
    // @update 不依赖配置文件，使用空的 XDG_CONFIG_HOME
    const emptyDir = join(getTmpDir(), 'empty-update');
    const { mkdir: mk } = await import('node:fs/promises');
    await mk(emptyDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = emptyDir;

    let lastCmd = '';
    let lastArgs: string[] = [];
    const trackedMock = function (cmd: string, args?: string[], opts?: Record<string, unknown>): ChildProcess {
      lastCmd = cmd;
      lastArgs = args ?? [];
      return {
        on(event: string, cb: Function) {
          if (event === 'close') cb(0);
          return this;
        },
      } as unknown as ChildProcess;
    };

    await runMain(['@update'], trackedMock);

    expect(['npm', 'bun']).toContain(lastCmd);
    expect(lastArgs[0]).toBe('install');
    expect(lastArgs[1]).toBe('-g');
    expect(lastArgs[2]).toContain('@vinoorg/claude-model-switcher@latest');
  });

  it('skips install when already at latest version for @update', async () => {
    const { writeFileSync: wf, mkdirSync: ms } = await import('node:fs');
    const emptyDir = join(getTmpDir(), 'empty-update-latest');
    ms(emptyDir, { recursive: true });
    process.env.XDG_CONFIG_HOME = emptyDir;
    const cacheDir = join(emptyDir, 'claude-model-switcher');
    ms(cacheDir, { recursive: true });
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
    wf(join(cacheDir, '.update-cache.json'), JSON.stringify({ lastCheck: Date.now(), latestVersion: pkg.version }));

    let spawned = false;
    const noSpawnMock = function (): ChildProcess { spawned = true; return { on() { return this; } } as unknown as ChildProcess; };
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});

    await runMain(['@update'], noSpawnMock);

    expect(spawned).toBe(false);
    expect(capturedExitCode).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('已是最新版本'));

    logSpy.mockRestore();
  });
});
