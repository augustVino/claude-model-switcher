import { describe, expect, it, beforeEach } from 'bun:test';
import { setupTmpDir } from './helpers';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  generateSessionId, buildTracePath, listSessions, latestSession, cleanSessions,
} from '../src/trace-session';

let tmpDir: string;
beforeEach(async () => { tmpDir = await setupTmpDir(); });

describe('generateSessionId', () => {
  it('formats as yyyymmddHHMMSS-provider-hex(8)', () => {
    const fixed = new Date(2026, 5, 30, 9, 12, 24);
    expect(generateSessionId('zhipu', fixed)).toMatch(/^20260630091224-zhipu-[0-9a-f]{8}$/);
  });

  it('100 ids are all unique', () => {
    const fixed = new Date(2026, 5, 30, 9, 12, 24);
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(generateSessionId('zhipu', fixed));
    expect(ids.size).toBe(100);
  });
});

describe('buildTracePath', () => {
  it('appends .jsonl to sessionId under tracesDir', () => {
    expect(buildTracePath(tmpDir, '20260630091224-zhipu-deadbeef'))
      .toBe(join(tmpDir, '20260630091224-zhipu-deadbeef.jsonl'));
  });
});

describe('listSessions / latestSession', () => {
  it('returns empty array and null when dir missing (ENOENT)', () => {
    expect(listSessions(join(tmpDir, 'nope'))).toEqual([]);
    expect(latestSession(join(tmpDir, 'nope'))).toBeNull();
  });

  it('lists session-ids sorted ascending (old→new)', async () => {
    const dir = join(tmpDir, 'traces');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '20260701091224-a-11111111.jsonl'), '');
    await writeFile(join(dir, '20260630091224-b-22222222.jsonl'), '');
    await writeFile(join(dir, '20260630080000-c-33333333.jsonl'), '');
    expect(listSessions(dir)).toEqual([
      '20260630080000-c-33333333',
      '20260630091224-b-22222222',
      '20260701091224-a-11111111',
    ]);
    expect(latestSession(dir)).toBe('20260701091224-a-11111111');
  });

  it('ignores non-jsonl files', async () => {
    const dir = join(tmpDir, 'traces');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '20260630091224-a-11111111.jsonl'), '');
    await writeFile(join(dir, 'readme.txt'), '');
    expect(listSessions(dir)).toEqual(['20260630091224-a-11111111']);
  });
});

describe('cleanSessions', () => {
  it('keeps newest N, removes oldest; removed only lists successfully deleted', async () => {
    const dir = join(tmpDir, 'traces');
    await mkdir(dir, { recursive: true });
    for (const id of ['20260630091224-a-11111111', '20260630091225-a-22222222', '20260630091226-a-33333333']) {
      await writeFile(join(dir, `${id}.jsonl`), '');
    }
    const res = cleanSessions(dir, 1);
    expect(res.kept).toEqual(['20260630091226-a-33333333']);
    expect(res.removed).toEqual(['20260630091224-a-11111111', '20260630091225-a-22222222']);
    expect(listSessions(dir)).toEqual(['20260630091226-a-33333333']);
  });

  it('removes all when keep=0', async () => {
    const dir = join(tmpDir, 'traces');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '20260630091224-a-11111111.jsonl'), '');
    expect(cleanSessions(dir, 0).removed).toEqual(['20260630091224-a-11111111']);
    expect(listSessions(dir)).toEqual([]);
  });

  it('no-op when count <= keep', async () => {
    const dir = join(tmpDir, 'traces');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '20260630091224-a-11111111.jsonl'), '');
    expect(cleanSessions(dir, 50).removed).toEqual([]);
  });
});
