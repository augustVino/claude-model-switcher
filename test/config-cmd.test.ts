import { describe, expect, it, beforeEach, afterEach, spyOn } from 'bun:test';
import { openConfig } from '../src/config-cmd';
import { setupTmpDir } from './helpers';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as childProcess from 'node:child_process';

class ExitCaptureError extends Error {
  constructor() { super('process.exit captured'); this.name = 'ExitCaptureError'; }
}

let tmpDir: string;
let capturedExitCode: number | null = null;
const envSnapshots: Record<string, string | undefined> = {};

beforeEach(async () => {
  tmpDir = await setupTmpDir();
  capturedExitCode = null;
  // @ts-expect-error
  spyOn(process, 'exit').mockImplementation((code?: number) => { capturedExitCode = code ?? 1; throw new ExitCaptureError(); });
  envSnapshots.EDITOR = process.env.EDITOR;
  delete process.env.EDITOR;
});

afterEach(() => {
  if (envSnapshots.EDITOR !== undefined) process.env.EDITOR = envSnapshots.EDITOR;
  else delete process.env.EDITOR;
});

function runOpenConfig(configPath: string): void {
  try {
    openConfig(configPath);
  } catch (e) {
    if (e instanceof ExitCaptureError) return;
    throw e;
  }
}

describe('openConfig', () => {
  it('spawns editor with config file path', () => {
    const configPath = join(tmpDir, 'claude-model-switcher', 'providers.json');
    mkdirSync(join(tmpDir, 'claude-model-switcher'), { recursive: true });
    writeFileSync(configPath, '[]');
    process.env.EDITOR = 'nano';

    let spawnedCmd = '';
    let spawnedArgs: string[] = [];
    const spawnSyncSpy = spyOn(
      childProcess,
      'spawnSync'
    ).mockImplementation((cmd: string, args: string[]) => {
      spawnedCmd = cmd;
      spawnedArgs = args;
      return { status: 0 };
    });

    runOpenConfig(configPath);

    expect(spawnedCmd).toBe('nano');
    expect(spawnedArgs).toEqual([configPath]);
    expect(capturedExitCode).toBe(0);

    spawnSyncSpy.mockRestore();
    delete process.env.EDITOR;
  });

  it('falls back to vim when EDITOR is not set', () => {
    const configPath = join(tmpDir, 'claude-model-switcher', 'providers.json');
    mkdirSync(join(tmpDir, 'claude-model-switcher'), { recursive: true });
    writeFileSync(configPath, '[]');

    let spawnedCmd = '';
    const spawnSyncSpy = spyOn(
      childProcess,
      'spawnSync'
    ).mockImplementation((cmd: string) => {
      spawnedCmd = cmd;
      return { status: 0 };
    });

    runOpenConfig(configPath);

    expect(spawnedCmd).toBe('vim');
    expect(capturedExitCode).toBe(0);

    spawnSyncSpy.mockRestore();
  });

  it('prints error and exits when config file does not exist', () => {
    const configPath = join(tmpDir, 'nonexistent', 'providers.json');
    const stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true as any);

    runOpenConfig(configPath);

    expect(capturedExitCode).toBe(1);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('ccs @init'));

    stderrSpy.mockRestore();
  });

  it('exits with editor error when spawnSync fails', () => {
    const configPath = join(tmpDir, 'claude-model-switcher', 'providers.json');
    mkdirSync(join(tmpDir, 'claude-model-switcher'), { recursive: true });
    writeFileSync(configPath, '[]');

    const spawnSyncSpy = spyOn(
      childProcess,
      'spawnSync'
    ).mockImplementation(() => ({
      status: null,
      error: new Error('spawn ENOENT'),
    }));
    const stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => true as any);

    runOpenConfig(configPath);

    expect(capturedExitCode).toBe(1);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to launch editor'));

    spawnSyncSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('propagates editor non-zero exit code', () => {
    const configPath = join(tmpDir, 'claude-model-switcher', 'providers.json');
    mkdirSync(join(tmpDir, 'claude-model-switcher'), { recursive: true });
    writeFileSync(configPath, '[]');

    const spawnSyncSpy = spyOn(
      childProcess,
      'spawnSync'
    ).mockImplementation(() => ({ status: 42 }));

    runOpenConfig(configPath);

    expect(capturedExitCode).toBe(42);

    spawnSyncSpy.mockRestore();
  });
});
