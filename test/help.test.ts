import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { main } from '../src/index';

describe('@help command', () => {
  let originalExit: typeof process.exit;
  let exitCode: number | null;
  let stdoutOutput: string[];

  beforeEach(() => {
    exitCode = null;
    stdoutOutput = [];
    originalExit = process.exit;
    process.exit = ((code?: number) => { exitCode = code ?? 0; throw new ExitSignal(); }) as typeof process.exit;
    console.log = (...args: unknown[]) => {
      stdoutOutput.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    process.exit = originalExit;
    console.log = globalThis.console.log;
  });

  it('outputs help info and exits with code 0', async () => {
    try {
      await main(['@help']);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    expect(exitCode).toBe(0);
    const output = stdoutOutput.join('\n');

    expect(output).toContain('Claude Model Switcher');
    expect(output).toContain('配置文件');
    expect(output).toContain('providers.json');
    expect(output).toContain('API Key');
    expect(output).toContain('ccs @zhipu');
    expect(output).toContain('ccs @list');
    expect(output).toContain('ccs @help');
  });

  it('does not require config file to exist', async () => {
    try {
      await main(['@help']);
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
    }

    expect(exitCode).toBe(0);
    expect(stdoutOutput.length).toBeGreaterThan(0);
  });
});

class ExitSignal extends Error {}
