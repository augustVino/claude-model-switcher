import { describe, expect, it, beforeEach, spyOn } from 'bun:test';
import { setupTmpDir } from './helpers';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { viewTrace } from '../src/trace-viewer';
import * as editor from '../src/editor';

let tmpDir: string;
beforeEach(async () => { tmpDir = await setupTmpDir(); });

class ExitSignal extends Error { constructor() { super('exit'); this.name = 'ExitSignal'; } }
const noopExit = (() => { throw new ExitSignal(); }) as unknown as (code?: number) => never;

async function seedSessions(ids: string[]) {
  const dir = join(tmpDir, 'traces');
  await mkdir(dir, { recursive: true });
  for (const id of ids) await writeFile(join(dir, `${id}.jsonl`), '');
  return dir;
}

describe('viewTrace', () => {
  it('opens traces dir when no arg', async () => {
    const dir = await seedSessions(['20260630091224-a-11111111']);
    const spy = spyOn(editor, 'openInEditor').mockImplementation(() => undefined as never);
    try { viewTrace([], dir, { exitImpl: noopExit }); } catch (e) { expect(e).toBeInstanceOf(ExitSignal); }
    expect(spy).toHaveBeenCalledWith(dir, expect.anything());
    spy.mockRestore();
  });

  it('opens latest session for "latest"', async () => {
    const dir = await seedSessions(['20260630091224-a-11111111', '20260630091225-a-22222222']);
    const spy = spyOn(editor, 'openInEditor').mockImplementation(() => undefined as never);
    try { viewTrace(['latest'], dir, { exitImpl: noopExit }); } catch (e) { expect(e).toBeInstanceOf(ExitSignal); }
    expect(spy).toHaveBeenCalledWith(join(dir, '20260630091225-a-22222222.jsonl'), expect.anything());
    spy.mockRestore();
  });

  it('opens specified session-id', async () => {
    const dir = await seedSessions(['20260630091224-a-11111111']);
    const spy = spyOn(editor, 'openInEditor').mockImplementation(() => undefined as never);
    try { viewTrace(['20260630091224-a-11111111'], dir, { exitImpl: noopExit }); } catch (e) { expect(e).toBeInstanceOf(ExitSignal); }
    expect(spy).toHaveBeenCalledWith(join(dir, '20260630091224-a-11111111.jsonl'), expect.anything());
    spy.mockRestore();
  });

  it('exits 1 when session-id not found (no editor open)', async () => {
    const dir = await seedSessions(['20260630091224-a-11111111']);
    const spy = spyOn(editor, 'openInEditor').mockImplementation(() => undefined as never);
    let code: number | undefined;
    try {
      viewTrace(['nope'], dir, {
        exitImpl: ((c?: number) => { code = c ?? 1; throw new ExitSignal(); }) as unknown as (c?: number) => never,
      });
    } catch {}
    expect(code).toBe(1);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('clean keeps 50 by default and reports counts', async () => {
    const dir = await seedSessions(Array.from({ length: 60 }, (_, i) => `2026063009000${i % 10}-a-${i.toString().padStart(8, '0')}`));
    const errSpy = spyOn(process.stderr, 'write');
    try { viewTrace(['clean'], dir, { exitImpl: noopExit }); } catch (e) { expect(e).toBeInstanceOf(ExitSignal); }
    const msg = errSpy.mock.calls.map(c => String(c[0])).join('');
    expect(msg).toMatch(/Kept 50.*removed 10/);
    errSpy.mockRestore();
    const { listSessions } = await import('../src/trace-session');
    expect(listSessions(dir)).toHaveLength(50);
  });

  it('clean --all removes everything', async () => {
    const dir = await seedSessions(['20260630091224-a-11111111', '20260630091225-a-22222222']);
    try { viewTrace(['clean', '--all'], dir, { exitImpl: noopExit }); } catch (e) { expect(e).toBeInstanceOf(ExitSignal); }
    const { listSessions } = await import('../src/trace-session');
    expect(listSessions(dir)).toEqual([]);
  });

  it('clean --keep N keeps N newest; clamps negative', async () => {
    const dir = await seedSessions(['20260630091224-a-11111111', '20260630091225-a-22222222', '20260630091226-a-33333333']);
    try { viewTrace(['clean', '--keep', '1'], dir, { exitImpl: noopExit }); } catch (e) { expect(e).toBeInstanceOf(ExitSignal); }
    const { listSessions } = await import('../src/trace-session');
    expect(listSessions(dir)).toEqual(['20260630091226-a-33333333']);
  });

  it('clean errors when --all and --keep both present', async () => {
    const dir = await seedSessions(['20260630091224-a-11111111']);
    const errSpy = spyOn(process.stderr, 'write');
    let code: number | undefined;
    try {
      viewTrace(['clean', '--all', '--keep', '5'], dir, {
        exitImpl: ((c?: number) => { code = c ?? 1; throw new ExitSignal(); }) as unknown as (c?: number) => never,
      });
    } catch {}
    expect(code).toBe(1);
    expect(errSpy.mock.calls.some(c => String(c[0]).includes('conflict'))).toBe(true);
    errSpy.mockRestore();
  });

  it('clean errors on bare --keep and deletes nothing', async () => {
    const dir = await seedSessions(['20260630091224-a-11111111', '20260630091225-a-22222222']);
    const errSpy = spyOn(process.stderr, 'write');
    let code: number | undefined;
    try {
      viewTrace(['clean', '--keep'], dir, {
        exitImpl: ((c?: number) => { code = c ?? 1; throw new ExitSignal(); }) as unknown as (c?: number) => never,
      });
    } catch {}
    expect(code).toBe(1);
    expect(errSpy.mock.calls.some(c => String(c[0]).includes('--keep requires'))).toBe(true);
    errSpy.mockRestore();
    const { listSessions } = await import('../src/trace-session');
    expect(listSessions(dir)).toHaveLength(2); // 没有任何 session 被删除
  });

  it('clean errors on non-numeric --keep and deletes nothing', async () => {
    const dir = await seedSessions(['20260630091224-a-11111111']);
    const errSpy = spyOn(process.stderr, 'write');
    let code: number | undefined;
    try {
      viewTrace(['clean', '--keep', 'abc'], dir, {
        exitImpl: ((c?: number) => { code = c ?? 1; throw new ExitSignal(); }) as unknown as (c?: number) => never,
      });
    } catch {}
    expect(code).toBe(1);
    expect(errSpy.mock.calls.some(c => String(c[0]).includes('--keep requires'))).toBe(true);
    errSpy.mockRestore();
    const { listSessions } = await import('../src/trace-session');
    expect(listSessions(dir)).toHaveLength(1);
  });
});
